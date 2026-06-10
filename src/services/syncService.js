// src/services/syncService.js
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getPendingSyncOps, markSyncOpComplete, markSyncOpFailed,
  enqueueSyncOperation, idbPut, idbGetAll
} from './indexedDB';

let isSyncing = false;
let syncListeners = [];

export function onSyncStatusChange(cb) {
  syncListeners.push(cb);
  return () => { syncListeners = syncListeners.filter(l => l !== cb); };
}

function notifySyncListeners(status) {
  syncListeners.forEach(cb => cb(status));
}

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

    const batch = writeBatch(db);
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
    console.error('Sync failed:', err);
    notifySyncListeners('error');
  } finally {
    isSyncing = false;
  }
}

// Write-through: write to IDB first, then enqueue for Firestore
export async function writeRecord(collectionName, docId, data, schoolId) {
  const record = { ...data, id: docId, schoolId, updatedAt: Date.now() };
  
  // Always write to IDB immediately
  await idbPut(collectionName, record);
  
  // Enqueue for Firestore
  await enqueueSyncOperation({
    collection: collectionName,
    docId,
    type: 'set',
    data: record
  });

  // Try to sync immediately if online
  if (navigator.onLine) {
    syncToFirestore().catch(console.error);
  }
  
  return record;
}

export async function deleteRecord(collectionName, docId) {
  await enqueueSyncOperation({
    collection: collectionName,
    docId,
    type: 'delete',
    data: {}
  });

  if (navigator.onLine) {
    syncToFirestore().catch(console.error);
  }
}

// Pull from Firestore to IDB (for initial load or refresh)
export async function pullCollectionFromFirestore(collectionName, schoolId) {
  if (!navigator.onLine) return;
  
  try {
    const q = query(collection(db, collectionName), where('schoolId', '==', schoolId));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const { idbPutMany } = await import('./indexedDB');
    if (records.length > 0) {
      await idbPutMany(collectionName, records);
    }
    return records;
  } catch (err) {
    console.error(`Pull failed for ${collectionName}:`, err);
    return [];
  }
}

// Full school data sync on login
export async function initialSync(schoolId) {
  const collections = [
    'students', 'enrollments', 'teachers', 'classes',
    'subjects', 'scores', 'results', 'promotions', 'analytics'
  ];
  
  await Promise.all(collections.map(c => pullCollectionFromFirestore(c, schoolId)));
}

// Setup online/offline listeners
export function setupConnectivityListeners() {
  window.addEventListener('online', () => {
    notifySyncListeners('online');
    syncToFirestore();
  });
  window.addEventListener('offline', () => {
    notifySyncListeners('offline');
  });
}
