// src/services/scoreService.js
//
// Bug fixes:
// 1. generateResults() - classSubjects now checks BOTH directions:
//    subject.classIds.includes(classId) OR class.subjectIds.includes(subjectId)
//    Previously only checked subject.classIds, so subjects assigned from the
//    Classes page (which sets class.subjectIds instead) were invisible to
//    report generation → only first subject showed in report.
//
// 2. generateResults() - results are now UPSERTED not always inserted.
//    If a result already exists for an enrollment in this class/year/term,
//    we REUSE its document ID (same as saveScore does for scores).
//    Previously, every "Generate Results" click created a NEW result doc with
//    a new uuidv4() ID, causing duplicate results → dashboard counted 2 students.
//
// 3. Scores fetched from Firestore directly (all teachers' input, all devices).

import { v4 as uuidv4 }  from 'uuid';
import { idbGetAll, idbGet, idbPutMany } from './indexedDB';
import { writeRecord, getScoresFromFirestore } from './syncService';
import { validateTeacherCanSubmit } from './assessmentService';

// ── SCORE CRUD ────────────────────────────────────────────────────

export async function getScores(schoolId, filters = {}) {
  let all = await idbGetAll('scores', 'schoolId', schoolId);
  if (filters.enrollmentId) all = all.filter(s => s.enrollmentId === filters.enrollmentId);
  if (filters.subjectId)    all = all.filter(s => s.subjectId    === filters.subjectId);
  if (filters.classId)      all = all.filter(s => s.classId      === filters.classId);
  if (filters.academicYear) all = all.filter(s => s.academicYear === filters.academicYear);
  if (filters.term)         all = all.filter(s => s.term         === filters.term);
  return all;
}

export async function saveScore(schoolId, data, options = {}) {
  if (options.userRole === 'teacher' && !options._skipDeadlineCheck) {
    await validateTeacherCanSubmit(
      schoolId,
      options.academicYear || data.academicYear,
      options.term         || data.term
    );
  }

  const existing = await getScores(schoolId, {
    enrollmentId: data.enrollmentId,
    subjectId:    data.subjectId,
  });

  if (existing.length > 0 && existing[0].isFinalized && options.userRole !== 'admin') {
    throw new Error('This assessment has been finalised and can no longer be edited.');
  }

  const id = existing.length > 0 ? existing[0].id : uuidv4();
  const score = {
    id, schoolId, ...data,
    total:       calculateTotal(data),
    updatedAt:   Date.now(),
    isFinalized: existing[0]?.isFinalized ?? false,
  };

  await writeRecord('scores', id, score, schoolId);
  return score;
}

export async function saveBatchScores(schoolId, scoresArray, options = {}) {
  if (options.userRole === 'teacher' && scoresArray.length > 0) {
    await validateTeacherCanSubmit(
      schoolId,
      options.academicYear || scoresArray[0].academicYear,
      options.term         || scoresArray[0].term
    );
  }
  return Promise.all(
    scoresArray.map(s => saveScore(schoolId, s, { ...options, _skipDeadlineCheck: true }))
  );
}

function calculateTotal(scoreData) {
  const { classScore = 0, examScore = 0, components = {} } = scoreData;
  const componentTotal = Object.values(components).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return Number(classScore) + Number(examScore) + componentTotal;
}

// ── GRADING SCALE ─────────────────────────────────────────────────

export function applyGradingScale(total, gradingScale) {
  for (const grade of gradingScale) {
    if (total >= grade.min && total <= grade.max) {
      return { grade: grade.grade, remarks: grade.remarks, isPassing: grade.isPassing };
    }
  }
  return { grade: 'N/A', remarks: 'Not graded', isPassing: false };
}

export function defaultGradingScale() {
  return [
    { min: 80, max: 100, grade: 'A1', remarks: 'Excellent',  isPassing: true  },
    { min: 75, max: 79,  grade: 'B2', remarks: 'Very Good',  isPassing: true  },
    { min: 70, max: 74,  grade: 'B3', remarks: 'Good',       isPassing: true  },
    { min: 65, max: 69,  grade: 'C4', remarks: 'Credit',     isPassing: true  },
    { min: 60, max: 64,  grade: 'C5', remarks: 'Credit',     isPassing: true  },
    { min: 55, max: 59,  grade: 'C6', remarks: 'Credit',     isPassing: true  },
    { min: 50, max: 54,  grade: 'D7', remarks: 'Pass',       isPassing: true  },
    { min: 45, max: 49,  grade: 'E8', remarks: 'Pass',       isPassing: true  },
    { min: 40, max: 44,  grade: 'F9', remarks: 'Fail',       isPassing: false },
    { min: 0,  max: 39,  grade: 'F9', remarks: 'Fail',       isPassing: false },
  ];
}

// ── RESULT ENGINE ─────────────────────────────────────────────────

export async function generateResults(schoolId, classId, academicYear, term, gradingScale) {
  const scale = gradingScale || defaultGradingScale();

  // ── 1. Load enrollments ──────────────────────────────────────
  const allEnrollments = await idbGetAll('enrollments', 'schoolId', schoolId);
  const enrollments    = allEnrollments.filter(e =>
    e.classId      === classId &&
    e.academicYear === academicYear &&
    e.term         === term &&
    e.status       === 'active'
  );

  if (enrollments.length === 0) throw new Error('No active enrollments found for this class/term.');

  // ── 2. Load scores from Firestore (guaranteed fresh, all teachers) ──
  const allScores = navigator.onLine
    ? await getScoresFromFirestore(schoolId, classId, academicYear, term)
    : await getScores(schoolId, { classId, academicYear, term });

  // ── 3. Load subjects — check BOTH directions ──────────────────
  // Direction A: subject.classIds includes classId  (set from Subjects page)
  // Direction B: class.subjectIds  includes subjectId (set from Classes page)
  // Both directions must be checked so every assigned subject appears.
  const allSubjects = await idbGetAll('subjects', 'schoolId', schoolId);
  const allClasses  = await idbGetAll('classes',  'schoolId', schoolId);
  const thisClass   = allClasses.find(c => c.id === classId);

  const classSubjects = allSubjects.filter(s =>
    s.classIds?.includes(classId) ||              // assigned from Subjects page
    thisClass?.subjectIds?.includes(s.id)          // assigned from Classes page
  );

  if (classSubjects.length === 0) {
    throw new Error('No subjects assigned to this class. Assign subjects first in Classes or Subjects page.');
  }

  // ── 4. Load existing results for this class/year/term ────────
  // We index them by enrollmentId so we can UPSERT (reuse existing IDs).
  // This prevents duplicate result documents when Generate is clicked twice.
  const existingResults = await getResultsForClass(schoolId, classId, academicYear, term);
  const existingByEnrollment = {};
  existingResults.forEach(r => { existingByEnrollment[r.enrollmentId] = r; });

  // ── 5. Build results ─────────────────────────────────────────
  const studentResults = [];

  for (const enrollment of enrollments) {
    const studentScores  = allScores.filter(s => s.enrollmentId === enrollment.id);
    const subjectResults = [];
    let   totalScore     = 0;

    for (const subject of classSubjects) {
      const score    = studentScores.find(s => s.subjectId === subject.id);
      const rawTotal = score ? (score.total ?? calculateTotal(score)) : 0;
      const gradeInfo = applyGradingScale(rawTotal, scale);
      subjectResults.push({
        subjectId:   subject.id,
        subjectName: subject.name,
        classScore:  score?.classScore ?? 0,
        examScore:   score?.examScore  ?? 0,
        total:       rawTotal,
        ...gradeInfo,
      });
      totalScore += rawTotal;
    }

    const average = classSubjects.length > 0 ? totalScore / classSubjects.length : 0;
    studentResults.push({
      enrollmentId: enrollment.id,
      studentId:    enrollment.studentId,
      totalScore,
      average:      parseFloat(average.toFixed(2)),
      subjectResults,
      position:     0,
    });
  }

  // Sort by average descending, assign positions
  studentResults.sort((a, b) => b.average - a.average);
  studentResults.forEach((r, i) => { r.position = i + 1; });

  // ── 6. UPSERT results (reuse existing ID if present) ─────────
  // This is the fix for the duplicate student bug:
  // If a result already exists for this enrollment, we update it
  // in-place instead of creating a new document with a new ID.
  const savedResults = [];
  for (const result of studentResults) {
    const existing  = existingByEnrollment[result.enrollmentId];
    const id        = existing?.id || uuidv4();   // ← reuse ID if exists
    const resultDoc = {
      id, schoolId, classId, academicYear, term,
      ...result,
      generatedAt:  Date.now(),
      isFinalized:  existing?.isFinalized ?? false,  // preserve finalized state
    };
    await writeRecord('results', id, resultDoc, schoolId);
    savedResults.push(resultDoc);
  }

  // ── 7. Analytics snapshot ─────────────────────────────────────
  await storeAnalyticsSnapshot(schoolId, classId, academicYear, term, savedResults, classSubjects);

  return savedResults;
}

// ── READ HELPERS ─────────────────────────────────────────────────

export async function getResultForEnrollment(schoolId, enrollmentId) {
  const all = await idbGetAll('results', 'schoolId', schoolId);
  return all.find(r => r.enrollmentId === enrollmentId) || null;
}

export async function getResultsForClass(schoolId, classId, academicYear, term) {
  let all = await idbGetAll('results', 'schoolId', schoolId);
  all = all.filter(r =>
    r.classId      === classId &&
    r.academicYear === academicYear &&
    r.term         === term
  );

  // Deduplicate by enrollmentId — keep only the most recent per student.
  // This cleans up any duplicates that may have been created before this fix.
  const seen = {};
  const deduped = [];
  for (const r of all.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0))) {
    if (!seen[r.enrollmentId]) {
      seen[r.enrollmentId] = true;
      deduped.push(r);
    }
  }
  return deduped;
}

export async function finalizeResults(schoolId, classId, academicYear, term) {
  const results = await getResultsForClass(schoolId, classId, academicYear, term);
  for (const r of results) {
    await writeRecord('results', r.id, { ...r, isFinalized: true }, schoolId);
  }
}

// ── ANALYTICS ─────────────────────────────────────────────────────

async function storeAnalyticsSnapshot(schoolId, classId, academicYear, term, results, subjects) {
  const classAverage = results.reduce((s, r) => s + r.average, 0) / (results.length || 1);

  const gradeDistribution = {};
  results.forEach(r => {
    r.subjectResults.forEach(sr => {
      gradeDistribution[sr.grade] = (gradeDistribution[sr.grade] || 0) + 1;
    });
  });

  const subjectAverages = subjects.map(sub => {
    const totals = results.map(r => {
      const sr = r.subjectResults.find(s => s.subjectId === sub.id);
      return sr ? sr.total : 0;
    });
    const avg = totals.reduce((s, v) => s + v, 0) / (totals.length || 1);
    return { subjectId: sub.id, subjectName: sub.name, average: parseFloat(avg.toFixed(2)) };
  });

  // Analytics uses a deterministic ID (no uuidv4) so it also upserts
  const snapshot = {
    id: `analytics_${classId}_${academicYear}_${term}`.replace(/\//g, '-'),
    schoolId, classId, academicYear, term,
    classAverage:      parseFloat(classAverage.toFixed(2)),
    studentCount:      results.length,
    gradeDistribution,
    subjectAverages,
    topStudents: results.slice(0, 10).map(r => ({
      studentId: r.studentId, average: r.average, position: r.position,
    })),
    createdAt: Date.now(),
  };

  await writeRecord('analytics', snapshot.id, snapshot, schoolId);
  return snapshot;
}
