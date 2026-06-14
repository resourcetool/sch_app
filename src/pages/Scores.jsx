// src/pages/Scores.jsx
// Complete rewrite — professional Excel-like score entry with deadline enforcement

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool }  from '../contexts/SchoolContext';
import { useAuth }    from '../contexts/AuthContext';
import { getEnrollments, getStudents } from '../services/studentService';
import { getScores, saveBatchScores, defaultGradingScale, applyGradingScale } from '../services/scoreService';
import { getAssessmentWindow, checkDeadlineAllows } from '../services/assessmentService';

const GRADE_SCALE = defaultGradingScale();

function gradeColor(grade) {
  if (!grade || grade === 'N/A') return '#94a3b8';
  if (grade === 'A1')            return '#16a34a';
  if (grade.startsWith('B'))     return '#2563eb';
  if (grade.startsWith('C'))     return '#d97706';
  if (grade.startsWith('D') || grade.startsWith('E')) return '#ea580c';
  return '#dc2626';
}

export default function Scores() {
  const { school, classes, subjects, schoolId } = useSchool();
  const { userProfile } = useAuth();

  const [filters, setFilters] = useState({
    classId: '', subjectId: '',
    academicYear: school?.academicYear || '',
    term:         school?.currentTerm  || '1'
  });
  const [enrollments, setEnrollments] = useState([]);
  const [students,    setStudents]    = useState([]);
  const [savedScores, setSavedScores] = useState([]);   // from DB
  const [localScores, setLocalScores] = useState({});   // { enrollmentId: {cs, es} }
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [window_,     setWindow_]     = useState(null);
  const [deadline,    setDeadline]    = useState(null);
  const inputRefs = useRef({});

  const isAdmin   = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';

  const availableClasses = isTeacher
    ? classes.filter(c => userProfile?.assignedClasses?.includes(c.id))
    : classes;

  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const classSubjects   = subjects.filter(s => s.classIds?.includes(filters.classId));
  const maxCS = selectedSubject?.maxClassScore ?? 30;
  const maxES = selectedSubject?.maxExamScore  ?? 70;

  // Sync school defaults
  useEffect(() => {
    if (school) {
      setFilters(f => ({
        ...f,
        academicYear: f.academicYear || school.academicYear || '',
        term:         f.term         || school.currentTerm  || '1'
      }));
    }
  }, [school]);

  const load = useCallback(async () => {
    if (!filters.classId || !filters.subjectId || !schoolId) return;
    setLoading(true);
    setLocalScores({});
    try {
      const [enrs, studs, sc, win, dl] = await Promise.all([
        getEnrollments(schoolId, {
          classId: filters.classId, academicYear: filters.academicYear,
          term: filters.term, status: 'active'
        }),
        getStudents(schoolId),
        getScores(schoolId, { ...filters }),
        getAssessmentWindow(schoolId, filters.classId, filters.academicYear, filters.term, filters.subjectId),
        checkDeadlineAllows(schoolId, filters.classId, filters.academicYear, filters.term, filters.subjectId)
      ]);
      setEnrollments(enrs);
      setStudents(studs);
      setSavedScores(sc);
      setWindow_(win);
      setDeadline(dl);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, schoolId]);

  useEffect(() => { load(); }, [load]);

  // Build display rows
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  const rows = enrollments.map(enr => {
    const db_score  = savedScores.find(s => s.enrollmentId === enr.id);
    const local     = localScores[enr.id];
    const cs        = local?.cs ?? (db_score?.classScore ?? '');
    const es        = local?.es ?? (db_score?.examScore  ?? '');
    const total     = (cs !== '' || es !== '') ? Math.min((Number(cs)||0)+(Number(es)||0), maxCS+maxES) : null;
    const gi        = total !== null ? applyGradingScale(total, GRADE_SCALE) : null;
    const isDirty   = !!local;
    const isApproved = db_score?.isApproved || false;
    const isFinalized = db_score?.isFinalized || false;
    return { enr, db_score, cs, es, total, gi, isDirty, isApproved, isFinalized };
  });

  const entryBlocked = isTeacher && deadline && !deadline.allowed;
  const dirtyCount   = Object.keys(localScores).length;
  const enteredCount = rows.filter(r => r.total !== null).length;
  const classAvg     = enteredCount > 0
    ? (rows.reduce((s, r) => s + (r.total || 0), 0) / enteredCount).toFixed(1)
    : null;

  function updateLocal(enrollmentId, field, value) {
    setLocalScores(prev => {
      const cur = prev[enrollmentId] || {};
      return { ...prev, [enrollmentId]: { ...cur, [field]: value } };
    });
    setSaved(false);
  }

  // Tab key navigation between cells
  function handleKeyDown(e, rowIdx, field) {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const nextField = field === 'cs' ? 'es' : 'cs';
      const nextRow   = field === 'cs' ? rowIdx : rowIdx + 1;
      if (nextRow < rows.length) {
        const key = `${rows[nextRow].enr.id}_${nextField}`;
        inputRefs.current[key]?.focus();
      }
    }
  }

  async function handleSave() {
    if (entryBlocked) { alert(deadline.reason); return; }
    if (!filters.classId || !filters.subjectId) { alert('Select class and subject first.'); return; }
    if (dirtyCount === 0) { alert('No changes to save.'); return; }

    setSaving(true);
    try {
      const batch = Object.entries(localScores).map(([enrollmentId, vals]) => {
        const enr = enrollments.find(e => e.id === enrollmentId);
        const existing = savedScores.find(s => s.enrollmentId === enrollmentId);
        return {
          enrollmentId,
          studentId:    enr?.studentId,
          classId:      filters.classId,
          subjectId:    filters.subjectId,
          academicYear: filters.academicYear,
          term:         filters.term,
          classScore: Number(vals.cs ?? existing?.classScore ?? 0),
          examScore:  Number(vals.es ?? existing?.examScore  ?? 0)
        };
      });

      await saveBatchScores(schoolId, batch, isAdmin ? 'admin' : 'teacher');
      setSaved(true);
      setLocalScores({});
      setTimeout(() => setSaved(false), 4000);
      await load();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Window status bar
  function WindowBar() {
    if (!window_) return null;
    const now = Date.now();
    let cfg;
    if (window_.isLocked)                             cfg = { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', icon: '🔒', msg: 'Assessment entry is locked.' };
    else if (window_.openDate && now < window_.openDate) cfg = { bg: '#dbeafe', border: '#93c5fd', color: '#1d4ed8', icon: '⏳', msg: `Opens ${new Date(window_.openDate).toLocaleString('en-GH')}` };
    else if (window_.closeDate && now > window_.closeDate) cfg = { bg: '#ede9fe', border: '#c4b5fd', color: '#6d28d9', icon: '⌛', msg: `Deadline passed ${new Date(window_.closeDate).toLocaleString('en-GH')}` };
    else if (window_.closeDate) {
      const d = Math.ceil((window_.closeDate - now) / 864e5);
      cfg = d <= 2
        ? { bg: '#fef3c7', border: '#fde68a', color: '#92400e', icon: '⚠️', msg: `Deadline in ${d} day${d!==1?'s':''}: ${new Date(window_.closeDate).toLocaleString('en-GH')}` }
        : { bg: '#dcfce7', border: '#86efac', color: '#15803d', icon: '✅', msg: `Open · Deadline: ${new Date(window_.closeDate).toLocaleString('en-GH')} (${d} days)` };
    } else {
      cfg = { bg: '#dcfce7', border: '#86efac', color: '#15803d', icon: '✅', msg: 'Assessment entry is open.' };
    }
    return (
      <div style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 8, padding: '8px 14px', marginTop: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '.82rem', fontWeight: 600, color: cfg.color
      }}>
        <span>{cfg.icon}</span>
        <span>{cfg.msg}</span>
        {window_.note && <span style={{ fontWeight: 400, marginLeft: 4, opacity: .8 }}>— {window_.note}</span>}
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Score Entry</h1>
          <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginTop: 2 }}>
            Enter class and exam scores for students
          </p>
        </div>
        {rows.length > 0 && !entryBlocked && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {dirtyCount > 0 && (
              <span style={{ fontSize: '.78rem', color: 'var(--warning)', fontWeight: 600 }}>
                {dirtyCount} unsaved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: saved ? '#16a34a' : dirtyCount > 0 ? '#0f3460' : '#94a3b8',
                color: '#fff', fontWeight: 700, fontSize: '.85rem',
                cursor: dirtyCount > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background .2s'
              }}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved!' : `Save${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Filter card */}
      <div style={{
        background: '#fff', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
        marginBottom: 14, boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 175 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-mid)' }}>Class</label>
            <select value={filters.classId}
              onChange={e => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}>
              <option value="">— Select Class —</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 175 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-mid)' }}>Subject</label>
            <select value={filters.subjectId}
              onChange={e => setFilters(f => ({ ...f, subjectId: e.target.value }))}
              disabled={!filters.classId}>
              <option value="">— Select Subject —</option>
              {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 120 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-mid)' }}>Year</label>
            <input value={filters.academicYear}
              onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} />
          </div>
          <div className="form-group" style={{ minWidth: 100 }}>
            <label style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-mid)' }}>Term</label>
            <select value={filters.term} onChange={e => setFilters(f => ({ ...f, term: e.target.value }))}>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
        </div>

        {/* Score limits */}
        {selectedSubject && (
          <div style={{
            display: 'flex', gap: 20, marginTop: 12,
            paddingTop: 10, borderTop: '1px solid var(--border)',
            fontSize: '.78rem', color: 'var(--text-mid)', flexWrap: 'wrap'
          }}>
            <span>Class Score: <strong style={{ color: 'var(--navy)' }}>0 – {maxCS}</strong></span>
            <span>Exam Score: <strong style={{ color: 'var(--navy)' }}>0 – {maxES}</strong></span>
            <span>Total: <strong style={{ color: 'var(--navy)' }}>{maxCS + maxES}</strong></span>
            {enteredCount > 0 && <span>Entered: <strong style={{ color: 'var(--navy)' }}>{enteredCount}/{rows.length}</strong></span>}
            {classAvg && <span>Class Avg: <strong style={{ color: 'var(--navy)' }}>{classAvg}%</strong></span>}
          </div>
        )}

        <WindowBar />
      </div>

      {/* Blocked banner */}
      {entryBlocked && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
          color: '#991b1b', fontSize: '.85rem', fontWeight: 600
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔒</span>
          <span>{deadline.reason}</span>
        </div>
      )}

      {/* Score Table */}
      {!filters.classId || !filters.subjectId ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '70px 20px',
          textAlign: 'center', color: 'var(--text-lt)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✏️</div>
          <p style={{ fontSize: '.9rem' }}>Select a class and subject above to begin entering scores.</p>
          <p style={{ fontSize: '.8rem', marginTop: 6 }}>Use Tab or Enter to move between cells.</p>
        </div>
      ) : loading ? (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 50 }}>
          <div className="spinner-center"><div className="spinner" /></div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '70px 20px',
          textAlign: 'center', color: 'var(--text-lt)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: '.9rem' }}>No active enrollments in this class/term. Enroll students first.</p>
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)', overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ background: '#0f3460', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', width: 40, textAlign: 'center' }}>#</th>
                  <th style={{ background: '#0f3460', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', width: 100, textAlign: 'left' }}>ID</th>
                  <th style={{ background: '#0f3460', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'left' }}>Student Name</th>
                  <th style={{ background: '#1a4a7a', color: '#fff', padding: '11px 16px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', width: 130 }}>
                    Class Score <span style={{ opacity: .7, fontWeight: 400 }}>/{maxCS}</span>
                  </th>
                  <th style={{ background: '#1a4a7a', color: '#fff', padding: '11px 16px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', width: 130 }}>
                    Exam Score <span style={{ opacity: .7, fontWeight: 400 }}>/{maxES}</span>
                  </th>
                  <th style={{ background: '#162d52', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', width: 80 }}>Total</th>
                  <th style={{ background: '#162d52', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', width: 70 }}>Grade</th>
                  <th style={{ background: '#162d52', color: '#fff', padding: '11px 12px', fontWeight: 700, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'center', width: 80 }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const student  = studentMap[row.enr.studentId];
                  const disabled = entryBlocked || row.isFinalized;
                  const rowBg    = row.isDirty   ? '#fffbeb'
                                 : row.isApproved ? '#f0fdf4'
                                 : i % 2 === 0   ? '#ffffff'
                                 : '#f8fafc';
                  return (
                    <tr key={row.enr.id}
                      style={{ background: rowBg }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                    >
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '.78rem', borderBottom: '1px solid #f1f5f9' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: '.74rem', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {student?.studentCode || '—'}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                        {student ? `${student.firstName} ${student.lastName}` : '—'}
                      </td>

                      {/* Class Score */}
                      <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          ref={el => { inputRefs.current[`${row.enr.id}_cs`] = el; }}
                          type="number" min="0" max={maxCS} step="0.5"
                          value={row.cs}
                          disabled={disabled}
                          onChange={e => updateLocal(row.enr.id, 'cs', e.target.value)}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleKeyDown(e, i, 'cs')}
                          style={{
                            width: 80, textAlign: 'center',
                            padding: '6px 8px', fontWeight: 700, fontSize: '.85rem',
                            border: `2px solid ${row.isDirty ? '#f59e0b' : disabled ? '#e2e8f0' : '#e2e8f0'}`,
                            borderRadius: 6,
                            background: disabled ? '#f8fafc' : '#fff',
                            outline: 'none', fontFamily: 'inherit',
                            cursor: disabled ? 'not-allowed' : 'text',
                            color: disabled ? '#94a3b8' : '#1e293b',
                            boxSizing: 'border-box',
                            transition: 'border-color .15s'
                          }}
                          onFocus={e => { e.target.select(); if (!disabled) e.target.style.borderColor = '#0f3460'; }}
                          onBlur={e => { e.target.style.borderColor = row.isDirty ? '#f59e0b' : '#e2e8f0'; }}
                        />
                      </td>

                      {/* Exam Score */}
                      <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          ref={el => { inputRefs.current[`${row.enr.id}_es`] = el; }}
                          type="number" min="0" max={maxES} step="0.5"
                          value={row.es}
                          disabled={disabled}
                          onChange={e => updateLocal(row.enr.id, 'es', e.target.value)}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleKeyDown(e, i, 'es')}
                          style={{
                            width: 80, textAlign: 'center',
                            padding: '6px 8px', fontWeight: 700, fontSize: '.85rem',
                            border: `2px solid ${row.isDirty ? '#f59e0b' : disabled ? '#e2e8f0' : '#e2e8f0'}`,
                            borderRadius: 6,
                            background: disabled ? '#f8fafc' : '#fff',
                            outline: 'none', fontFamily: 'inherit',
                            cursor: disabled ? 'not-allowed' : 'text',
                            color: disabled ? '#94a3b8' : '#1e293b',
                            boxSizing: 'border-box',
                            transition: 'border-color .15s'
                          }}
                          onFocus={e => { e.target.select(); if (!disabled) e.target.style.borderColor = '#0f3460'; }}
                          onBlur={e => { e.target.style.borderColor = row.isDirty ? '#f59e0b' : '#e2e8f0'; }}
                        />
                      </td>

                      {/* Total */}
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, fontSize: '.9rem', borderBottom: '1px solid #f1f5f9',
                        color: row.total !== null ? '#0f3460' : '#cbd5e1' }}>
                        {row.total !== null ? row.total : '—'}
                      </td>

                      {/* Grade */}
                      <td style={{ padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                        {row.gi ? (
                          <span style={{ fontWeight: 800, fontSize: '.88rem', color: gradeColor(row.gi.grade) }}>
                            {row.gi.grade}
                          </span>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>

                      {/* Remarks */}
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: '.74rem', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {row.gi?.remarks || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer */}
              <tfoot>
                <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, color: '#0f3460', fontSize: '.8rem' }}>
                    CLASS SUMMARY
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#0f3460' }}>
                    {rows.filter(r=>r.cs!=='').length > 0
                      ? (rows.reduce((s,r)=>s+(Number(r.cs)||0),0)/rows.filter(r=>r.cs!=='').length).toFixed(1)
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#0f3460' }}>
                    {rows.filter(r=>r.es!=='').length > 0
                      ? (rows.reduce((s,r)=>s+(Number(r.es)||0),0)/rows.filter(r=>r.es!=='').length).toFixed(1)
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#0f3460' }}>
                    {classAvg || '—'}
                  </td>
                  <td colSpan={2} style={{ padding: '10px 12px', fontSize: '.74rem', color: '#64748b' }}>
                    {enteredCount}/{rows.length} entered · {rows.filter(r=>r.isApproved).length} approved
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Sticky save bar when there are changes */}
          {dirtyCount > 0 && !entryBlocked && (
            <div style={{
              background: 'linear-gradient(90deg, #fffbeb, #fef3c7)',
              borderTop: '2px solid #fde68a',
              padding: '10px 20px',
              display: 'flex', alignItems: 'center', gap: 14
            }}>
              <span style={{ fontSize: '.83rem', color: '#92400e', fontWeight: 600 }}>
                ✏️ {dirtyCount} unsaved change{dirtyCount > 1 ? 's' : ''}
              </span>
              <button onClick={() => { setLocalScores({}); setSaved(false); }}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d97706', background: 'transparent', color: '#92400e', fontWeight: 600, cursor: 'pointer', fontSize: '.8rem', fontFamily: 'inherit' }}>
                Discard
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: '#0f3460', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '.84rem', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '.74rem', color: '#92400e', opacity: .7 }}>
                Press Tab/Enter to move between cells
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
