// src/services/scoreService.js
import { v4 as uuidv4 } from 'uuid';
import { idbGetAll, idbGet } from './indexedDB';
import { writeRecord } from './syncService';

// Score CRUD
export async function getScores(schoolId, filters = {}) {
  let all = await idbGetAll('scores', 'schoolId', schoolId);
  if (filters.enrollmentId) all = all.filter(s => s.enrollmentId === filters.enrollmentId);
  if (filters.subjectId) all = all.filter(s => s.subjectId === filters.subjectId);
  if (filters.classId) all = all.filter(s => s.classId === filters.classId);
  if (filters.academicYear) all = all.filter(s => s.academicYear === filters.academicYear);
  if (filters.term) all = all.filter(s => s.term === filters.term);
  return all;
}

export async function saveScore(schoolId, data) {
  // data: { enrollmentId, studentId, classId, subjectId, academicYear, term, classScore, examScore, components }
  const existing = await getScores(schoolId, {
    enrollmentId: data.enrollmentId,
    subjectId: data.subjectId
  });
  
  const id = existing.length > 0 ? existing[0].id : uuidv4();
  const score = {
    id,
    schoolId,
    ...data,
    total: calculateTotal(data),
    updatedAt: Date.now(),
    isFinalized: false
  };
  await writeRecord('scores', id, score, schoolId);
  return score;
}

export async function saveBatchScores(schoolId, scoresArray) {
  return Promise.all(scoresArray.map(s => saveScore(schoolId, s)));
}

function calculateTotal(scoreData) {
  const { classScore = 0, examScore = 0, components = {} } = scoreData;
  const componentTotal = Object.values(components).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return Number(classScore) + Number(examScore) + componentTotal;
}

// RESULT ENGINE
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
    { min: 80, max: 100, grade: 'A1', remarks: 'Excellent', isPassing: true },
    { min: 75, max: 79,  grade: 'B2', remarks: 'Very Good', isPassing: true },
    { min: 70, max: 74,  grade: 'B3', remarks: 'Good',      isPassing: true },
    { min: 65, max: 69,  grade: 'C4', remarks: 'Credit',    isPassing: true },
    { min: 60, max: 64,  grade: 'C5', remarks: 'Credit',    isPassing: true },
    { min: 55, max: 59,  grade: 'C6', remarks: 'Credit',    isPassing: true },
    { min: 50, max: 54,  grade: 'D7', remarks: 'Pass',      isPassing: true },
    { min: 45, max: 49,  grade: 'E8', remarks: 'Pass',      isPassing: true },
    { min: 40, max: 44,  grade: 'F9', remarks: 'Fail',      isPassing: false },
    { min: 0,  max: 39,  grade: 'F9', remarks: 'Fail',      isPassing: false }
  ];
}

// Generate results for a class/term
export async function generateResults(schoolId, classId, academicYear, term, gradingScale) {
  const scale = gradingScale || defaultGradingScale();
  
  // Get all active enrollments for this class/term
  const { idbGetAll: getAll } = await import('./indexedDB');
  const allEnrollments = await getAll('enrollments', 'schoolId', schoolId);
  const enrollments = allEnrollments.filter(e =>
    e.classId === classId &&
    e.academicYear === academicYear &&
    e.term === term &&
    e.status === 'active'
  );

  if (enrollments.length === 0) throw new Error('No active enrollments found');

  // Get all scores for this class/term
  const allScores = await getScores(schoolId, { classId, academicYear, term });

  // Get subjects for this class
  const allSubjects = await getAll('subjects', 'schoolId', schoolId);
  const classSubjects = allSubjects.filter(s => s.classIds?.includes(classId));

  // Build result per student
  const studentResults = [];

  for (const enrollment of enrollments) {
    const studentScores = allScores.filter(s => s.enrollmentId === enrollment.id);
    const subjectResults = [];
    let totalScore = 0;
    let subjectCount = 0;

    for (const subject of classSubjects) {
      const score = studentScores.find(s => s.subjectId === subject.id);
      const rawTotal = score ? score.total : 0;
      const gradeInfo = applyGradingScale(rawTotal, scale);
      subjectResults.push({
        subjectId: subject.id,
        subjectName: subject.name,
        classScore: score?.classScore || 0,
        examScore: score?.examScore || 0,
        total: rawTotal,
        ...gradeInfo
      });
      totalScore += rawTotal;
      subjectCount++;
    }

    const average = subjectCount > 0 ? (totalScore / subjectCount) : 0;
    studentResults.push({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      totalScore,
      average: parseFloat(average.toFixed(2)),
      subjectResults,
      position: 0 // will be set after sorting
    });
  }

  // Sort by average descending and assign positions
  studentResults.sort((a, b) => b.average - a.average);
  studentResults.forEach((r, i) => { r.position = i + 1; });

  // Persist results
  const savedResults = [];
  for (const result of studentResults) {
    const id = uuidv4();
    const resultDoc = {
      id,
      schoolId,
      classId,
      academicYear,
      term,
      ...result,
      generatedAt: Date.now(),
      isFinalized: false
    };
    await writeRecord('results', id, resultDoc, schoolId);
    savedResults.push(resultDoc);
  }

  // Store analytics snapshot
  await storeAnalyticsSnapshot(schoolId, classId, academicYear, term, savedResults, classSubjects);

  return savedResults;
}

// Check existing result for an enrollment
export async function getResultForEnrollment(schoolId, enrollmentId) {
  const all = await idbGetAll('results', 'schoolId', schoolId);
  return all.find(r => r.enrollmentId === enrollmentId) || null;
}

export async function getResultsForClass(schoolId, classId, academicYear, term) {
  const all = await idbGetAll('results', 'schoolId', schoolId);
  return all.filter(r =>
    r.classId === classId &&
    r.academicYear === academicYear &&
    r.term === term
  );
}

export async function finalizeResults(schoolId, classId, academicYear, term) {
  const results = await getResultsForClass(schoolId, classId, academicYear, term);
  for (const r of results) {
    await writeRecord('results', r.id, { ...r, isFinalized: true }, schoolId);
  }
}

// Analytics snapshot storage
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

  const snapshot = {
    id: `analytics_${classId}_${academicYear}_${term}`,
    schoolId,
    classId,
    academicYear,
    term,
    classAverage: parseFloat(classAverage.toFixed(2)),
    studentCount: results.length,
    gradeDistribution,
    subjectAverages,
    topStudents: results.slice(0, 10).map(r => ({ studentId: r.studentId, average: r.average, position: r.position })),
    createdAt: Date.now()
  };

  await writeRecord('analytics', snapshot.id, snapshot, schoolId);
  return snapshot;
}
