// src/services/assessmentService.js
// NEW FILE — Requirement #4, #5, #6
// Handles assessment windows, deadline enforcement, audit trail,
// admin override of teacher scores

import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, query, where, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { idbGetAll, idbGet, idbPut } from './indexedDB';
import { writeRecord } from './syncService';

// ── ASSESSMENT WINDOW ─────────────────────────────────────────────
// Schema: assessmentWindows/{schoolId}_{classId}_{academicYear}_{term}_{subjectId?}

export function buildWindowId(schoolId, classId, academicYear, term, subjectId = 'all') {
  return `${schoolId}_${classId}_${academicYear}_${term}_${subjectId}`;
}

export async function setAssessmentWindow(schoolId, windowConfig) {
  // windowConfig: { classId, academicYear, term, subjectId?,
  //                 openDate, closeDate, isLocked, note }
  const id = buildWindowId(
    schoolId,
    windowConfig.classId,
    windowConfig.academicYear,
    windowConfig.term,
    windowConfig.subjectId || 'all'
  );

  const record = {
    id,
    schoolId,
    ...windowConfig,
    updatedAt: Date.now()
  };

  await setDoc(doc(db, 'assessmentWindows', id), record, { merge: true });
  await idbPut('assessmentWindows', record);
  return record;
}

export async function getAssessmentWindow(schoolId, classId, academicYear, term, subjectId = 'all') {
  const id = buildWindowId(schoolId, classId, academicYear, term, subjectId);

  // Try IDB first
  let record = await idbGet('assessmentWindows', id);
  if (!record && navigator.onLine) {
    const snap = await getDoc(doc(db, 'assessmentWindows', id));
    if (snap.exists()) {
      record = { id, ...snap.data() };
      await idbPut('assessmentWindows', record);
    }
  }
  return record || null;
}

export async function getWindowsForSchool(schoolId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'assessmentWindows'), where('schoolId', '==', schoolId))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getWindowsForSchool error:', err);
    return [];
  }
}

export async function lockAssessmentWindow(schoolId, classId, academicYear, term, subjectId = 'all') {
  const id = buildWindowId(schoolId, classId, academicYear, term, subjectId);
  await updateDoc(doc(db, 'assessmentWindows', id), {
    isLocked:  true,
    lockedAt:  Date.now(),
    updatedAt: Date.now()
  });
}

export async function unlockAssessmentWindow(schoolId, classId, academicYear, term, subjectId = 'all') {
  const id = buildWindowId(schoolId, classId, academicYear, term, subjectId);
  await updateDoc(doc(db, 'assessmentWindows', id), {
    isLocked:   false,
    unlockedAt: Date.now(),
    updatedAt:  Date.now()
  });
}

export async function extendDeadline(schoolId, classId, academicYear, term, newCloseDate, subjectId = 'all') {
  const id = buildWindowId(schoolId, classId, academicYear, term, subjectId);
  await updateDoc(doc(db, 'assessmentWindows', id), {
    closeDate:  newCloseDate,
    isLocked:   false,       // auto-unlock when extending
    updatedAt:  Date.now()
  });
}

// ── DEADLINE ENFORCEMENT ──────────────────────────────────────────
// Requirement #5 — checked in service layer before any write
export async function checkDeadlineAllows(schoolId, classId, academicYear, term, subjectId) {
  const now = Date.now();

  // Check subject-specific window first, then class-wide window
  const subjectWindow = await getAssessmentWindow(schoolId, classId, academicYear, term, subjectId);
  const classWindow   = await getAssessmentWindow(schoolId, classId, academicYear, term, 'all');
  const window        = subjectWindow || classWindow;

  if (!window) return { allowed: true, reason: null }; // no window = open

  if (window.isLocked) {
    return { allowed: false, reason: 'Assessment entry is locked by the administrator.' };
  }

  if (window.openDate && now < window.openDate) {
    const opens = new Date(window.openDate).toLocaleString('en-GH');
    return { allowed: false, reason: `Assessment entry opens on ${opens}.` };
  }

  if (window.closeDate && now > window.closeDate) {
    const closed = new Date(window.closeDate).toLocaleString('en-GH');
    return { allowed: false, reason: `Assessment deadline passed on ${closed}. Contact your administrator to extend.` };
  }

  return { allowed: true, reason: null };
}

// ── AUDIT TRAIL ───────────────────────────────────────────────────
// Requirement #6 — store complete before/after for every admin edit
export async function logScoreAudit(auditData) {
  // auditData: { schoolId, scoreId, enrollmentId, studentId,
  //              subjectId, classId, academicYear, term,
  //              previousValue, newValue, editorId, editorEmail,
  //              reason }
  const id = `audit_${crypto.randomUUID()}`;

  const record = {
    id,
    ...auditData,
    timestamp:    Date.now(),
    timestampISO: new Date().toISOString()
  };

  await setDoc(doc(db, 'scoreAuditLog', id), record);
  return record;
}

export async function getScoreAuditLog(schoolId, filters = {}) {
  try {
    let q = query(
      collection(db, 'scoreAuditLog'),
      where('schoolId', '==', schoolId),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    let records = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (filters.classId)  records = records.filter(r => r.classId  === filters.classId);
    if (filters.subjectId) records = records.filter(r => r.subjectId === filters.subjectId);
    if (filters.studentId) records = records.filter(r => r.studentId === filters.studentId);

    return records;
  } catch (err) {
    console.error('getScoreAuditLog error:', err);
    return [];
  }
}

// ── ADMIN SCORE OVERRIDE ──────────────────────────────────────────
// Requirement #4 — admin can edit/delete any teacher score
export async function adminEditScore(schoolId, scoreId, newData, editor) {
  // editor: { id, email, name }

  // Get existing record for audit
  const existing = await idbGet('scores', scoreId);
  if (!existing) throw new Error('Score record not found');

  const updated = {
    ...existing,
    ...newData,
    total: calculateTotal(newData),
    updatedAt:     Date.now(),
    lastEditedBy:  editor.email,
    lastEditedAt:  Date.now(),
    adminModified: true
  };

  // Write updated score
  await writeRecord('scores', scoreId, updated, schoolId);

  // Log audit trail
  await logScoreAudit({
    schoolId,
    scoreId,
    enrollmentId: existing.enrollmentId,
    studentId:    existing.studentId,
    subjectId:    existing.subjectId,
    classId:      existing.classId,
    academicYear: existing.academicYear,
    term:         existing.term,
    previousValue: {
      classScore: existing.classScore,
      examScore:  existing.examScore,
      total:      existing.total
    },
    newValue: {
      classScore: updated.classScore,
      examScore:  updated.examScore,
      total:      updated.total
    },
    editorId:    editor.id,
    editorEmail: editor.email,
    editorName:  editor.name || editor.email,
    reason:      newData.reason || 'Admin correction',
    action:      'edit'
  });

  return updated;
}

export async function adminDeleteScore(schoolId, scoreId, editor, reason = '') {
  const existing = await idbGet('scores', scoreId);
  if (!existing) throw new Error('Score record not found');

  // Soft delete — mark as deleted, keep for audit
  const deleted = {
    ...existing,
    isDeleted:    true,
    deletedAt:    Date.now(),
    deletedBy:    editor.email,
    updatedAt:    Date.now()
  };
  await writeRecord('scores', scoreId, deleted, schoolId);

  await logScoreAudit({
    schoolId,
    scoreId,
    enrollmentId: existing.enrollmentId,
    studentId:    existing.studentId,
    subjectId:    existing.subjectId,
    classId:      existing.classId,
    academicYear: existing.academicYear,
    term:         existing.term,
    previousValue: {
      classScore: existing.classScore,
      examScore:  existing.examScore,
      total:      existing.total
    },
    newValue:    null,
    editorId:    editor.id,
    editorEmail: editor.email,
    editorName:  editor.name || editor.email,
    reason:      reason || 'Admin deletion',
    action:      'delete'
  });
}

export async function adminApproveScore(schoolId, scoreId, editor) {
  const existing = await idbGet('scores', scoreId);
  if (!existing) throw new Error('Score record not found');

  const approved = {
    ...existing,
    isApproved:   true,
    approvedAt:   Date.now(),
    approvedBy:   editor.email,
    updatedAt:    Date.now()
  };
  await writeRecord('scores', scoreId, approved, schoolId);

  await logScoreAudit({
    schoolId, scoreId,
    enrollmentId: existing.enrollmentId,
    studentId:    existing.studentId,
    subjectId:    existing.subjectId,
    classId:      existing.classId,
    academicYear: existing.academicYear,
    term:         existing.term,
    previousValue: { isApproved: false },
    newValue:      { isApproved: true },
    editorId:    editor.id,
    editorEmail: editor.email,
    editorName:  editor.name || editor.email,
    reason:      'Admin approval',
    action:      'approve'
  });

  return approved;
}

// ── HELPERS ───────────────────────────────────────────────────────
function calculateTotal({ classScore = 0, examScore = 0, components = {} }) {
  const componentTotal = Object.values(components)
    .reduce((sum, v) => sum + (Number(v) || 0), 0);
  return Number(classScore) + Number(examScore) + componentTotal;
}
