// src/services/studentService.js
import { v4 as uuidv4 } from 'uuid';
import { idbGetAll, idbGet, idbPut } from './indexedDB';
import { writeRecord, deleteRecord } from './syncService';

export function generateStudentCode(schoolCode, count) {
  return `${schoolCode}-${String(count + 1).padStart(4, '0')}`;
}

export async function getStudents(schoolId) {
  return idbGetAll('students', 'schoolId', schoolId);
}

export async function getStudent(id) {
  return idbGet('students', id);
}

export async function createStudent(schoolId, data, schoolCode, existingCount) {
  const id = uuidv4();
  const studentCode = generateStudentCode(schoolCode, existingCount);
  const student = {
    id,
    schoolId,
    studentCode,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    guardianName: data.guardianName || '',
    guardianPhone: data.guardianPhone || '',
    address: data.address || '',
    photo: data.photo || '',
    status: 'active',
    createdAt: Date.now()
  };
  await writeRecord('students', id, student, schoolId);
  return student;
}

export async function updateStudent(schoolId, id, data) {
  const existing = await idbGet('students', id);
  if (!existing) throw new Error('Student not found');
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

// Enrollment
export async function getEnrollments(schoolId, filters = {}) {
  let all = await idbGetAll('enrollments', 'schoolId', schoolId);
  if (filters.classId) all = all.filter(e => e.classId === filters.classId);
  if (filters.academicYear) all = all.filter(e => e.academicYear === filters.academicYear);
  if (filters.term) all = all.filter(e => e.term === filters.term);
  if (filters.status) all = all.filter(e => e.status === filters.status);
  if (filters.studentId) all = all.filter(e => e.studentId === filters.studentId);
  return all;
}

export async function enrollStudent(schoolId, studentId, classId, academicYear, term) {
  // Check for existing active enrollment in this year/term
  const existing = await getEnrollments(schoolId, { studentId, academicYear, term });
  const active = existing.find(e => e.status === 'active');
  if (active) throw new Error('Student already enrolled for this term');

  const id = uuidv4();
  const enrollment = {
    id,
    schoolId,
    studentId,
    classId,
    academicYear,
    term,
    status: 'active',
    enrolledAt: Date.now()
  };
  await writeRecord('enrollments', id, enrollment, schoolId);
  return enrollment;
}

export async function updateEnrollmentStatus(schoolId, enrollmentId, status) {
  const enrollment = await idbGet('enrollments', enrollmentId);
  if (!enrollment) throw new Error('Enrollment not found');
  const updated = { ...enrollment, status, updatedAt: Date.now() };
  await writeRecord('enrollments', enrollmentId, updated, schoolId);
  return updated;
}
