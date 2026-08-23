// src/services/approvalService.js
//
// Assessment approval workflow — Pro/Premium feature.
// Teacher submits their subject's scores for a class/term → headteacher
// reviews → approves (locks) or rejects (sends back for correction).
//
// GRANULARITY: per class + subject + term, not per class alone. A class
// has several subjects, each owned by a different teacher — locking a
// whole class the moment ONE teacher finishes would block the others
// from still entering their own scores. Each subject's submission is
// independent.
//
// RELATIONSHIP TO THE EXISTING isFinalized FLAG:
// finalizeResults() in scoreService.js already sets isFinalized:true on
// RESULT documents (the computed/aggregated per-student outcome), for a
// whole class+term at once — that's the older, simpler, class-wide
// "freeze the report" mechanism and is untouched by this feature.
// This workflow operates one level below that, on the raw SCORE
// documents, at subject granularity — approving a submission here sets
// isFinalized:true on the underlying scores for that specific subject,
// which is what actually blocks a teacher from editing them further
// (see the check in scoreService.js's saveScore()). Previously nothing
// ever set that flag on a score document at all, so that check was
// silently dead code — this workflow is what makes "locks" real.

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getScores } from './scoreService';
import { writeRecord } from './syncService';
import { logActivity } from './superAdminService';

export const SUBMISSION_STATUS = {
  DRAFT:     'draft',      // teacher hasn't submitted yet — scores freely editable
  SUBMITTED: 'submitted',  // awaiting headteacher review
  APPROVED:  'approved',   // locked — scores can no longer be edited by the teacher
  REJECTED:  'rejected',   // sent back — scores editable again, teacher should fix and resubmit
};

function submissionId(schoolId, classId, subjectId, academicYear, term) {
  return `${schoolId}_${classId}_${subjectId}_${academicYear}_${term}`.replace(/\s+/g, '-');
}

export async function getSubmission(schoolId, classId, subjectId, academicYear, term) {
  const id = submissionId(schoolId, classId, subjectId, academicYear, term);
  const snap = await getDoc(doc(db, 'assessmentSubmissions', id));
  return snap.exists() ? snap.data() : null;
}

// All subjects' submission status for one class — used to render the
// "Mathematics — submitted, English — draft, Science — approved" list.
export async function getSubmissionsForClass(schoolId, classId, academicYear, term) {
  const q = query(
    collection(db, 'assessmentSubmissions'),
    where('schoolId', '==', schoolId),
    where('classId', '==', classId),
    where('academicYear', '==', academicYear),
    where('term', '==', term),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Everything awaiting headteacher action, across the whole school —
// the admin's review queue.
export async function getPendingSubmissions(schoolId) {
  const q = query(
    collection(db, 'assessmentSubmissions'),
    where('schoolId', '==', schoolId),
    where('status', '==', SUBMISSION_STATUS.SUBMITTED),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data()).sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
}

export async function submitForApproval(schoolId, classId, subjectId, academicYear, term, teacherId, teacherName) {
  const id = submissionId(schoolId, classId, subjectId, academicYear, term);
  const scores = await getScores(schoolId, { classId, subjectId, academicYear, term });

  const record = {
    id, schoolId, classId, subjectId, academicYear, term,
    status:       SUBMISSION_STATUS.SUBMITTED,
    scoreCount:   scores.length,
    teacherId,
    teacherName:  teacherName || '',
    submittedAt:  Date.now(),
    submittedBy:  teacherId,
    // Cleared on a fresh submission — a resubmission after rejection
    // shouldn't carry the old rejection reason forward.
    approvedAt: null, approvedBy: null,
    rejectedAt: null, rejectedBy: null, rejectionReason: null,
  };
  await setDoc(doc(db, 'assessmentSubmissions', id), record, { merge: true });

  // logActivity() is already internally failure-safe (never throws), so
  // no extra try/catch needed here.
  await logActivity(schoolId, teacherId, teacherName || '', 'Submitted scores for approval', {
    type: 'submission', classId, subjectId, academicYear, term, scoreCount: scores.length,
  });

  return record;
}

// Approving LOCKS the underlying scores — this is the real enforcement
// point. Sets isFinalized:true on every score matching this subject +
// class + term, so saveScore()'s existing lock check actually takes
// effect for teachers (admins can still override, same as everywhere
// else in the app).
export async function approveSubmission(schoolId, classId, subjectId, academicYear, term, approvedByEmail) {
  const id = submissionId(schoolId, classId, subjectId, academicYear, term);
  const scores = await getScores(schoolId, { classId, subjectId, academicYear, term });

  await Promise.all(
    scores.map(s => writeRecord('scores', s.id, { ...s, isFinalized: true }, schoolId))
  );

  await updateDoc(doc(db, 'assessmentSubmissions', id), {
    status:     SUBMISSION_STATUS.APPROVED,
    approvedAt: Date.now(),
    approvedBy: approvedByEmail,
  });

  try {
    await logActivity(schoolId, approvedByEmail, approvedByEmail, 'Approved and locked scores', {
      type: 'approval', classId, subjectId, academicYear, term,
    });
  } catch { /* best-effort */ }
}

export async function rejectSubmission(schoolId, classId, subjectId, academicYear, term, rejectedByEmail, reason) {
  const id = submissionId(schoolId, classId, subjectId, academicYear, term);
  await updateDoc(doc(db, 'assessmentSubmissions', id), {
    status:          SUBMISSION_STATUS.REJECTED,
    rejectedAt:      Date.now(),
    rejectedBy:      rejectedByEmail,
    rejectionReason: reason || '',
  });

  try {
    await logActivity(schoolId, rejectedByEmail, rejectedByEmail, 'Rejected submitted scores — sent back for correction', {
      type: 'rejection', classId, subjectId, academicYear, term, reason,
    });
  } catch { /* best-effort */ }
}

// Safety valve — an admin can unlock an already-approved submission if a
// genuine mistake needs fixing after the fact. Explicitly an admin-only
// action (matches the existing "admin can override finalized" pattern
// used everywhere else in the app).
export async function reopenSubmission(schoolId, classId, subjectId, academicYear, term, reopenedByEmail, reason) {
  const id = submissionId(schoolId, classId, subjectId, academicYear, term);
  const scores = await getScores(schoolId, { classId, subjectId, academicYear, term });

  await Promise.all(
    scores.map(s => writeRecord('scores', s.id, { ...s, isFinalized: false }, schoolId))
  );

  await updateDoc(doc(db, 'assessmentSubmissions', id), {
    status: SUBMISSION_STATUS.DRAFT,
    reopenedAt: Date.now(),
    reopenedBy: reopenedByEmail,
    reopenReason: reason || '',
  });

  try {
    await logActivity(schoolId, reopenedByEmail, reopenedByEmail, 'Reopened an approved submission for correction', {
      type: 'reopen', classId, subjectId, academicYear, term, reason,
    });
  } catch { /* best-effort */ }
}
