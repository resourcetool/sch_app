// src/services/assessmentService.js
//
// New file — implements the full assessment management system:
// - Assessment deadline windows (open/close dates) managed by School Admin.
// - Deadline enforcement in the service layer (teachers cannot save after deadline).
// - Audit trail stored in the 'assessmentAuditLog' Firestore collection.
// - School Admin override functions (edit, delete, approve).

import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { writeRecord } from './syncService';

// ── DEADLINE MANAGEMENT ──────────────────────────────────────────

/**
 * Creates or replaces the assessment deadline configuration for a given
 * school, academic year, and term.
 *
 * @param {string} schoolId
 * @param {string} academicYear  e.g. "2024/2025"
 * @param {string} term          e.g. "1"
 * @param {object} config        { openAt, closeAt, label? }
 *   openAt  — Unix ms timestamp when teachers may begin entry
 *   closeAt — Unix ms timestamp when entry closes
 * @param {string} adminId       UID of the School Admin performing the action
 */
export async function setAssessmentDeadline(schoolId, academicYear, term, config, adminId) {
  const id  = `deadline_${schoolId}_${academicYear}_${term}`.replace(/\//g, '-');
  const data = {
    id,
    schoolId,
    academicYear,
    term,
    openAt:    config.openAt  ?? null,
    closeAt:   config.closeAt ?? null,
    isLocked:  config.isLocked ?? false,
    label:     config.label   ?? `${academicYear} Term ${term}`,
    updatedAt: Date.now(),
    updatedBy: adminId,
  };
  await setDoc(doc(db, 'assessmentDeadlines', id), data, { merge: true });
  return data;
}

/**
 * Fetches the deadline config for a specific school/year/term.
 * Returns null if no config exists (entry is then unrestricted by default).
 */
export async function getAssessmentDeadline(schoolId, academicYear, term) {
  const id  = `deadline_${schoolId}_${academicYear}_${term}`.replace(/\//g, '-');
  const snap = await getDoc(doc(db, 'assessmentDeadlines', id));
  return snap.exists() ? snap.data() : null;
}

/**
 * Manually lock or unlock entry regardless of the closeAt date.
 */
export async function setDeadlineLock(schoolId, academicYear, term, locked, adminId) {
  const id = `deadline_${schoolId}_${academicYear}_${term}`.replace(/\//g, '-');
  await updateDoc(doc(db, 'assessmentDeadlines', id), {
    isLocked:  locked,
    updatedAt: Date.now(),
    updatedBy: adminId,
  });
}

/**
 * Extend the closing date of an existing deadline.
 */
export async function extendDeadline(schoolId, academicYear, term, newCloseAt, adminId) {
  return setAssessmentDeadline(schoolId, academicYear, term, { closeAt: newCloseAt }, adminId);
}

/**
 * Permanently removes a deadline configuration. Once deleted, teachers can
 * submit scores for that academic year/term at any time again — same as
 * if a deadline had never been set. This does not touch any scores that
 * were already entered.
 */
export async function deleteAssessmentDeadline(schoolId, academicYear, term, adminProfile) {
  const id = `deadline_${schoolId}_${academicYear}_${term}`.replace(/\//g, '-');
  await deleteDoc(doc(db, 'assessmentDeadlines', id));

  await logAssessmentAudit({
    schoolId,
    scoreId:     null,
    editorId:    adminProfile?.id,
    editorEmail: adminProfile?.email,
    previousValue: { academicYear, term },
    newValue:    null,
    reason:      `Deadline removed for ${academicYear} Term ${term}`,
    action:      'delete',
  });
}

/**
 * Check whether the deadline window is currently open.
 * Returns { allowed: boolean, reason: string }
 */
export function checkDeadlineStatus(deadline) {
  if (!deadline) return { allowed: true, reason: '' };

  const now = Date.now();

  if (deadline.isLocked) {
    return { allowed: false, reason: 'Assessment entry is currently locked by the school administrator.' };
  }
  if (deadline.openAt && now < deadline.openAt) {
    const opens = new Date(deadline.openAt).toLocaleString();
    return { allowed: false, reason: `Assessment entry opens on ${opens}.` };
  }
  if (deadline.closeAt && now > deadline.closeAt) {
    const closed = new Date(deadline.closeAt).toLocaleString();
    return { allowed: false, reason: `The submission deadline passed on ${closed}.` };
  }

  return { allowed: true, reason: '' };
}

// ── AUDIT TRAIL ───────────────────────────────────────────────────

/**
 * Records an audit log entry whenever an admin modifies a teacher's score.
 *
 * @param {object} opts
 *   scoreId, schoolId, editorId, editorEmail,
 *   previousValue, newValue, reason (optional)
 */
export async function logAssessmentAudit(opts) {
  const id = crypto.randomUUID();
  const entry = {
    id,
    schoolId:      opts.schoolId,
    scoreId:       opts.scoreId,
    editorId:      opts.editorId,
    editorEmail:   opts.editorEmail,
    previousValue: opts.previousValue ?? null,
    newValue:      opts.newValue      ?? null,
    reason:        opts.reason        ?? '',
    action:        opts.action        ?? 'edit',  // 'edit' | 'delete' | 'approve'
    timestamp:     Date.now(),
  };
  await setDoc(doc(db, 'assessmentAuditLog', id), entry);
  return entry;
}

/**
 * Retrieves the full audit log for a school (ordered newest-first).
 *
 * NOTE: sorts client-side rather than using orderBy() in the query.
 * A where(schoolId) + orderBy(timestamp) query needs a composite Firestore
 * index that isn't guaranteed to exist; if it doesn't, Firestore throws
 * 'failed-precondition' and the caller's try/catch silently swallows it —
 * the page just shows an empty list with no visible error. Filtering by a
 * single field and sorting the (small, per-school) result set in JS avoids
 * that index dependency entirely.
 */
export async function getAuditLog(schoolId) {
  const snap = await getDocs(
    query(
      collection(db, 'assessmentAuditLog'),
      where('schoolId', '==', schoolId)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Retrieves the audit history for a single score record.
 */
export async function getScoreAuditHistory(scoreId) {
  const snap = await getDocs(
    query(
      collection(db, 'assessmentAuditLog'),
      where('scoreId', '==', scoreId)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// ── TEACHER SCORE SUBMISSION (with deadline enforcement) ──────────

/**
 * Validates the deadline before allowing a teacher to save/update a score.
 * Throws an error if the deadline has passed or entry is locked.
 * School Admins bypass this check (they use adminEditScore() instead).
 *
 * @param {string} schoolId
 * @param {string} academicYear
 * @param {string} term
 */
export async function validateTeacherCanSubmit(schoolId, academicYear, term) {
  const deadline = await getAssessmentDeadline(schoolId, academicYear, term);
  const { allowed, reason } = checkDeadlineStatus(deadline);
  if (!allowed) {
    throw new Error(reason);
  }
  return deadline;
}

// ── ADMIN ASSESSMENT CONTROLS ─────────────────────────────────────

/**
 * School Admin edits a submitted score.
 * Logs the change to the audit trail.
 *
 * @param {string} scoreId        Firestore document ID of the score
 * @param {string} schoolId
 * @param {object} updates        Fields to update (classScore, examScore, etc.)
 * @param {object} adminProfile   { uid, email }
 * @param {string} reason         Reason for the change (optional)
 */
export async function adminEditScore(scoreId, schoolId, updates, adminProfile, reason = '') {
  const scoreRef  = doc(db, 'scores', scoreId);
  const scoreSnap = await getDoc(scoreRef);

  if (!scoreSnap.exists()) throw new Error('Score record not found.');
  const previous = scoreSnap.data();

  // Recalculate total if class/exam scores changed
  const classScore = updates.classScore ?? previous.classScore ?? 0;
  const examScore  = updates.examScore  ?? previous.examScore  ?? 0;
  const total      = Number(classScore) + Number(examScore);

  const patch = {
    ...updates,
    classScore,
    examScore,
    total,
    adminEditedAt: Date.now(),
    adminEditedBy: adminProfile.email,
    updatedAt:     Date.now(),
  };

  await updateDoc(scoreRef, patch);

  await logAssessmentAudit({
    scoreId,
    schoolId,
    editorId:      adminProfile.uid,
    editorEmail:   adminProfile.email,
    previousValue: { classScore: previous.classScore, examScore: previous.examScore, total: previous.total },
    newValue:      { classScore, examScore, total },
    reason,
    action:        'edit',
  });

  return { ...previous, ...patch };
}

/**
 * School Admin deletes a score record.
 * Logs the deletion to the audit trail.
 */
export async function adminDeleteScore(scoreId, schoolId, adminProfile, reason = '') {
  const scoreRef  = doc(db, 'scores', scoreId);
  const scoreSnap = await getDoc(scoreRef);
  if (!scoreSnap.exists()) throw new Error('Score record not found.');
  const previous = scoreSnap.data();

  await deleteDoc(scoreRef);

  await logAssessmentAudit({
    scoreId,
    schoolId,
    editorId:      adminProfile.uid,
    editorEmail:   adminProfile.email,
    previousValue: previous,
    newValue:      null,
    reason,
    action:        'delete',
  });
}

/**
 * School Admin approves (finalises) an assessment record.
 * Marks it as finalized so teachers can no longer edit it.
 */
export async function adminApproveScore(scoreId, schoolId, adminProfile) {
  const scoreRef = doc(db, 'scores', scoreId);
  const snap     = await getDoc(scoreRef);
  if (!snap.exists()) throw new Error('Score record not found.');
  const previous = snap.data();

  await updateDoc(scoreRef, {
    isFinalized:   true,
    approvedAt:    Date.now(),
    approvedBy:    adminProfile.email,
  });

  await logAssessmentAudit({
    scoreId,
    schoolId,
    editorId:      adminProfile.uid,
    editorEmail:   adminProfile.email,
    previousValue: { isFinalized: false },
    newValue:      { isFinalized: true },
    reason:        'Approved by school administrator',
    action:        'approve',
  });
}

/**
 * Fetch all score records for a school (admin view).
 * Optionally filter by academicYear, term, classId, subjectId.
 */
export async function getAllSchoolScores(schoolId, filters = {}) {
  let q = query(
    collection(db, 'scores'),
    where('schoolId', '==', schoolId)
  );

  const snap = await getDocs(q);
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  // Apply optional client-side filters
  if (filters.academicYear) results = results.filter(s => s.academicYear === filters.academicYear);
  if (filters.term)         results = results.filter(s => s.term         === filters.term);
  if (filters.classId)      results = results.filter(s => s.classId      === filters.classId);
  if (filters.subjectId)    results = results.filter(s => s.subjectId    === filters.subjectId);

  return results;
}

/**
 * Fetch all assessment deadline configs for a school.
 *
 * NOTE: sorts client-side — see getAuditLog() above for why orderBy() is
 * deliberately avoided here (it silently returned an empty deadlines list
 * in the UI whenever the composite index wasn't present, which is exactly
 * what was happening: admins could set a deadline, teachers correctly saw
 * it enforced via the single-doc lookup in getAssessmentDeadline(), but
 * admins couldn't see, edit, or remove it from the Deadlines list here).
 */
export async function getAllDeadlines(schoolId) {
  const snap = await getDocs(
    query(
      collection(db, 'assessmentDeadlines'),
      where('schoolId', '==', schoolId)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
