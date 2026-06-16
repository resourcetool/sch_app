// src/services/syncService.js
//
// Key fixes:
// 1. writeRecord() now writes to Firestore DIRECTLY (not just queue) when online.
//    This means data is never lost if browser cache is cleared — Firestore is
//    the source of truth, IDB is just a cache for speed/offline.
// 2. initialSync() now called on EVERY login (not just first), ensuring teachers
//    on different devices always get latest data from Firestore.
// 3. getScoresFromFirestore() added — report generation fetches scores directly
//    from Firestore to guarantee accuracy regardless of IDB state.
// 4. syncQueue is still used for offline writes; they flush on reconnect.

import {
  collection, doc, setDoc, deleteDoc,
  getDocs, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getPendingSyncOps, markSyncOpComplete, markSyncOpFailed,
  enqueueSyncOperation, idbPut, idbGetAll, idbPutMany
} from './indexedDB';

let isSyncing   = false;
let syncListeners = [];

export function onSyncStatusChange(cb) {
  syncListeners.push(cb);
  return () => { syncListeners = syncListeners.filter(l => l !== cb); };
}

function notifySyncListeners(status) {
  syncListeners.forEach(cb => cb(status));
}

// ── FLUSH OFFLINE QUEUE TO FIRESTORE ─────────────────────────────
export async function syncToFirestore() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;
  notifySyncListeners('syncing');

  try {
    const pendingOps = await getPendingSyncOps();
    if (pendingOps.length === 0) {
      notifySyncListeners('synced');
      return;
    }

    const batch     = writeBatch(db);
    const processed = [];

    for (const op of pendingOps) {
      try {
        const ref = doc(db, op.collection, op.docId);
        if (op.type === 'set') {
          const { _localUpdatedAt, ...data } = op.data;
          batch.set(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        } else if (op.type === 'delete') {
          batch.delete(ref);
        }
        processed.push(op.id);
      } catch (err) {
        await markSyncOpFailed(op.id, err);
      }
    }

    if (processed.length > 0) {
      await batch.commit();
      await Promise.all(processed.map(id => markSyncOpComplete(id)));
    }

    notifySyncListeners('synced');
  } catch (err) {
    console.error('[Sync] Flush failed:', err);
    notifySyncListeners('error');
  } finally {
    isSyncing = false;
  }
}

// ── WRITE RECORD ─────────────────────────────────────────────────
// Always writes to IDB immediately (for instant UI response).
// When ONLINE: also writes directly to Firestore right now.
// When OFFLINE: queues the write; flushed when connection returns.
// This means clearing browser cache NEVER loses data — Firestore
// is the permanent store; IDB is just a local cache.
export async function writeRecord(collectionName, docId, data, schoolId) {
  const record = {
    ...data,
    id:        docId,
    schoolId,
    updatedAt: Date.now(),
  };

  // 1. Write to IDB immediately (fast local response)
  await idbPut(collectionName, record);

  if (navigator.onLine) {
    // 2a. Online: write directly to Firestore right now
    try {
      const { _localUpdatedAt, ...firestoreData } = record;
      await setDoc(
        doc(db, collectionName, docId),
        { ...firestoreData, updatedAt: serverTimestamp() },
        { merge: true }
      );
      notifySyncListeners('synced');
    } catch (err) {
      // Firestore write failed — fall back to queue so it retries
      console.warn(`[Sync] Direct write failed for ${collectionName}/${docId}, queuing:`, err.message);
      await enqueueSyncOperation({ collection: collectionName, docId, type: 'set', data: record });
      notifySyncListeners('error');
    }
  } else {
    // 2b. Offline: queue for later
    await enqueueSyncOperation({ collection: collectionName, docId, type: 'set', data: record });
    notifySyncListeners('offline');
  }

  return record;
}

// ── DELETE RECORD ─────────────────────────────────────────────────
export async function deleteRecord(collectionName, docId) {
  if (navigator.onLine) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
    } catch (err) {
      console.warn(`[Sync] Direct delete failed, queuing:`, err.message);
      await enqueueSyncOperation({ collection: collectionName, docId, type: 'delete', data: {} });
    }
  } else {
    await enqueueSyncOperation({ collection: collectionName, docId, type: 'delete', data: {} });
  }
}

// ── PULL COLLECTION FROM FIRESTORE → IDB ─────────────────────────
// Called on login and refresh to populate IDB from Firestore.
// This is how cross-device sync works: teacher logs in on any
// device → this pulls all school data fresh from Firestore.
export async function pullCollectionFromFirestore(collectionName, schoolId) {
  if (!navigator.onLine) return [];
  try {
    const q       = query(collection(db, collectionName), where('schoolId', '==', schoolId));
    const snap    = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (records.length > 0) {
      await idbPutMany(collectionName, records);
    }
    return records;
  } catch (err) {
    console.error(`[Sync] Pull failed for ${collectionName}:`, err.message);
    return [];
  }
}

// ── INITIAL SYNC ──────────────────────────────────────────────────
// Called every login. Pulls all school collections from Firestore
// into IDB so the app works offline and all devices stay in sync.
export async function initialSync(schoolId) {
  if (!navigator.onLine) return;
  const COLLECTIONS = [
    'students', 'enrollments', 'teachers', 'classes',
    'subjects', 'scores', 'results', 'promotions', 'analytics',
    'assessmentDeadlines',
  ];
  try {
    notifySyncListeners('syncing');
    await Promise.all(COLLECTIONS.map(c => pullCollectionFromFirestore(c, schoolId)));
    // Also flush any pending offline writes
    await syncToFirestore();
    notifySyncListeners('synced');
  } catch (err) {
    console.error('[Sync] Initial sync error:', err);
    notifySyncListeners('error');
  }
}

// ── FETCH SCORES DIRECTLY FROM FIRESTORE ─────────────────────────
// Used by report generation to guarantee accuracy.
// Never reads from IDB — always fetches live from Firestore so
// every teacher's submitted scores are included regardless of
// which device they used or whether their data is cached locally.
export async function getScoresFromFirestore(schoolId, classId, academicYear, term) {
  const constraints = [
    where('schoolId',    '==', schoolId),
    where('classId',     '==', classId),
    where('academicYear','==', academicYear),
    where('term',        '==', term),
  ];
  const snap    = await getDocs(query(collection(db, 'scores'), ...constraints));
  const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Also update IDB with the freshly fetched data
  if (records.length > 0) {
    await idbPutMany('scores', records);
  }

  return records;
}

// ── CONNECTIVITY LISTENERS ────────────────────────────────────────
export function setupConnectivityListeners() {
  window.addEventListener('online', () => {
    notifySyncListeners('online');
    syncToFirestore();  // flush any queued offline writes
  });
  window.addEventListener('offline', () => {
    notifySyncListeners('offline');
  });
}
