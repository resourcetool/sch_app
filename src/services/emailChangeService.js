// src/services/emailChangeService.js
//
// Email changes now go through a review gate: the admin/teacher REQUESTS
// a change, super admin approves or rejects it, and only after approval
// can the user actually trigger Firebase's verification email. This
// exists because super admin has no way to directly inspect or set
// someone else's Firebase Auth email (no Admin SDK in this project) — so
// instead of trying to fake that visibility, the whole lifecycle is
// tracked here in Firestore, which super admin CAN see in full:
//
//   pending → approved → verification_sent → completed
//                    \-> rejected
//
// "completed" is set automatically once AuthContext's reconciliation
// logic detects the Auth email actually changed (see onAuthStateChanged
// in AuthContext.jsx) — that's also the moment every other place holding
// a copy of this address (users doc, subscriptions.adminEmail, the
// primary entry in schools.contactEmails) gets updated to match.

import {
  collection, doc, setDoc, getDoc, getDocs,
  updateDoc, query, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';

// Avoids using a Firestore 'in' query alongside an '==' query, which needs
// a composite index — fetch by the single indexed field (userId) and
// filter the (small, per-user) result set in plain JS instead.
export async function getMyRequests(userId) {
  const snap = await getDocs(query(collection(db, 'emailChangeRequests'), where('userId', '==', userId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
}

// The most recent request that's still "in flight" (not yet completed or
// rejected) — this is what the Settings page shows to the user.
export async function getMyActiveRequest(userId) {
  const all = await getMyRequests(userId);
  return all.find(r => r.status !== 'completed' && r.status !== 'rejected') || null;
}

export async function requestEmailChange(userId, schoolId, currentEmail, newEmail) {
  const active = await getMyActiveRequest(userId);
  if (active) {
    throw new Error(
      `You already have a request in progress (status: ${active.status}). ` +
      `Cancel it first if you want to request a different email.`
    );
  }
  const id = uuidv4();
  await setDoc(doc(db, 'emailChangeRequests', id), {
    id,
    userId,
    schoolId,
    currentEmail,
    newEmail: newEmail.trim(),
    status: 'pending',
    requestedAt: Date.now(),
  });
  return id;
}

// Lets the requester cancel their own still-pending request (not once
// it's been approved/is in progress — cancelPendingEmail in AuthContext
// handles backing out after that point).
export async function cancelMyRequest(requestId) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'emailChangeRequests', requestId));
}

// Called once the user has clicked "Send Verification Link" after their
// request was approved — records that step so super admin can see the
// process actually moved forward, not just sitting "approved" forever.
export async function markVerificationSent(requestId) {
  await updateDoc(doc(db, 'emailChangeRequests', requestId), {
    status: 'verification_sent',
    verificationSentAt: Date.now(),
  });
}

// Called automatically by AuthContext's reconciliation once the Auth
// email is confirmed to have actually changed.
export async function markRequestCompleted(requestId) {
  await updateDoc(doc(db, 'emailChangeRequests', requestId), {
    status: 'completed',
    completedAt: Date.now(),
  });
}

// ── SUPER ADMIN ──────────────────────────────────────────────────────
export async function getAllEmailChangeRequests() {
  const snap = await getDocs(collection(db, 'emailChangeRequests'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
}

export async function approveEmailChangeRequest(requestId, reviewerEmail) {
  await updateDoc(doc(db, 'emailChangeRequests', requestId), {
    status: 'approved',
    reviewedAt: Date.now(),
    reviewedBy: reviewerEmail,
  });
}

export async function rejectEmailChangeRequest(requestId, reviewerEmail, reason) {
  await updateDoc(doc(db, 'emailChangeRequests', requestId), {
    status: 'rejected',
    reviewedAt: Date.now(),
    reviewedBy: reviewerEmail,
    rejectionReason: reason || '',
  });
}
