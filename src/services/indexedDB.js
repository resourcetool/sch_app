// src/services/indexedDB.js
import { openDB } from 'idb';

const DB_NAME = 'SchoolMgmtDB';
const DB_VERSION = 1;

const STORES = [
  'students', 'enrollments', 'teachers', 'classes',
  'subjects', 'scores', 'results', 'promotions',
  'analytics', 'syncQueue', 'backups', 'subscriptions', 'users', 'schools'
];

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      STORES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          const s = db.createObjectStore(store, { keyPath: 'id' });
          if (store === 'students') {
            s.createIndex('schoolId', 'schoolId');
            s.createIndex('studentCode', 'studentCode');
          }
          if (store === 'enrollments') {
            s.createIndex('schoolId', 'schoolId');
            s.createIndex('studentId', 'studentId');
            s.createIndex('classId', 'classId');
            s.createIndex('academicYear', 'academicYear');
          }
          if (store === 'scores') {
            s.createIndex('schoolId', 'schoolId');
            s.createIndex('enrollmentId', 'enrollmentId');
            s.createIndex('subjectId', 'subjectId');
          }
          if (store === 'results') {
            s.createIndex('schoolId', 'schoolId');
            s.createIndex('enrollmentId', 'enrollmentId');
          }
          if (store === 'syncQueue') {
            s.createIndex('status', 'status');
            s.createIndex('timestamp', 'timestamp');
          }
        }
      });
    }
  });
  return dbInstance;
}

// Generic CRUD
export async function idbGet(store, id) {
  const db = await getDB();
  return db.get(store, id);
}

export async function idbGetAll(store, indexName, query) {
  const db = await getDB();
  if (indexName && query !== undefined) {
    return db.getAllFromIndex(store, indexName, query);
  }
  return db.getAll(store);
}

export async function idbPut(store, record) {
  const db = await getDB();
  await db.put(store, { ...record, _localUpdatedAt: Date.now() });
}

export async function idbPutMany(store, records) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all([
    ...records.map(r => tx.store.put({ ...r, _localUpdatedAt: Date.now() })),
    tx.done
  ]);
}

export async function idbDelete(store, id) {
  const db = await getDB();
  return db.delete(store, id);
}

export async function idbClear(store) {
  const db = await getDB();
  return db.clear(store);
}

// Sync Queue Management
export async function enqueueSyncOperation(op) {
  const db = await getDB();
  await db.put('syncQueue', {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...op,
    status: 'pending',
    timestamp: Date.now(),
    retries: 0
  });
}

export async function getPendingSyncOps() {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'status', 'pending');
}

export async function markSyncOpComplete(id) {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function markSyncOpFailed(id, error) {
  const db = await getDB();
  const op = await db.get('syncQueue', id);
  if (op) {
    await db.put('syncQueue', { ...op, status: 'failed', error: error.message, retries: (op.retries || 0) + 1 });
  }
}

export async function getDBStats() {
  const db = await getDB();
  const stats = {};
  for (const store of STORES) {
    stats[store] = await db.count(store);
  }
  return stats;
}
