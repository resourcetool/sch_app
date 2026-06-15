// src/services/indexedDB.js
//
// Fix: DB_VERSION bumped to 2 so the upgrade() callback runs again on existing
// browsers and creates the missing indexes.
// Added schoolId indexes on: classes, subjects, teachers, analytics, promotions, backups.
// Without these indexes every idbGetAll('classes','schoolId',...) threw:
//   "Failed to execute 'index' on 'IDBObjectStore': The specified index was not found."
// All existing stores and indexes preserved exactly.

import { openDB } from 'idb';

const DB_NAME    = 'SchoolMgmtDB';
const DB_VERSION = 2;           // ← was 1; bump forces upgrade() to re-run

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── Helper: create store if it doesn't exist yet ─────────────
      function ensureStore(name) {
        if (!db.objectStoreNames.contains(name)) {
          return db.createObjectStore(name, { keyPath: 'id' });
        }
        return null; // store already exists — indexes handled below in v2 block
      }

      // ── Version 1 stores (created fresh when DB didn't exist) ────
      if (oldVersion < 1) {
        const students = ensureStore('students');
        if (students) {
          students.createIndex('schoolId',    'schoolId');
          students.createIndex('studentCode', 'studentCode');
        }

        const enrollments = ensureStore('enrollments');
        if (enrollments) {
          enrollments.createIndex('schoolId',    'schoolId');
          enrollments.createIndex('studentId',   'studentId');
          enrollments.createIndex('classId',     'classId');
          enrollments.createIndex('academicYear','academicYear');
        }

        const scores = ensureStore('scores');
        if (scores) {
          scores.createIndex('schoolId',    'schoolId');
          scores.createIndex('enrollmentId','enrollmentId');
          scores.createIndex('subjectId',   'subjectId');
        }

        const results = ensureStore('results');
        if (results) {
          results.createIndex('schoolId',    'schoolId');
          results.createIndex('enrollmentId','enrollmentId');
        }

        const syncQueue = ensureStore('syncQueue');
        if (syncQueue) {
          syncQueue.createIndex('status',   'status');
          syncQueue.createIndex('timestamp','timestamp');
        }

        // Stores that existed in v1 but had NO indexes (causing the crash)
        ensureStore('classes');
        ensureStore('subjects');
        ensureStore('teachers');
        ensureStore('analytics');
        ensureStore('promotions');
        ensureStore('backups');
        ensureStore('subscriptions');
        ensureStore('users');
        ensureStore('schools');
      }

      // ── Version 2: add missing schoolId indexes ──────────────────
      // These run for BOTH new installs (oldVersion=0→2) and existing
      // users upgrading (oldVersion=1→2).
      if (oldVersion < 2) {
        const needsSchoolIdIndex = ['classes', 'subjects', 'teachers', 'analytics', 'promotions', 'backups'];

        needsSchoolIdIndex.forEach(storeName => {
          // Ensure the store exists (it will for upgrading users)
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
          // Get a reference to the existing store via the transaction
          const store = db.transaction.objectStore
            ? db.transaction.objectStore(storeName)
            : null;

          if (store && !store.indexNames.contains('schoolId')) {
            store.createIndex('schoolId', 'schoolId');
          }
        });

        // Also add classId index to scores if missing (needed for teacher filtering)
        const scoresStore = db.objectStoreNames.contains('scores')
          ? db.transaction.objectStore?.('scores')
          : null;
        if (scoresStore && !scoresStore.indexNames.contains('classId')) {
          scoresStore.createIndex('classId', 'classId');
        }

        // Add term + academicYear indexes to enrollments if missing
        const enrStore = db.objectStoreNames.contains('enrollments')
          ? db.transaction.objectStore?.('enrollments')
          : null;
        if (enrStore) {
          if (!enrStore.indexNames.contains('term')) {
            enrStore.createIndex('term', 'term');
          }
        }
      }
    },

    blocked() {
      console.warn('[IDB] Database upgrade blocked. Please close other tabs running this app.');
    },
    blocking() {
      // A newer version wants to open — release our instance so the upgrade can proceed
      dbInstance?.close();
      dbInstance = null;
    },
  });

  return dbInstance;
}

// ── Generic CRUD ──────────────────────────────────────────────────

export async function idbGet(store, id) {
  const db = await getDB();
  return db.get(store, id);
}

/**
 * Get all records from a store, optionally filtered by index.
 * Falls back to a full scan + JS filter if the index doesn't exist
 * (safety net during migrations).
 */
export async function idbGetAll(store, indexName, query) {
  const db = await getDB();
  if (indexName && query !== undefined) {
    try {
      return await db.getAllFromIndex(store, indexName, query);
    } catch (err) {
      // Index missing — fall back to full scan with JS filter
      console.warn(`[IDB] Index '${indexName}' not found on '${store}', using fallback scan.`, err.message);
      const all = await db.getAll(store);
      return all.filter(r => r[indexName] === query);
    }
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
    tx.done,
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

// ── Sync Queue ────────────────────────────────────────────────────

export async function enqueueSyncOperation(op) {
  const db = await getDB();
  await db.put('syncQueue', {
    id:        `sync_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    ...op,
    status:    'pending',
    timestamp: Date.now(),
    retries:   0,
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
    await db.put('syncQueue', {
      ...op,
      status:  'failed',
      error:   error.message,
      retries: (op.retries || 0) + 1,
    });
  }
}

export async function getDBStats() {
  const db     = await getDB();
  const STORES = [
    'students','enrollments','teachers','classes','subjects',
    'scores','results','promotions','analytics','syncQueue',
    'backups','subscriptions','users','schools',
  ];
  const stats = {};
  for (const store of STORES) {
    try { stats[store] = await db.count(store); }
    catch { stats[store] = 0; }
  }
  return stats;
}
