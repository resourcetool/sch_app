// src/pages/Scores.jsx
//
// Changes:
// - Completely redesigned score entry as an Excel-style spreadsheet grid.
//   - Tab / Shift-Tab and arrow-key navigation between cells.
//   - Auto-advance to next row on Enter.
//   - Inline totals and grades update as you type (no save needed to see them).
//   - Sticky header column (student name) when scrolling horizontally.
//   - Colour-coded grade cells (green A, blue B, orange C, red F).
//   - Keyboard shortcut hint row at top.
// - Deadline banner still shown for teachers.
// - Admin "All Submissions" tab preserved with edit / approve / delete.
// - saveBatchScores called with userRole for service-layer deadline enforcement.

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

// ── GRADE COLOUR ──────────────────────────────────────────────────
function gradeColor(grade) {
  if (!grade || grade === 'N/A') return { bg: '#f8f9fa', color: '#999' };
  const g = grade.charAt(0);
  if (g === 'A') return { bg: '#d4edda', color: '#155724' };
  if (g === 'B') return { bg: '#cce5ff', color: '#004085' };
  if (g === 'C') return { bg: '#fff3cd', color: '#856404' };
  if (g === 'D' || g === 'E') return { bg: '#ffeeba', color: '#7d5a00' };
  return { bg: '#f8d7da', color: '#721c24' };
}

// ── DEADLINE BANNER ───────────────────────────────────────────────
function DeadlineBanner({ deadline }) {
  if (!deadline) return null;
  const { allowed, reason } = checkDeadlineStatus(deadline);
  if (!allowed) {
    return (
      <div className="alert alert-danger" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>🔒</span>
        <div><strong>Entry Closed</strong><div style={{ fontSize: '.84rem', marginTop: 2 }}>{reason}</div></div>
      </div>
    );
  }
  if (deadline.closeAt) {
    return (
      <div className="alert alert-warning" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>⏰</span>
        <span><strong>Deadline:</strong> {new Date(deadline.closeAt).toLocaleString()}</span>
      </div>
    );
  }
  return null;
}

// ── ADMIN EDIT MODAL ──────────────────────────────────────────────
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
              New total: <strong>{(Number(classScore)||0)+(Number(examScore)||0)}</strong> · This change will be recorded in the audit log.
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

// ── EXCEL GRID ────────────────────────────────────────────────────
function ExcelScoreGrid({ enrollments, students, scores, setScores, maxClass, maxExam, gradingScale, disabled, onSave, saving, saved }) {
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const inputRefs  = useRef({});   // { `${rowIdx}-cs` | `${rowIdx}-es` : ref }
  const total      = maxClass + maxExam;

  function updateScore(enrollmentId, field, value) {
    setScores(prev => {
      const row = { ...prev[enrollmentId], [field]: value };
      const cs  = Number(row.classScore) || 0;
      const es  = Number(row.examScore)  || 0;
      return { ...prev, [enrollmentId]: { ...row, total: Math.min(cs + es, total) } };
    });
  }

  function handleKeyDown(e, rowIdx, col) {
    // Tab / Shift-Tab: move between class and exam columns
    // Enter / ArrowDown: move to same column on next row
    // ArrowUp: move to same column on prev row
    const rows = enrollments.length;
    let nextRow = rowIdx, nextCol = col;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) { nextCol = col === 'cs' ? 'es' : 'cs'; if (col === 'es') nextRow = Math.min(rowIdx + 1, rows - 1); }
      else             { nextCol = col === 'es' ? 'cs' : 'es'; if (col === 'cs') nextRow = Math.max(rowIdx - 1, 0); }
    } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault(); nextRow = Math.min(rowIdx + 1, rows - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); nextRow = Math.max(rowIdx - 1, 0);
    } else if (e.key === 'ArrowRight' && col === 'cs') {
      e.preventDefault(); nextCol = 'es';
    } else if (e.key === 'ArrowLeft' && col === 'es') {
      e.preventDefault(); nextCol = 'cs';
    } else { return; }

    const key = `${nextRow}-${nextCol}`;
    inputRefs.current[key]?.focus();
    inputRefs.current[key]?.select();
  }

  return (
    <div>
      {/* Keyboard hint */}
      <div style={{ display: 'flex', gap: 16, fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 8, flexWrap: 'wrap' }}>
        <span>⌨️ <strong>Tab</strong> next cell</span>
        <span><strong>Enter / ↓</strong> next row</span>
        <span><strong>↑</strong> prev row</span>
        <span><strong>← →</strong> switch column</span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
          <thead>
            <tr style={{ background: 'var(--navy)', color: '#fff', fontSize: '.78rem' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', width: 30, position: 'sticky', left: 0, background: 'var(--navy)', zIndex: 2 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 160, position: 'sticky', left: 30, background: 'var(--navy)', zIndex: 2 }}>Student</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 110 }}>Class Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxClass}</span></th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 110 }}>Exam Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxExam}</span></th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 80 }}>Total<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{total}</span></th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Grade</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Remarks</th>
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
              const isEven    = idx % 2 === 0;
              const rowBg     = isEven ? '#fff' : '#f8f9ff';

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
                      value={row.classScore}
                      disabled={disabled}
                      onChange={e => updateScore(enr.id, 'classScore', e.target.value)}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => handleKeyDown(e, idx, 'cs')}
                      style={{
                        width: '100%', textAlign: 'center', padding: '5px 4px',
                        border: '1px solid var(--border)', borderRadius: 4,
                        background: disabled ? '#f5f5f5' : '#fff',
                        fontSize: '.9rem', fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                      onFocusCapture={e => { e.target.style.border = '2px solid var(--navy)'; e.target.style.background = '#e8f0fe'; }}
                      onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.background = disabled ? '#f5f5f5' : '#fff'; }}
                    />
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                    <input
                      ref={el => { inputRefs.current[`${idx}-es`] = el; }}
                      type="number" min="0" max={maxExam} step="0.5"
                      value={row.examScore}
                      disabled={disabled}
                      onChange={e => updateScore(enr.id, 'examScore', e.target.value)}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => handleKeyDown(e, idx, 'es')}
                      style={{
                        width: '100%', textAlign: 'center', padding: '5px 4px',
                        border: '1px solid var(--border)', borderRadius: 4,
                        background: disabled ? '#f5f5f5' : '#fff',
                        fontSize: '.9rem', fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                      onFocusCapture={e => { e.target.style.border = '2px solid var(--navy)'; e.target.style.background = '#e8f0fe'; }}
                      onBlur={e => { e.target.style.border = '1px solid var(--border)'; e.target.style.background = disabled ? '#f5f5f5' : '#fff'; }}
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

      {/* Footer save bar */}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>
            {enrollments.length} students · Max {total} marks
          </span>
          <button
            onClick={onSave}
            className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
            disabled={saving}
            style={{ minWidth: 140 }}
          >
            {saving ? '⏳ Saving…' : saved ? '✓ All Saved!' : '💾 Save All Scores'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Scores() {
  const { school, classes, subjects, schoolId, classesForUser, subjectsForUser, teacherProfile } = useSchool();
  // Teachers only see their assigned classes/subjects; admins see all
  const availableClasses  = classesForUser;
  const availableSubjects = subjectsForUser;
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const [tab, setTab] = useState('entry');

  // Entry state
  const [filters, setFilters] = useState({
    classId: '', subjectId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1',
  });
  const [enrollments, setEnrollments] = useState([]);
  const [students,    setStudents]    = useState([]);
  const [scores,      setScores]      = useState({});
  const [deadline,    setDeadline]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [entryError,  setEntryError]  = useState('');

  // Admin all-scores state
  const [allScores,    setAllScores]    = useState([]);
  const [adminFilters, setAdminFilters] = useState({ academicYear: school?.academicYear || '', term: school?.currentTerm || '1', classId: '', subjectId: '' });
  const [adminLoading, setAdminLoading] = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);

  const gradingScale    = (school?.gradingScale?.length ? school.gradingScale : null) || defaultGradingScale();
  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const maxClass        = selectedSubject?.maxClassScore ?? 30;
  const maxExam         = selectedSubject?.maxExamScore  ?? 70;
  const classSubjects   = availableSubjects.filter(s => s.classIds?.includes(filters.classId));

  const deadlineAllowed = deadline ? checkDeadlineStatus(deadline).allowed : true;
  const inputDisabled   = !deadlineAllowed && !isAdmin;

  // Load entry data
  const loadEntry = useCallback(async () => {
    if (!filters.classId || !filters.subjectId || !schoolId) return;
    setLoading(true); setEntryError('');
    try {
      const [enrs, studs, existingScores, dl] = await Promise.all([
        getEnrollments(schoolId, { classId: filters.classId, academicYear: filters.academicYear, term: filters.term, status: 'active' }),
        getStudents(schoolId),
        getScores(schoolId, { classId: filters.classId, subjectId: filters.subjectId, academicYear: filters.academicYear, term: filters.term }),
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
    } catch (err) { setEntryError(err.message); }
    finally { setLoading(false); }
  }, [filters, schoolId]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

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
      await saveBatchScores(schoolId, batchData, { userRole: userProfile?.role, academicYear: filters.academicYear, term: filters.term });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { setEntryError(err.message); }
    finally { setSaving(false); }
  }

  // Load admin scores
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

  return (
    <div>
      <div className="page-header">
        <h1>Score Entry</h1>
        {isAdmin && (
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab${tab === 'entry' ? ' active' : ''}`} onClick={() => setTab('entry')}>📋 Enter Scores</button>
            <button className={`tab${tab === 'admin-view' ? ' active' : ''}`} onClick={() => setTab('admin-view')}>📊 All Submissions</button>
          </div>
        )}
      </div>

      {/* ── ENTRY TAB ── */}
      {tab === 'entry' && (
        <>
          <DeadlineBanner deadline={deadline} />
          {entryError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{entryError}</div>}

          {/* Filter bar */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="form-group" style={{ minWidth: 180 }}>
                <label style={{ fontSize: '.75rem' }}>Class</label>
                <select value={filters.classId} onChange={e => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}>
                  <option value="">— Class —</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 180 }}>
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select value={filters.subjectId} onChange={e => setFilters(f => ({ ...f, subjectId: e.target.value }))} disabled={!filters.classId}>
                  <option value="">— Subject —</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
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
          </div>

          {/* Grid */}
          <div className="card">
            {loading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : !filters.classId || !filters.subjectId ? (
              <div className="empty-state">
                <div className="icon">📊</div>
                <p>Select a class and subject to open the score sheet.</p>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👥</div>
                <p>No active enrollments found. Enroll students first.</p>
              </div>
            ) : (
              <ExcelScoreGrid
                enrollments={enrollments}
                students={students}
                scores={scores}
                setScores={setScores}
                maxClass={maxClass}
                maxExam={maxExam}
                gradingScale={gradingScale}
                disabled={inputDisabled}
                onSave={handleSave}
                saving={saving}
                saved={saved}
              />
            )}
          </div>
        </>
      )}

      {/* ── ADMIN ALL-SCORES TAB ── */}
      {tab === 'admin-view' && isAdmin && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
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
                <select value={adminFilters.classId} onChange={e => setAdminFilters(f => ({ ...f, classId: e.target.value }))} style={{ minWidth: 160 }}>
                  <option value="">All Classes</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select value={adminFilters.subjectId} onChange={e => setAdminFilters(f => ({ ...f, subjectId: e.target.value }))} style={{ minWidth: 160 }}>
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
              <div className="empty-state"><div className="icon">📋</div><p>No scores found.</p></div>
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
                          <td style={{ fontSize: '.82rem' }}>{classMap[score.classId]?.name || '—'}</td>
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
                              {!score.isFinalized && <>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(score)}>Edit</button>
                                <button className="btn btn-success btn-sm" onClick={() => handleAdminApprove(score)}>Approve</button>
                              </>}
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
