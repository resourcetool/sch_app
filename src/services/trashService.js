// src/services/trashService.js
//
// A safety net for super admin's destructive actions. Deleting a school or
// a single record from the School Data Browser used to be immediate and
// permanent — one wrong click, no way back. This snapshots what's about to
// be deleted into a 'trash' collection FIRST, then performs the real
// deletion, so anything can be restored later.
//
// IMPORTANT — no Cloud Functions in this project, so there is no automatic
// nightly purge. "Expired" trash (past its 30-day window) is just flagged
// in the UI; a super admin has to click "Purge Expired" to actually clear
// it out. This is a manual-trigger safety net, not a fully automated one.
//
// IMPORTANT — school deletion also queues Firebase Auth account deletion
// via a Cloud Function (pendingAuthDeletions, handled elsewhere, deployed
// outside this repo). If that Cloud Function has already run by the time
// someone restores a trashed school, the restored Firestore records will
// exist again but their Auth login accounts will be gone — those users
// would need a fresh password-reset/re-invite to log in again. This is
// flagged clearly in the Trash UI rather than silently assumed to work.

import {
  collection, doc, getDoc, getDocs, setDoc,
  deleteDoc, query, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { superAdminDeleteSchool } from './superAdminService';
import { v4 as uuidv4 } from 'uuid';

export const TRASH_RETENTION_DAYS = 30;

// Every collection that can hang off a school — used both for the full
// school-snapshot and kept here as the single source of truth so it stays
// in sync with what superAdminDeleteSchool() itself deletes.
const SCHOOL_COLLECTIONS = [
  'students', 'teachers', 'classes', 'subjects',
  'enrollments', 'scores', 'results', 'promotions', 'analytics',
  'assessmentDeadlines', 'assessmentAuditLog', 'activityLog',
];

// ── MOVE A SINGLE RECORD TO TRASH ───────────────────────────────────
// Used by the School Data Browser's per-row Delete button. Snapshots the
// full document, writes it to trash, then deletes the original.
export async function moveRecordToTrash(collectionName, docId, deletedByEmail) {
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) throw new Error('Record not found — it may already be deleted.');
  const data = { id: docId, ...snap.data() };

  const trashId = uuidv4();
  const now = Date.now();
  await setDoc(doc(db, 'trash', trashId), {
    id: trashId,
    type: 'record',
    originalCollection: collectionName,
    originalId: docId,
    schoolId: data.schoolId || null,
    label: recordLabel(collectionName, data),
    data,
    deletedAt: now,
    deletedBy: deletedByEmail || 'super-admin',
    expiresAt: now + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  });

  await deleteDoc(doc(db, collectionName, docId));
  return trashId;
}

function recordLabel(collectionName, data) {
  switch (collectionName) {
    case 'students': return `${data.firstName || ''} ${data.lastName || ''} (${data.studentCode || data.id.slice(0, 8)})`;
    case 'teachers':  return `${data.firstName || ''} ${data.lastName || ''} (${data.email || data.id.slice(0, 8)})`;
    case 'classes':   return data.name || data.id.slice(0, 8);
    case 'subjects':  return data.name || data.id.slice(0, 8);
    default:          return data.id.slice(0, 8);
  }
}

// ── MOVE AN ENTIRE SCHOOL TO TRASH ──────────────────────────────────
// Snapshots the school doc, subscription doc, every login account, and
// every collection listed above into ONE trash entry (so a 500-student
// school doesn't create 500 separate trash rows), then delegates the
// actual deletion to the existing, already-correct superAdminDeleteSchool()
// — this never re-implements that logic, just wraps it with a backup step.
export async function moveSchoolToTrash(schoolId, deletedByEmail) {
  const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
  if (!schoolSnap.exists()) throw new Error('School not found.');
  const subSnap = await getDoc(doc(db, 'subscriptions', schoolId));

  const usersSnap = await getDocs(query(collection(db, 'users'), where('schoolId', '==', schoolId)));

  const snapshot = {
    school: { id: schoolId, ...schoolSnap.data() },
    subscription: subSnap.exists() ? { id: schoolId, ...subSnap.data() } : null,
    users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };

  let totalRecords = snapshot.users.length + 1;
  for (const col of SCHOOL_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, col), where('schoolId', '==', schoolId)));
    snapshot[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    totalRecords += snapshot[col].length;
  }

  const trashId = uuidv4();
  const now = Date.now();
  await setDoc(doc(db, 'trash', trashId), {
    id: trashId,
    type: 'school',
    schoolId,
    schoolName: schoolSnap.data().name || 'Unnamed school',
    totalRecords,
    data: snapshot,
    deletedAt: now,
    deletedBy: deletedByEmail || 'super-admin',
    expiresAt: now + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  });

  // Now perform the real deletion — reuses the existing function so the
  // Auth-account-deletion queueing and batched Firestore deletes stay
  // exactly as already built and tested.
  await superAdminDeleteSchool(schoolId);

  return trashId;
}

// ── LIST / RESTORE / PURGE ───────────────────────────────────────────
export async function getTrash() {
  const snap = await getDocs(collection(db, 'trash'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

export async function restoreFromTrash(trashId) {
  const snap = await getDoc(doc(db, 'trash', trashId));
  if (!snap.exists()) throw new Error('This trash entry no longer exists — it may already have been restored or purged.');
  const entry = snap.data();

  if (entry.type === 'record') {
    await setDoc(doc(db, entry.originalCollection, entry.originalId), entry.data);
  } else if (entry.type === 'school') {
    const s = entry.data;
    await setDoc(doc(db, 'schools', entry.schoolId), s.school);
    if (s.subscription) await setDoc(doc(db, 'subscriptions', entry.schoolId), s.subscription);
    for (const u of (s.users || [])) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    for (const col of SCHOOL_COLLECTIONS) {
      for (const rec of (s[col] || [])) {
        await setDoc(doc(db, col, rec.id), rec);
      }
    }
  } else {
    throw new Error('Unknown trash entry type: ' + entry.type);
  }

  await deleteDoc(doc(db, 'trash', trashId));
}

// Permanently deletes a trash entry — no further recovery possible.
export async function purgeTrashItem(trashId) {
  await deleteDoc(doc(db, 'trash', trashId));
}

// Manual sweep — deletes every trash entry already past its retention
// window. Nothing calls this automatically; a super admin clicks the
// button. Returns how many were cleared.
export async function purgeExpiredTrash() {
  const all = await getTrash();
  const now = Date.now();
  const expired = all.filter(t => t.expiresAt && t.expiresAt < now);
  for (const t of expired) {
    await deleteDoc(doc(db, 'trash', t.id));
  }
  return expired.length;
}
