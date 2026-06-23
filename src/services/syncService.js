// src/services/syncService.js
//
// HYBRID OFFLINE/ONLINE SYNC — robust implementation.
//
// Architecture:
//   Writes:  IDB first (instant) → Firestore directly (online)
//            or queue for offline → auto-flush on reconnect.
//   Reads:   IDB first → Firestore fallback if IDB empty.
//   Conflict: last-write-wins on updatedAt timestamp.
//             If Firestore doc is NEWER than our write, we skip (don't overwrite fresher data).
//   Retry:   Failed Firestore writes retry up to 3 times with exponential backoff.
//   Status:  Broadcast to all listeners — Layout.jsx shows sync badge.

import {
  collection, doc, setDoc, deleteDoc, getDoc,
  getDocs, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getPendingSyncOps, markSyncOpComplete, markSyncOpFailed,
  enqueueSyncOperation, idbPut, idbGetAll, idbPutMany, idbDelete
} from './indexedDB';

// ── SYNC STATUS BROADCAST ─────────────────────────────────────────
let syncListeners = [];
let currentStatus = 'synced';

export function onSyncStatusChange(cb) {
  syncListeners.push(cb);
  cb(currentStatus); // emit current status immediately
  return () => { syncListeners = syncListeners.filter(l => l !== cb); };
}

function emit(status) {
  currentStatus = status;
  syncListeners.forEach(cb => cb(status));
}

// ── RETRY HELPER ──────────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      console.warn(`[Sync] Attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── WRITE RECORD ─────────────────────────────────────────────────
// 1. Always writes to IDB immediately → instant UI response.
// 2. Online: writes directly to Firestore with retry logic.
//    Before writing, checks if Firestore already has a NEWER version
//    (conflict resolution: last write wins by updatedAt).
// 3. Offline: queues the write for automatic flush on reconnect.
export async function writeRecord(collectionName, docId, data, schoolId) {
  const record = {
    ...data,
    id:        docId,
    schoolId,
    updatedAt: Date.now(),
  };

  // 1. Write to IDB immediately
  await idbPut(collectionName, record);

  if (navigator.onLine) {
    try {
      await withRetry(async () => {
        // Conflict check: if the Firestore doc has updatedAt AFTER our
        // local write, it means another device wrote more recently.
        // We skip our write to avoid overwriting fresher data.
        const existing = await getDoc(doc(db, collectionName, docId));
        if (existing.exists()) {
          const serverUpdatedAt = existing.data().updatedAt;
          if (serverUpdatedAt && serverUpdatedAt > record.updatedAt) {
            // Server is newer — pull it into IDB instead of overwriting
            const serverData = { id: docId, ...existing.data() };
            await idbPut(collectionName, serverData);
            console.info(`[Sync] Skipped write to ${collectionName}/${docId} — server data is newer`);
            return;
          }
        }

        const { _localUpdatedAt, ...firestoreData } = record;
        await setDoc(
          doc(db, collectionName, docId),
          { ...firestoreData, updatedAt: serverTimestamp() },
          { merge: true }
        );
      });
      emit('synced');
    } catch (err) {
      console.error(`[Sync] Write failed for ${collectionName}/${docId}:`, err.message);
      await enqueueSyncOperation({ collection: collectionName, docId, type: 'set', data: record });
      emit('error');
    }
  } else {
    await enqueueSyncOperation({ collection: collectionName, docId, type: 'set', data: record });
    emit('offline');
  }

  return record;
}

// ── DELETE RECORD ─────────────────────────────────────────────────
// Deletes from IDB first (instant UI), then Firestore (or queues).
export async function deleteRecord(collectionName, docId) {
  // 1. Delete from IDB immediately — makes UI update right away
  await idbDelete(collectionName, docId);

  if (navigator.onLine) {
    try {
      await withRetry(() => deleteDoc(doc(db, collectionName, docId)));
      emit('synced');
    } catch (err) {
      console.warn(`[Sync] Delete failed, queuing:`, err.message);
      await enqueueSyncOperation({ collection: collectionName, docId, type: 'delete', data: {} });
      emit('error');
    }
  } else {
    await enqueueSyncOperation({ collection: collectionName, docId, type: 'delete', data: {} });
    emit('offline');
  }
}

// ── FLUSH OFFLINE QUEUE ───────────────────────────────────────────
// Called automatically on reconnect and on login.
// Processes all pending offline writes in a Firestore batch.
let isFlushing = false;

export async function syncToFirestore() {
  if (isFlushing || !navigator.onLine) return;
  isFlushing = true;
  emit('syncing');

  try {
    const pendingOps = await getPendingSyncOps();
    if (pendingOps.length === 0) { emit('synced'); return; }

    console.info(`[Sync] Flushing ${pendingOps.length} queued operations`);

    // Process in batches of 400 (Firestore batch limit is 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < pendingOps.length; i += BATCH_SIZE) {
      const chunk      = pendingOps.slice(i, i + BATCH_SIZE);
      const batch      = writeBatch(db);
      const toComplete = [];

      for (const op of chunk) {
        try {
          const ref = doc(db, op.collection, op.docId);
          if (op.type === 'set') {
            const { _localUpdatedAt, ...data } = op.data;
            batch.set(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
          } else if (op.type === 'delete') {
            batch.delete(ref);
          }
          toComplete.push(op.id);
        } catch (err) {
          await markSyncOpFailed(op.id, err);
        }
      }

      if (toComplete.length > 0) {
        await withRetry(() => batch.commit());
        await Promise.all(toComplete.map(id => markSyncOpComplete(id)));
        console.info(`[Sync] Flushed batch of ${toComplete.length}`);
      }
    }

    emit('synced');
  } catch (err) {
    console.error('[Sync] Flush failed:', err);
    emit('error');
  } finally {
    isFlushing = false;
  }
}

// ── PULL COLLECTION FROM FIRESTORE → IDB ─────────────────────────
export async function pullCollectionFromFirestore(collectionName, schoolId) {
  if (!navigator.onLine) return [];
  try {
    const q       = query(collection(db, collectionName), where('schoolId', '==', schoolId));
    const snap    = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (records.length > 0) await idbPutMany(collectionName, records);
    return records;
  } catch (err) {
    console.error(`[Sync] Pull failed for ${collectionName}:`, err.message);
    return [];
  }
}

// ── INITIAL SYNC (on every login) ────────────────────────────────
// Pulls all school collections from Firestore into IDB so the app
// works offline and all devices see the same data.
// Also flushes any queued offline writes.
export async function initialSync(schoolId) {
  if (!navigator.onLine) { emit('offline'); return; }
  emit('syncing');

  const COLLECTIONS = [
    'students', 'enrollments', 'teachers', 'classes',
    'subjects', 'scores', 'results', 'promotions', 'analytics',
    'assessmentDeadlines',
  ];

  try {
    // Pull all collections in parallel
    await Promise.allSettled(
      COLLECTIONS.map(c => pullCollectionFromFirestore(c, schoolId))
    );
    // Flush any offline writes first — they might conflict with pulled data
    await syncToFirestore();
    emit('synced');
  } catch (err) {
    console.error('[Sync] Initial sync error:', err);
    emit('error');
  }
}

// ── FETCH SCORES DIRECTLY FROM FIRESTORE ─────────────────────────
// Used by report generation to guarantee all teachers' scores are included.
// Never reads from IDB — always live from Firestore.
export async function getScoresFromFirestore(schoolId, classId, academicYear, term) {
  const snap = await getDocs(query(
    collection(db, 'scores'),
    where('schoolId',    '==', schoolId),
    where('classId',     '==', classId),
    where('academicYear','==', academicYear),
    where('term',        '==', term),
  ));
  const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (records.length > 0) await idbPutMany('scores', records);
  return records;
}

// ── CONNECTIVITY LISTENERS ────────────────────────────────────────
// Auto-flush queued writes when connection returns.
// Emits status so the UI sync badge updates immediately.
let connectivitySetup = false;
export function setupConnectivityListeners() {
  if (connectivitySetup) return;
  connectivitySetup = true;

  window.addEventListener('online', async () => {
    console.info('[Sync] Connection restored — flushing queue');
    emit('syncing');
    await syncToFirestore();
  });

  window.addEventListener('offline', () => {
    console.info('[Sync] Connection lost — switching to offline mode');
    emit('offline');
  });

  // Emit initial status
  emit(navigator.onLine ? 'synced' : 'offline');
}
