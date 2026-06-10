// src/services/promotionService.js
import { v4 as uuidv4 } from 'uuid';
import { idbGetAll, idbGet } from './indexedDB';
import { writeRecord, deleteRecord } from './syncService';
import { getResultsForClass, finalizeResults } from './scoreService';

export const PROMOTION_STATUS = {
  PROMOTE: 'promote',
  REPEAT: 'repeat',
  CONDITIONAL: 'conditional',
  GRADUATED: 'graduated'
};

export const DEFAULT_PROMOTION_RULES = {
  promoteThreshold: 50,
  conditionalMin: 40,
  conditionalMax: 49,
  repeatBelow: 40
};

// STEP 1: VALIDATION
export async function validatePromotionReadiness(schoolId, classId, academicYear, term) {
  const errors = [];
  const warnings = [];

  // Check results are finalized
  const results = await getResultsForClass(schoolId, classId, academicYear, term);
  if (results.length === 0) {
    errors.push('No results found for this class/term. Generate and finalize results first.');
  }

  const unfinalized = results.filter(r => !r.isFinalized);
  if (unfinalized.length > 0) {
    errors.push(`${unfinalized.length} result(s) are not finalized. Finalize all results before promoting.`);
  }

  // Check all active enrollments have results
  const allEnrollments = await idbGetAll('enrollments', 'schoolId', schoolId);
  const activeEnrollments = allEnrollments.filter(
    e => e.classId === classId && e.academicYear === academicYear && e.term === term && e.status === 'active'
  );

  const enrollmentsWithResults = new Set(results.map(r => r.enrollmentId));
  const missing = activeEnrollments.filter(e => !enrollmentsWithResults.has(e.id));
  if (missing.length > 0) {
    errors.push(`${missing.length} student(s) have no results. All students must have results.`);
  }

  // Check term is not already promoted
  const existingPromo = await getPromotionAudit(schoolId, classId, academicYear, term);
  if (existingPromo.length > 0) {
    errors.push('This class/term has already been promoted. Cannot promote twice.');
  }

  return { valid: errors.length === 0, errors, warnings, resultCount: results.length };
}

// STEP 2: PREVIEW — determine what happens to each student
export async function buildPromotionPreview(
  schoolId, classId, nextClassId, academicYear, term,
  nextAcademicYear, nextTerm, rules = DEFAULT_PROMOTION_RULES, isLastClass = false
) {
  const results = await getResultsForClass(schoolId, classId, academicYear, term);
  const allStudents = await idbGetAll('students', 'schoolId', schoolId);
  const studentMap = Object.fromEntries(allStudents.map(s => [s.id, s]));

  const allClasses = await idbGetAll('classes', 'schoolId', schoolId);
  const classMap = Object.fromEntries(allClasses.map(c => [c.id, c]));
  const currentClass = classMap[classId];
  const nextClass = nextClassId ? classMap[nextClassId] : null;

  const preview = results.map(result => {
    const student = studentMap[result.studentId];
    let decision;

    if (isLastClass) {
      decision = PROMOTION_STATUS.GRADUATED;
    } else if (result.average >= rules.promoteThreshold) {
      decision = PROMOTION_STATUS.PROMOTE;
    } else if (result.average >= rules.conditionalMin) {
      decision = PROMOTION_STATUS.CONDITIONAL;
    } else {
      decision = PROMOTION_STATUS.REPEAT;
    }

    return {
      enrollmentId: result.enrollmentId,
      studentId: result.studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
      studentCode: student?.studentCode || '',
      currentClass: currentClass?.name || classId,
      nextClass: decision === PROMOTION_STATUS.PROMOTE || decision === PROMOTION_STATUS.GRADUATED
        ? (nextClass?.name || 'Graduated')
        : currentClass?.name,
      average: result.average,
      position: result.position,
      decision,
      overrideDecision: null // admin can override
    };
  });

  return {
    preview,
    summary: {
      total: preview.length,
      promote: preview.filter(p => p.decision === PROMOTION_STATUS.PROMOTE).length,
      repeat: preview.filter(p => p.decision === PROMOTION_STATUS.REPEAT).length,
      conditional: preview.filter(p => p.decision === PROMOTION_STATUS.CONDITIONAL).length,
      graduated: preview.filter(p => p.decision === PROMOTION_STATUS.GRADUATED).length
    }
  };
}

// STEP 3/4: EXECUTE PROMOTION (SAFE — creates new enrollments, marks old as complete)
export async function executePromotion(
  schoolId, classId, nextClassId, academicYear, term,
  nextAcademicYear, nextTerm, previewData, adminId, adminNote = ''
) {
  const promotionId = uuidv4();
  const timestamp = Date.now();
  const affectedStudents = [];

  for (const item of previewData.preview) {
    const effectiveDecision = item.overrideDecision || item.decision;

    // Mark old enrollment as completed
    const oldEnrollment = await idbGet('enrollments', item.enrollmentId);
    if (oldEnrollment) {
      await writeRecord('enrollments', item.enrollmentId, {
        ...oldEnrollment,
        status: 'completed',
        completedAt: timestamp,
        promotionId
      }, schoolId);
    }

    // Create new enrollment based on decision
    const newEnrollmentId = uuidv4();
    let newClassId, newStatus;

    if (effectiveDecision === PROMOTION_STATUS.PROMOTE) {
      newClassId = nextClassId;
      newStatus = 'active';
    } else if (effectiveDecision === PROMOTION_STATUS.GRADUATED) {
      // Mark student as graduated, no new enrollment
      const student = await idbGet('students', item.studentId);
      if (student) {
        await writeRecord('students', item.studentId, {
          ...student,
          status: 'graduated',
          graduatedAt: timestamp
        }, schoolId);
      }
      affectedStudents.push({ ...item, action: 'graduated' });
      continue;
    } else if (effectiveDecision === PROMOTION_STATUS.REPEAT) {
      newClassId = classId; // stay in same class
      newStatus = 'active';
    } else { // conditional
      newClassId = nextClassId;
      newStatus = 'conditional';
    }

    await writeRecord('enrollments', newEnrollmentId, {
      id: newEnrollmentId,
      schoolId,
      studentId: item.studentId,
      classId: newClassId,
      academicYear: nextAcademicYear,
      term: nextTerm,
      status: newStatus,
      promotionId,
      enrolledAt: timestamp
    }, schoolId);

    affectedStudents.push({
      ...item,
      action: effectiveDecision,
      newEnrollmentId,
      newClassId
    });
  }

  // STEP 5: AUDIT LOG
  const auditLog = {
    id: promotionId,
    schoolId,
    fromClassId: classId,
    toClassId: nextClassId,
    fromAcademicYear: academicYear,
    fromTerm: term,
    toAcademicYear: nextAcademicYear,
    toTerm: nextTerm,
    adminId,
    adminNote,
    timestamp,
    affectedStudents,
    summary: {
      total: affectedStudents.length,
      promoted: affectedStudents.filter(s => s.action === PROMOTION_STATUS.PROMOTE).length,
      repeated: affectedStudents.filter(s => s.action === PROMOTION_STATUS.REPEAT).length,
      conditional: affectedStudents.filter(s => s.action === PROMOTION_STATUS.CONDITIONAL).length,
      graduated: affectedStudents.filter(s => s.action === 'graduated').length
    }
  };

  await writeRecord('promotions', promotionId, auditLog, schoolId);
  return auditLog;
}

export async function getPromotionAudit(schoolId, classId, academicYear, term) {
  const all = await idbGetAll('promotions', 'schoolId', schoolId);
  if (classId) return all.filter(p => p.fromClassId === classId && p.fromAcademicYear === academicYear && p.fromTerm === term);
  return all;
}

export async function getAllPromotionAudits(schoolId) {
  return idbGetAll('promotions', 'schoolId', schoolId);
}
