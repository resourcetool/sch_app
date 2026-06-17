// src/pages/Scores.jsx
//
// Fixes:
// 1. Teachers: subject auto-selected on mount (no manual selection needed).
//    If teacher has 1 subject → auto-selected, hidden from UI.
//    If teacher has 2+ subjects → shown as clickable tabs, not a dropdown.
//    Teacher only needs to pick CLASS — grid loads immediately.
// 2. Admin: both class and subject dropdowns still shown (full control).
// 3. getSubjectsForClass() checks both directions so subjects always appear.
// 4. Permission errors shown clearly with guidance.
// 5. Admin: remove user button in All Submissions tab.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import { getEnrollments, getStudents } from '../services/studentService';
import {
  getScores, saveBatchScores,
  defaultGradingScale, applyGradingScale,
} from '../services/scoreService';
import {
  getAssessmentDeadline, checkDeadlineStatus,
  adminEditScore, adminDeleteScore, adminApproveScore,
  getAllSchoolScores,
} from '../services/assessmentService';

// ── GRADE COLOUR ─────────────────────────────────────────────────
function gradeColor(grade) {
  if (!grade || grade === 'N/A') return { bg: '#f8f9fa', color: '#999' };
  const g = grade.charAt(0);
  if (g === 'A') return { bg: '#d4edda', color: '#155724' };
  if (g === 'B') return { bg: '#cce5ff', color: '#004085' };
  if (g === 'C') return { bg: '#fff3cd', color: '#856404' };
  if (g === 'D' || g === 'E') return { bg: '#ffeeba', color: '#7d5a00' };
  return { bg: '#f8d7da', color: '#721c24' };
}

// ── DEADLINE BANNER ──────────────────────────────────────────────
function DeadlineBanner({ deadline }) {
  if (!deadline) return null;
  const { allowed, reason } = checkDeadlineStatus(deadline);
  if (!allowed) return (
    <div className="alert alert-danger" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '1.2rem' }}>🔒</span>
      <div><strong>Entry Closed</strong><div style={{ fontSize: '.84rem', marginTop: 2 }}>{reason}</div></div>
    </div>
  );
  if (deadline.closeAt) return (
    <div className="alert alert-warning" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>⏰</span>
      <span><strong>Deadline:</strong> {new Date(deadline.closeAt).toLocaleString()}</span>
    </div>
  );
  return null;
}

// ── ADMIN EDIT MODAL ─────────────────────────────────────────────
function AdminEditModal({ score, schoolId, userProfile, onClose, onSaved }) {
  const [classScore, setClassScore] = useState(score.classScore ?? 0);
  const [examScore,  setExamScore]  = useState(score.examScore  ?? 0);
  const [reason,     setReason]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await adminEditScore(score.id, schoolId,
        { classScore: Number(classScore), examScore: Number(examScore) },
        { uid: userProfile.id, email: userProfile.email }, reason);
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Score (Admin)</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Class Score</label>
                <input type="number" min="0" step="0.5" value={classScore} onChange={e => setClassScore(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Exam Score</label>
                <input type="number" min="0" step="0.5" value={examScore} onChange={e => setExamScore(e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Reason for Change</label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Data entry error corrected" />
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', marginTop: 8 }}>
              New total: <strong>{(Number(classScore)||0)+(Number(examScore)||0)}</strong> · Logged in audit trail.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── EXCEL SCORE GRID ─────────────────────────────────────────────
function ExcelScoreGrid({ enrollments, students, scores, setScores, maxClass, maxExam, gradingScale, disabled, onSave, saving, saved }) {
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const inputRefs  = useRef({});
  const total      = maxClass + maxExam;

  function updateScore(enrollmentId, field, value) {
    setScores(prev => {
      // Clamp to max before storing — prevents scores exceeding the allowed max
      const clampedValue = value === '' ? '' : Math.min(Math.max(0, Number(value)),
        field === 'classScore' ? maxClass : maxExam
      );
      const row = { ...prev[enrollmentId], [field]: clampedValue };
      const cs  = Number(row.classScore) || 0;
      const es  = Number(row.examScore)  || 0;
      return { ...prev, [enrollmentId]: { ...row, total: Math.min(cs + es, total) } };
    });
  }

  function handleKeyDown(e, rowIdx, col) {
    const rows = enrollments.length;
    let nextRow = rowIdx, nextCol = col;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) { nextCol = col === 'cs' ? 'es' : 'cs'; if (col === 'es') nextRow = Math.min(rowIdx + 1, rows - 1); }
      else             { nextCol = col === 'es' ? 'cs' : 'es'; if (col === 'cs') nextRow = Math.max(rowIdx - 1, 0); }
    } else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); nextRow = Math.min(rowIdx + 1, rows - 1); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); nextRow = Math.max(rowIdx - 1, 0); }
    else if (e.key === 'ArrowRight' && col === 'cs') { e.preventDefault(); nextCol = 'es'; }
    else if (e.key === 'ArrowLeft'  && col === 'es') { e.preventDefault(); nextCol = 'cs'; }
    else return;
    inputRefs.current[`${nextRow}-${nextCol}`]?.focus();
    inputRefs.current[`${nextRow}-${nextCol}`]?.select();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 8, flexWrap: 'wrap' }}>
        <span>⌨️ <strong>Tab</strong> next cell</span>
        <span><strong>Enter/↓</strong> next row</span>
        <span><strong>↑</strong> prev row</span>
        <span><strong>←→</strong> switch column</span>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
          <thead>
            <tr style={{ background: 'var(--navy)', color: '#fff', fontSize: '.78rem' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', width: 30, position: 'sticky', left: 0, background: 'var(--navy)', zIndex: 2 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 150, position: 'sticky', left: 30, background: 'var(--navy)', zIndex: 2 }}>Student</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 110 }}>Class Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxClass}</span></th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 110 }}>Exam Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxExam}</span></th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Total</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Grade</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 80 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enr, idx) => {
              const student   = studentMap[enr.studentId];
              const row       = scores[enr.id] || { classScore: '', examScore: '', total: 0 };
              const cs        = Number(row.classScore) || 0;
              const es        = Number(row.examScore)  || 0;
              const t         = (cs || es) ? Math.min(cs + es, total) : null;
              const gradeInfo = t !== null ? applyGradingScale(t, gradingScale) : null;
              const gc        = gradeInfo ? gradeColor(gradeInfo.grade) : { bg: '', color: '' };
              const rowBg     = idx % 2 === 0 ? '#fff' : '#f8f9ff';
              return (
                <tr key={enr.id} style={{ background: rowBg }}>
                  <td style={{ padding: '4px 10px', color: 'var(--text-lt)', fontSize: '.78rem', position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>{idx + 1}</td>
                  <td style={{ padding: '4px 10px', position: 'sticky', left: 30, background: rowBg, zIndex: 1, borderRight: '2px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '.86rem' }}>{student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-lt)' }}>{student?.studentCode || ''}</div>
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                    <input
                      ref={el => { inputRefs.current[`${idx}-cs`] = el; }}
                      type="number" min="0" max={maxClass} step="0.5"
                      value={row.classScore} disabled={disabled}
                      onChange={e => updateScore(enr.id, 'classScore', e.target.value)}
                      onFocus={e => { e.target.select(); e.target.style.border = '2px solid var(--navy)'; e.target.style.background = '#e8f0fe'; }}
                      onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.background = disabled ? '#f5f5f5' : '#fff'; }}
                      onKeyDown={e => handleKeyDown(e, idx, 'cs')}
                      style={{ width: '100%', textAlign: 'center', padding: '5px 4px', border: '1px solid var(--border)', borderRadius: 4, background: disabled ? '#f5f5f5' : '#fff', fontSize: '.9rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                    <input
                      ref={el => { inputRefs.current[`${idx}-es`] = el; }}
                      type="number" min="0" max={maxExam} step="0.5"
                      value={row.examScore} disabled={disabled}
                      onChange={e => updateScore(enr.id, 'examScore', e.target.value)}
                      onFocus={e => { e.target.select(); e.target.style.border = '2px solid var(--navy)'; e.target.style.background = '#e8f0fe'; }}
                      onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.background = disabled ? '#f5f5f5' : '#fff'; }}
                      onKeyDown={e => handleKeyDown(e, idx, 'es')}
                      style={{ width: '100%', textAlign: 'center', padding: '5px 4px', border: '1px solid var(--border)', borderRadius: 4, background: disabled ? '#f5f5f5' : '#fff', fontSize: '.9rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, fontSize: '.9rem', fontFamily: 'var(--font-mono)', color: t !== null ? 'var(--navy)' : '#ccc' }}>
                    {t !== null ? t : '—'}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    {gradeInfo ? (
                      <span style={{ display: 'inline-block', background: gc.bg, color: gc.color, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: '.82rem', minWidth: 36 }}>
                        {gradeInfo.grade}
                      </span>
                    ) : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '.75rem', color: gradeInfo ? gc.color : '#ccc' }}>
                    {gradeInfo?.remarks || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>{enrollments.length} students · Max {total} marks</span>
          <button onClick={onSave} className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} disabled={saving} style={{ minWidth: 140 }}>
            {saving ? '⏳ Saving…' : saved ? '✓ All Saved!' : '💾 Save All Scores'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function Scores() {
  const { school, classes, subjects, schoolId, classesForUser, subjectsForUser, getSubjectsForClass, teacherProfile } = useSchool();
  const { userProfile } = useAuth();
  const isAdmin   = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';

  const [tab, setTab] = useState('entry');

  // For teachers: their subjects and auto-selection logic
  const teacherSubjects = isTeacher ? subjectsForUser : subjects;

  // Filters — teachers get subjectId auto-set
  const [filters, setFilters] = useState({
    classId:      '',
    subjectId:    '',
    academicYear: school?.academicYear   || '',
    term:         school?.currentTerm    || '1',
  });

  // Auto-set subjectId for teachers on mount or when their subjects load
  useEffect(() => {
    if (!isTeacher || teacherSubjects.length === 0) return;
    // If teacher has only 1 subject, auto-select it
    if (teacherSubjects.length === 1 && !filters.subjectId) {
      setFilters(f => ({ ...f, subjectId: teacherSubjects[0].id }));
    }
  }, [isTeacher, teacherSubjects.length]);

  // Score entry state
  const [enrollments,  setEnrollments]  = useState([]);
  const [students,     setStudents]     = useState([]);
  const [scores,       setScores]       = useState({});
  const [deadline,     setDeadline]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [entryError,   setEntryError]   = useState('');

  // Admin all-scores state
  const [allScores,    setAllScores]    = useState([]);
  const [adminFilters, setAdminFilters] = useState({ academicYear: school?.academicYear || '', term: school?.currentTerm || '1', classId: '', subjectId: '' });
  const [adminLoading, setAdminLoading] = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);

  const gradingScale    = (school?.gradingScale?.length ? school.gradingScale : null) || defaultGradingScale();
  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const maxClass        = selectedSubject?.maxClassScore ?? 30;
  const maxExam         = selectedSubject?.maxExamScore  ?? 70;

  // For teachers: subjects that belong to the selected class
  const classSubjects = getSubjectsForClass(filters.classId);

  // When teacher selects a class and has only 1 subject for that class → auto-select
  useEffect(() => {
    if (!isTeacher || !filters.classId) return;
    if (classSubjects.length === 1) {
      setFilters(f => ({ ...f, subjectId: classSubjects[0].id }));
    } else if (teacherSubjects.length === 1) {
      // teacher only has 1 subject overall — keep it selected
      setFilters(f => ({ ...f, subjectId: teacherSubjects[0].id }));
    }
  }, [filters.classId, classSubjects.length, isTeacher]);

  const deadlineAllowed = deadline ? checkDeadlineStatus(deadline).allowed : true;
  const inputDisabled   = !deadlineAllowed && !isAdmin;

  // ── LOAD ENTRY DATA ───────────────────────────────────────────
  const loadEntry = useCallback(async () => {
    if (!filters.classId || !filters.subjectId || !schoolId) return;
    setLoading(true); setEntryError('');
    try {
      const [enrs, studs, existingScores, dl] = await Promise.all([
        getEnrollments(schoolId, {
          classId:      filters.classId,
          academicYear: filters.academicYear,
          term:         filters.term,
          status:       'active',
        }),
        getStudents(schoolId),
        getScores(schoolId, {
          classId:      filters.classId,
          subjectId:    filters.subjectId,
          academicYear: filters.academicYear,
          term:         filters.term,
        }),
        getAssessmentDeadline(schoolId, filters.academicYear, filters.term),
      ]);
      setEnrollments(enrs);
      setStudents(studs);
      setDeadline(dl);
      const scoreMap = {};
      enrs.forEach(e => {
        const ex = existingScores.find(s => s.enrollmentId === e.id);
        scoreMap[e.id] = { classScore: ex?.classScore ?? '', examScore: ex?.examScore ?? '', total: ex?.total ?? 0 };
      });
      setScores(scoreMap);
    } catch (err) {
      console.error('[Scores] loadEntry error:', err);
      if (err.message?.toLowerCase().includes('permission') ||
          err.message?.toLowerCase().includes('insufficient')) {
        setEntryError(
          'Could not load scores — Firestore permission error. ' +
          'Make sure the updated firestore.rules have been deployed. ' +
          'Error: ' + err.message
        );
      } else if (err.message?.toLowerCase().includes('network') ||
                 err.message?.toLowerCase().includes('offline')) {
        setEntryError('You appear to be offline. Score data will load from local cache.');
      } else {
        setEntryError('Failed to load: ' + err.message);
      }
    } finally { setLoading(false); }
  }, [filters, schoolId]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

  // ── SAVE SCORES ──────────────────────────────────────────────
  async function handleSave() {
    if (!filters.classId || !filters.subjectId) { alert('Select class and subject first'); return; }
    if (!deadlineAllowed && !isAdmin) { setEntryError('Submission deadline has passed.'); return; }
    setSaving(true); setEntryError('');
    try {
      const batchData = enrollments.map(e => ({
        enrollmentId: e.id, studentId: e.studentId,
        classId: filters.classId, subjectId: filters.subjectId,
        academicYear: filters.academicYear, term: filters.term,
        classScore: Number(scores[e.id]?.classScore) || 0,
        examScore:  Number(scores[e.id]?.examScore)  || 0,
      }));
      await saveBatchScores(schoolId, batchData, {
        userRole: userProfile?.role,
        academicYear: filters.academicYear,
        term: filters.term,
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { setEntryError(err.message); }
    finally { setSaving(false); }
  }

  // ── ADMIN ALL SCORES ─────────────────────────────────────────
  const loadAdminScores = useCallback(async () => {
    if (!schoolId || !isAdmin) return;
    setAdminLoading(true);
    try { setAllScores(await getAllSchoolScores(schoolId, adminFilters)); }
    catch (err) { console.error(err); }
    finally { setAdminLoading(false); }
  }, [schoolId, adminFilters, isAdmin]);

  useEffect(() => { if (tab === 'admin-view') loadAdminScores(); }, [tab, loadAdminScores]);

  async function handleAdminDelete(score) {
    const reason = window.prompt('Reason for deletion (optional):') ?? '';
    if (!window.confirm('Delete this score record permanently?')) return;
    try { await adminDeleteScore(score.id, schoolId, { uid: userProfile.id, email: userProfile.email }, reason); loadAdminScores(); }
    catch (err) { alert('Delete failed: ' + err.message); }
  }

  async function handleAdminApprove(score) {
    if (!window.confirm('Approve and finalise this record?')) return;
    try { await adminApproveScore(score.id, schoolId, { uid: userProfile.id, email: userProfile.email }); loadAdminScores(); }
    catch (err) { alert('Approve failed: ' + err.message); }
  }

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));

  // Available classes — for teachers, only assigned classes
  const availableClasses = isTeacher ? classesForUser : classes;

  // Subject selector for teachers: tabs if multiple, hidden if single
  const showSubjectTabs  = isTeacher && teacherSubjects.length > 1;
  const showSubjectField = isAdmin; // admins always see dropdown

  return (
    <div>
      <div className="page-header">
        <h1>Score Entry</h1>
        {isAdmin && (
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab${tab === 'entry'      ? ' active' : ''}`} onClick={() => setTab('entry')}>📋 Enter Scores</button>
            <button className={`tab${tab === 'admin-view' ? ' active' : ''}`} onClick={() => setTab('admin-view')}>📊 All Submissions</button>
          </div>
        )}
      </div>

      {/* ── ENTRY TAB ── */}
      {tab === 'entry' && (
        <>
          <DeadlineBanner deadline={deadline} />
          {entryError && (
            <div className="alert alert-danger" style={{ marginBottom: 12 }}>
              {entryError}
              <button onClick={() => setEntryError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          )}

          {/* Subject tabs for teachers with multiple subjects */}
          {showSubjectTabs && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '.75rem', color: 'var(--text-lt)', marginBottom: 6 }}>Your Subjects</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {teacherSubjects.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setFilters(f => ({ ...f, subjectId: s.id }))}
                    style={{
                      padding: '7px 16px', borderRadius: 20, fontSize: '.85rem', cursor: 'pointer',
                      border: `2px solid ${filters.subjectId === s.id ? 'var(--navy)' : 'var(--border)'}`,
                      background: filters.subjectId === s.id ? 'var(--navy)' : '#fff',
                      color: filters.subjectId === s.id ? '#fff' : 'var(--text-mid)',
                      fontWeight: filters.subjectId === s.id ? 700 : 400,
                      transition: 'all .15s',
                    }}
                  >
                    {filters.subjectId === s.id ? '✓ ' : ''}{s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="form-group" style={{ minWidth: 180 }}>
                <label style={{ fontSize: '.75rem' }}>
                  {isTeacher ? 'Select Your Class' : 'Class'}
                </label>
                <select
                  value={filters.classId}
                  onChange={e => setFilters(f => ({ ...f, classId: e.target.value, ...(!isTeacher ? { subjectId: '' } : {}) }))}
                >
                  <option value="">— {isTeacher ? 'Pick your class' : 'Select Class'} —</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Admin gets subject dropdown; teachers with 1 subject see label only */}
              {showSubjectField && (
                <div className="form-group" style={{ minWidth: 180 }}>
                  <label style={{ fontSize: '.75rem' }}>Subject</label>
                  <select
                    value={filters.subjectId}
                    onChange={e => setFilters(f => ({ ...f, subjectId: e.target.value }))}
                    disabled={!filters.classId}
                  >
                    <option value="">— Select Subject —</option>
                    {getSubjectsForClass(filters.classId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show active subject label for teacher with single subject */}
              {isTeacher && !showSubjectTabs && filters.subjectId && (
                <div style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
                  <span className="badge badge-info" style={{ fontSize: '.84rem', padding: '6px 14px' }}>
                    📚 {subjectMap[filters.subjectId]?.name || 'Subject'}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Year</label>
                <input value={filters.academicYear} onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} style={{ maxWidth: 110 }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Term</label>
                <select value={filters.term} onChange={e => setFilters(f => ({ ...f, term: e.target.value }))} style={{ maxWidth: 90 }}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
            </div>

            {selectedSubject && (
              <div style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginTop: 6 }}>
                Max Class Score: <strong>{maxClass}</strong> · Max Exam Score: <strong>{maxExam}</strong> · Total: <strong>{maxClass + maxExam}</strong>
              </div>
            )}
          </div>

          {/* Score grid */}
          <div className="card">
            {loading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : isTeacher && teacherSubjects.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🔒</div>
                <p>No subjects assigned to you yet.<br />Ask your school administrator to assign your classes and subjects.</p>
              </div>
            ) : !filters.classId ? (
              <div className="empty-state">
                <div className="icon">📊</div>
                <p>{isTeacher ? 'Select your class above to open the score sheet.' : 'Select a class and subject to open the score sheet.'}</p>
              </div>
            ) : !filters.subjectId ? (
              <div className="empty-state">
                <div className="icon">📚</div>
                <p>Select a subject{showSubjectTabs ? ' from the tabs above' : ''} to load the score sheet.</p>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👥</div>
                <p>No active enrollments in this class/term.<br />Ask the admin to enroll students first.</p>
              </div>
            ) : (
              <ExcelScoreGrid
                enrollments={enrollments} students={students}
                scores={scores} setScores={setScores}
                maxClass={maxClass} maxExam={maxExam}
                gradingScale={gradingScale}
                disabled={inputDisabled}
                onSave={handleSave} saving={saving} saved={saved}
              />
            )}
          </div>
        </>
      )}

      {/* ── ADMIN ALL-SCORES TAB ── */}
      {tab === 'admin-view' && isAdmin && (
        <>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Year</label>
                <input value={adminFilters.academicYear} onChange={e => setAdminFilters(f => ({ ...f, academicYear: e.target.value }))} style={{ maxWidth: 110 }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Term</label>
                <select value={adminFilters.term} onChange={e => setAdminFilters(f => ({ ...f, term: e.target.value }))} style={{ maxWidth: 90 }}>
                  <option value="">All</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Class</label>
                <select value={adminFilters.classId} onChange={e => setAdminFilters(f => ({ ...f, classId: e.target.value }))} style={{ minWidth: 150 }}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select value={adminFilters.subjectId} onChange={e => setAdminFilters(f => ({ ...f, subjectId: e.target.value }))} style={{ minWidth: 150 }}>
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={loadAdminScores} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}>↻ Refresh</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">All Submitted Scores ({allScores.length})</span>
            </div>
            {adminLoading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : allScores.length === 0 ? (
              <div className="empty-state"><div className="icon">📋</div><p>No scores found for the selected filters.</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Class</th><th>Subject</th><th>Class Score</th><th>Exam Score</th><th>Total</th><th>Grade</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {allScores.map(score => {
                      const grade = applyGradingScale(score.total || 0, gradingScale);
                      const gc    = gradeColor(grade.grade);
                      return (
                        <tr key={score.id}>
                          <td style={{ fontSize: '.82rem' }}>{classMap[score.classId]?.name   || '—'}</td>
                          <td style={{ fontSize: '.82rem' }}>{subjectMap[score.subjectId]?.name || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{score.classScore ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{score.examScore  ?? '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{score.total ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: gc.bg, color: gc.color, borderRadius: 4, padding: '2px 7px', fontWeight: 700, fontSize: '.8rem' }}>{grade.grade}</span>
                          </td>
                          <td>{score.isFinalized ? <span className="badge badge-success">Approved</span> : <span className="badge badge-warning">Pending</span>}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {!score.isFinalized && (
                                <>
                                  <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(score)}>Edit</button>
                                  <button className="btn btn-success btn-sm" onClick={() => handleAdminApprove(score)}>Approve</button>
                                </>
                              )}
                              <button className="btn btn-danger btn-sm" onClick={() => handleAdminDelete(score)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editTarget && (
        <AdminEditModal
          score={editTarget} schoolId={schoolId} userProfile={userProfile}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadAdminScores(); }}
        />
      )}
    </div>
  );
}
