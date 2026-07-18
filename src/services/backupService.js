// src/services/backupService.js
import * as XLSX from 'xlsx';
import { idbGetAll, idbPutMany, idbClear } from './indexedDB';
import { writeRecord } from './syncService';
import { v4 as uuidv4 } from 'uuid';
import { db } from './firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';

const BACKUP_COLLECTIONS = [
  'students', 'enrollments', 'teachers', 'classes',
  'subjects', 'scores', 'results', 'promotions', 'analytics'
];

// ── DATABASE STATUS ──────────────────────────────────────────────
// Correct, CURRENT counts for the Backup & Recovery page. This used to
// read from a global, unscoped IndexedDB count (getDBStats) — which
// silently included every school ever cached on that device/browser,
// not just the current one, and could be stale relative to Firestore.
//
// This version is always scoped to the current schoolId, and — when
// online — asks Firestore directly for a live server-side count
// (getCountFromServer is a cheap aggregation query, not a full read),
// so what's shown is the real, current state of the database rather
// than a local cache that might be out of date. Offline, it falls back
// to the local per-school cache and says so clearly.
export async function getSchoolDataStatus(schoolId) {
  if (!schoolId) return { counts: {}, source: 'none', asOf: Date.now() };

  if (navigator.onLine) {
    try {
      const counts = {};
      for (const col of BACKUP_COLLECTIONS) {
        const snap = await getCountFromServer(
          query(collection(db, col), where('schoolId', '==', schoolId))
        );
        counts[col] = snap.data().count;
      }
      return { counts, source: 'live', asOf: Date.now() };
    } catch (err) {
      console.warn('[Backup] Live count failed, falling back to local cache:', err.message);
      // fall through to local counts below
    }
  }

  const counts = {};
  for (const col of BACKUP_COLLECTIONS) {
    const rows = await idbGetAll(col, 'schoolId', schoolId);
    counts[col] = rows.length;
  }
  return { counts, source: 'cache', asOf: Date.now() };
}

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

// ── STUDENT IMPORT TEMPLATE ───────────────────────────────────────
// Generates and downloads a pre-formatted Excel template that schools
// fill in with their students and upload via Import Excel.
// Matches exactly the columns that importStudentsFromExcel() reads.
export function downloadStudentImportTemplate() {
  // ── COLUMN DEFINITIONS ─────────────────────────────────────────
  // Order must match importStudentsFromExcel() expectations.
  const COLS = [
    { header: 'First Name',     width: 18, required: true,  example1: 'Kwame',              example2: 'Abena',       example3: 'Kofi'         },
    { header: 'Last Name',      width: 18, required: true,  example1: 'Mensah',             example2: 'Asante',      example3: 'Boateng'      },
    { header: 'Gender',         width: 12, required: true,  example1: 'Male',               example2: 'Female',      example3: 'Male'         },
    { header: 'Date of Birth',  width: 16, required: false, example1: '15/08/2012',         example2: '22/03/2011',  example3: '05/11/2010'   },
    { header: 'Guardian Name',  width: 22, required: false, example1: 'Mr Isaac Mensah',    example2: 'Mrs Grace Asante', example3: 'Mr Samuel Boateng' },
    { header: 'Guardian Phone', width: 18, required: false, example1: '0244123456',         example2: '0541987654',  example3: '0208765432'   },
    { header: 'Address',        width: 26, required: false, example1: 'Kasoa, Central Region', example2: 'Accra, Greater Accra', example3: 'Kumasi, Ashanti' },
  ];

  // ── BUILD WORKBOOK ─────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ── SHEET 1: Template (the one they fill in) ──────────────────
  const sheetData = [
    // Row 1: title row (merged visually via header style)
    ['SchoolPilot — Student Import Template — Fill from Row 5 downwards. Do NOT rename the headers in Row 4.'],
    // Row 2: column key
    ['🔴 Red header = Required    🟢 Green header = Optional (leave blank if not known)'],
    // Row 3: blank spacer
    [],
    // Row 4: column headers
    COLS.map(c => c.header),
    // Rows 5-7: example students (light grey, labelled)
    COLS.map(c => c.example1),
    COLS.map(c => c.example2),
    COLS.map(c => c.example3),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = COLS.map(c => ({ wch: c.width }));

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS.length - 1 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  // ── SHEET 2: Instructions ─────────────────────────────────────
  const instrData = [
    ['SchoolPilot Student Import — How to Use This Template'],
    [''],
    ['STEP 1 — Open the "Students" sheet (the other tab)'],
    ['• Rows 5, 6, 7 are examples — delete them or type over them.'],
    ['• Add one student per row starting from Row 5.'],
    ['• You can add up to 500 students in one import.'],
    [''],
    ['STEP 2 — Required columns (must be filled for every student)'],
    ['• First Name     — the student first name'],
    ['• Last Name      — the student surname / family name'],
    ['• Gender         — type exactly:  Male  or  Female  or  Other'],
    [''],
    ['STEP 3 — Optional columns (leave blank if not known)'],
    ['• Date of Birth   — format: DD/MM/YYYY  e.g.  15/08/2012'],
    ['• Guardian Name  — parent or guardian full name'],
    ['• Guardian Phone — Ghana mobile number, 10 digits  e.g. 0244123456'],
    ['• Address        — home address or area  e.g. Kasoa, Central Region'],
    [''],
    ['STEP 4 — Save the file as Excel (.xlsx)'],
    ['• File → Save As → choose "Excel Workbook (.xlsx)"'],
    ['• Do NOT save as .csv or .xls'],
    [''],
    ['STEP 5 — Upload in SchoolPilot'],
    ['• Go to Students page → click "⬇ Get Template / ⬆ Import Excel"'],
    ['• Select your saved file'],
    ['• A preview appears — review it'],
    ['• Click Confirm Import'],
    ['• Students are created and enrolled in the class you select'],
    [''],
    ['COMMON MISTAKES'],
    ['✗  Do not leave First Name or Last Name blank — those rows are skipped'],
    ['✗  Gender must be in English: Male / Female / Other'],
    ['✗  Do not rename the column headers'],
    ['✗  Do not save as .csv — save as .xlsx only'],
    ['✗  Do not put two students in one row'],
    [''],
    ['NEED HELP?'],
    ['WhatsApp: 0549548274   |   Email: schoolpilot132@gmail.com'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(instrData);
  ws2['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // ── SHEET 3: Sample — 10 pre-filled students ──────────────────
  const sampleData = [
    COLS.map(c => c.header),
    ['Kwame',   'Mensah',   'Male',   '15/08/2012', 'Mr Isaac Mensah',     '0244123456', 'Kasoa, Central Region'],
    ['Abena',   'Asante',   'Female', '22/03/2011', 'Mrs Grace Asante',    '0541987654', 'Accra, Greater Accra'],
    ['Kofi',    'Boateng',  'Male',   '05/11/2010', 'Mr Samuel Boateng',   '0208765432', 'Kumasi, Ashanti Region'],
    ['Ama',     'Owusu',    'Female', '18/07/2013', 'Mrs Akua Owusu',      '0243001122', 'Takoradi, Western Region'],
    ['Yaw',     'Agyeman',  'Male',   '30/01/2012', 'Mr Kofi Agyeman',     '0554321098', 'Tema, Greater Accra'],
    ['Akosua',  'Darko',    'Female', '11/09/2011', 'Mrs Esi Darko',       '0201234567', 'Cape Coast, Central Region'],
    ['Kwabena', 'Antwi',    'Male',   '25/04/2013', 'Mr Yaw Antwi',        '0249876543', 'Sunyani, Bono Region'],
    ['Adwoa',   'Frimpong', 'Female', '08/12/2012', 'Mrs Adwoa Frimpong',  '0501122334', 'Ho, Volta Region'],
    ['Kojo',    'Amoah',    'Male',   '14/06/2011', 'Mr Kojo Amoah',       '0244556677', 'Wa, Upper West Region'],
    ['Efua',    'Tetteh',   'Female', '03/02/2013', 'Mrs Efua Tetteh',     '0208899001', 'Accra, Greater Accra'],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(sampleData);
  ws3['!cols'] = COLS.map(c => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws3, 'Sample — 10 Students');

  // ── DOWNLOAD ──────────────────────────────────────────────────
  XLSX.writeFile(wb, 'SchoolPilot_Student_Import_Template.xlsx');
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
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];

        // The template has 3 header rows before the column names:
        //   Row 1 — title banner
        //   Row 2 — subtitle / key
        //   Row 3 — legend (red/green explanation)
        //   Row 4 — actual column headers  ← range: 3 (0-indexed)
        // If the file has NO header rows (plain list starting row 1),
        // sheet_to_json still works because it finds 'First Name' on row 1.
        // We try range:3 first; if that yields no 'First Name' column we
        // fall back to range:0 so plain files still import correctly.

        let rows = XLSX.utils.sheet_to_json(ws, { range: 3, defval: '' });

        // Fallback: if 'First Name' not found at range:3, try from row 1
        const hasHeaders = rows.length > 0 &&
          ('First Name' in rows[0] || 'firstName' in rows[0]);
        if (!hasHeaders) {
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        }

        // Filter out example/blank rows — skip rows where both
        // First Name and Last Name are empty
        const students = rows
          .map(row => ({
            firstName:    (row['First Name']    || row['firstName']    || '').toString().trim(),
            lastName:     (row['Last Name']     || row['lastName']     || '').toString().trim(),
            dateOfBirth:  (row['Date of Birth'] || row['dateOfBirth']  || '').toString().trim(),
            gender:       (row['Gender']        || row['gender']       || '').toString().trim(),
            guardianName: (row['Guardian Name'] || row['guardianName'] || '').toString().trim(),
            guardianPhone:(row['Guardian Phone']|| row['guardianPhone']|| '').toString().trim(),
            address:      (row['Address']       || row['address']      || '').toString().trim(),
          }))
          .filter(s => s.firstName && s.lastName); // skip blank/example rows

        resolve(students);
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
