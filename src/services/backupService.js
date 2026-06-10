// src/services/backupService.js
import * as XLSX from 'xlsx';
import { idbGetAll, idbPutMany, idbClear } from './indexedDB';
import { writeRecord } from './syncService';
import { v4 as uuidv4 } from 'uuid';

const BACKUP_COLLECTIONS = [
  'students', 'enrollments', 'teachers', 'classes',
  'subjects', 'scores', 'results', 'promotions', 'analytics'
];

// ── EXPORT ────────────────────────────────────────────────────────

export async function createBackupPackage(schoolId) {
  const pkg = { version: '1.0', schoolId, createdAt: new Date().toISOString(), collections: {} };

  for (const col of BACKUP_COLLECTIONS) {
    const data = await idbGetAll(col, 'schoolId', schoolId);
    pkg.collections[col] = data;
  }

  pkg.metadata = {
    counts: Object.fromEntries(
      Object.entries(pkg.collections).map(([k, v]) => [k, v.length])
    ),
    totalRecords: Object.values(pkg.collections).reduce((s, v) => s + v.length, 0)
  };

  return pkg;
}

export function exportAsJSON(pkg, filename) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename || `backup_${Date.now()}.json`);
}

export async function exportAsExcel(schoolId, filename) {
  const wb = XLSX.utils.book_new();

  for (const col of BACKUP_COLLECTIONS) {
    const data = await idbGetAll(col, 'schoolId', schoolId);
    if (data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, col.substring(0, 31));
    }
  }

  XLSX.writeFile(wb, filename || `backup_${Date.now()}.xlsx`);
}

export async function exportStudentsAsExcel(schoolId) {
  const students = await idbGetAll('students', 'schoolId', schoolId);
  const rows = students.map(s => ({
    'Student ID': s.studentCode,
    'First Name': s.firstName,
    'Last Name': s.lastName,
    'Date of Birth': s.dateOfBirth,
    Gender: s.gender,
    'Guardian Name': s.guardianName,
    'Guardian Phone': s.guardianPhone,
    Address: s.address,
    Status: s.status
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, `students_export_${Date.now()}.xlsx`);
}

export async function exportResultsAsExcel(schoolId, classId, academicYear, term) {
  const results = await idbGetAll('results', 'schoolId', schoolId);
  const filtered = results.filter(r =>
    r.classId === classId && r.academicYear === academicYear && r.term === term
  );
  const students = await idbGetAll('students', 'schoolId', schoolId);
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  const rows = filtered.map(r => {
    const student = studentMap[r.studentId];
    const base = {
      'Student ID': student?.studentCode || '',
      'First Name': student?.firstName || '',
      'Last Name': student?.lastName || '',
      'Total Score': r.totalScore,
      Average: r.average,
      Position: r.position
    };
    r.subjectResults?.forEach(sr => {
      base[`${sr.subjectName} (Total)`] = sr.total;
      base[`${sr.subjectName} (Grade)`] = sr.grade;
    });
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, `results_${academicYear}_term${term}.xlsx`);
}

// ── IMPORT ────────────────────────────────────────────────────────

export async function importStudentsFromExcel(file, schoolId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        resolve(rows.map(row => ({
          firstName: row['First Name'] || row['firstName'] || '',
          lastName: row['Last Name'] || row['lastName'] || '',
          dateOfBirth: row['Date of Birth'] || row['dateOfBirth'] || '',
          gender: row['Gender'] || row['gender'] || '',
          guardianName: row['Guardian Name'] || row['guardianName'] || '',
          guardianPhone: row['Guardian Phone'] || row['guardianPhone'] || '',
          address: row['Address'] || row['address'] || ''
        })));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function importScoresFromExcel(file, schoolId, classId, academicYear, term) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── RESTORE ───────────────────────────────────────────────────────

export async function previewRestore(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pkg = JSON.parse(e.target.result);
        if (!pkg.version || !pkg.schoolId || !pkg.collections) {
          throw new Error('Invalid backup file format');
        }
        resolve({ pkg, metadata: pkg.metadata, schoolId: pkg.schoolId });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function executeRestore(pkg, targetSchoolId, adminId) {
  const log = { id: uuidv4(), adminId, timestamp: Date.now(), action: 'restore', details: {} };

  for (const [col, records] of Object.entries(pkg.collections)) {
    if (!Array.isArray(records)) continue;

    // Remap schoolId if restoring to different school
    const remapped = records.map(r => ({ ...r, schoolId: targetSchoolId }));

    await idbPutMany(col, remapped);
    log.details[col] = remapped.length;

    // Enqueue all for Firestore sync
    for (const r of remapped) {
      await writeRecord(col, r.id, r, targetSchoolId);
    }
  }

  // Store restore audit log
  await writeRecord('backups', log.id, log, targetSchoolId);
  return log;
}

// ── SCHEDULED BACKUP ──────────────────────────────────────────────
// In a real system this would use a cron job or cloud scheduler.
// For browser-based, we store last backup time and prompt admin.

export async function getBackupSchedule(schoolId) {
  const stored = localStorage.getItem(`backup_schedule_${schoolId}`);
  return stored ? JSON.parse(stored) : { daily: true, weekly: true, monthly: true, lastBackup: null };
}

export function saveBackupSchedule(schoolId, schedule) {
  localStorage.setItem(`backup_schedule_${schoolId}`, JSON.stringify(schedule));
}

export function shouldRunBackup(schedule, type) {
  if (!schedule.lastBackup) return true;
  const last = new Date(schedule.lastBackup);
  const now = new Date();
  const diffDays = (now - last) / (1000 * 60 * 60 * 24);

  if (type === 'daily') return diffDays >= 1;
  if (type === 'weekly') return diffDays >= 7;
  if (type === 'monthly') return diffDays >= 30;
  return false;
}

// ── HELPERS ───────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
