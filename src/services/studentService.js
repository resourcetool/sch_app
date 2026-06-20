// src/services/studentService.js
//
// Critical fix:
// getStudents() and getEnrollments() now fall back to Firestore when IDB is
// empty (e.g. after cache clear). This ensures students never "disappear"
// — they are always fetched from Firestore if not found locally.

import { v4 as uuidv4 }                        from 'uuid';
import { collection, getDocs, query, where }   from 'firebase/firestore';
import { db }                                   from './firebase';
import { idbGetAll, idbGet, idbPut, idbPutMany } from './indexedDB';
import { writeRecord }                           from './syncService';

export function generateStudentCode(schoolCode, count) {
  return `${schoolCode}-${String(count + 1).padStart(4, '0')}`;
}

// ── READ HELPERS WITH FIRESTORE FALLBACK ──────────────────────────

async function fetchFromFirestore(collectionName, schoolId) {
  try {
    const q    = query(collection(db, collectionName), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (records.length > 0) await idbPutMany(collectionName, records);
    return records;
  } catch (err) {
    console.error(`[Student] Firestore fallback failed for ${collectionName}:`, err.message);
    return [];
  }
}

export async function getStudents(schoolId) {
  const local = await idbGetAll('students', 'schoolId', schoolId);
  // If IDB empty and online, fetch from Firestore (cache-clear recovery)
  if (local.length === 0 && navigator.onLine) {
    return fetchFromFirestore('students', schoolId);
  }
  return local;
}

export async function getStudent(id) {
  return idbGet('students', id);
}

// ── CREATE / UPDATE ───────────────────────────────────────────────

export async function createStudent(schoolId, data, schoolCode, existingCount) {
  const id          = uuidv4();
  const studentCode = generateStudentCode(schoolCode, existingCount);
  const student = {
    id,
    schoolId,
    studentCode,
    firstName:     data.firstName.trim(),
    lastName:      data.lastName.trim(),
    dateOfBirth:   data.dateOfBirth   || '',
    gender:        data.gender        || 'Male',
    guardianName:  data.guardianName  || '',
    guardianPhone: data.guardianPhone || '',
    address:       data.address       || '',
    photo:         data.photo         || '',
    status:        'active',
    createdAt:     Date.now(),
  };
  // writeRecord writes to IDB AND Firestore simultaneously
  await writeRecord('students', id, student, schoolId);
  return student;
}

export async function updateStudent(schoolId, id, data) {
  const existing = await idbGet('students', id);
  if (!existing) {
    // Try Firestore if not in IDB
    const { getDoc, doc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'students', id));
    if (!snap.exists()) throw new Error('Student not found');
    const fromFirestore = { id: snap.id, ...snap.data() };
    await idbPut('students', fromFirestore);
    const updated = { ...fromFirestore, ...data, updatedAt: Date.now() };
    await writeRecord('students', id, updated, schoolId);
    return updated;
  }
  const updated = { ...existing, ...data, updatedAt: Date.now() };
  await writeRecord('students', id, updated, schoolId);
  return updated;
}

export async function importStudentsFromArray(schoolId, rows, schoolCode, existingCount) {
  const results = { success: [], errors: [] };
  let count = existingCount;
  for (const row of rows) {
    try {
      if (!row.firstName || !row.lastName) throw new Error('Missing name');
      const student = await createStudent(schoolId, row, schoolCode, count);
      results.success.push(student);
      count++;
    } catch (err) {
      results.errors.push({ row, error: err.message });
    }
  }
  return results;
}

// ── ENROLLMENTS ───────────────────────────────────────────────────

export async function getEnrollments(schoolId, filters = {}) {
  let local = await idbGetAll('enrollments', 'schoolId', schoolId);
  // Fallback to Firestore if IDB empty
  if (local.length === 0 && navigator.onLine) {
    local = await fetchFromFirestore('enrollments', schoolId);
  }
  if (filters.classId)      local = local.filter(e => e.classId      === filters.classId);
  if (filters.academicYear) local = local.filter(e => e.academicYear === filters.academicYear);
  if (filters.term)         local = local.filter(e => e.term         === filters.term);
  if (filters.status)       local = local.filter(e => e.status       === filters.status);
  if (filters.studentId)    local = local.filter(e => e.studentId    === filters.studentId);
  return local;
}

export async function enrollStudent(schoolId, studentId, classId, academicYear, term) {
  const existing = await getEnrollments(schoolId, { studentId, academicYear, term });
  const active   = existing.find(e => e.status === 'active');
  if (active) throw new Error('Student already enrolled for this term');

  const id         = uuidv4();
  const enrollment = {
    id, schoolId, studentId, classId,
    academicYear, term,
    status:     'active',
    enrolledAt: Date.now(),
  };
  await writeRecord('enrollments', id, enrollment, schoolId);
  return enrollment;
}

export async function updateEnrollmentStatus(schoolId, enrollmentId, status) {
  let enrollment = await idbGet('enrollments', enrollmentId);
  if (!enrollment && navigator.onLine) {
    const { getDoc, doc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'enrollments', enrollmentId));
    if (!snap.exists()) throw new Error('Enrollment not found');
    enrollment = { id: snap.id, ...snap.data() };
    await idbPut('enrollments', enrollment);
  }
  if (!enrollment) throw new Error('Enrollment not found');
  const updated = { ...enrollment, status, updatedAt: Date.now() };
  await writeRecord('enrollments', enrollmentId, updated, schoolId);
  return updated;
}

// ── REMOVE STUDENT ─────────────────────────────────────────────────
// Soft-delete: marks the student as 'withdrawn' rather than hard-deleting
// the Firestore document. This preserves their score and result history
// (Firestore rules block hard delete on students for this exact reason —
// removing a student record would orphan their past scores/results).
// Also withdraws their active enrollment so they disappear from class
// rosters and score entry grids going forward.
export async function removeStudent(schoolId, studentId) {
  const student = await idbGet('students', studentId);
  if (!student) throw new Error('Student not found');

  // Mark student as withdrawn
  const updated = { ...student, status: 'withdrawn', withdrawnAt: Date.now() };
  await writeRecord('students', studentId, updated, schoolId);

  // Withdraw any active enrollment for this student too
  const enrollments = await getEnrollments(schoolId, { studentId, status: 'active' });
  for (const enr of enrollments) {
    await updateEnrollmentStatus(schoolId, enr.id, 'withdrawn');
  }

  return updated;
}
