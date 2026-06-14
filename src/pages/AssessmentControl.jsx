// src/pages/AssessmentControl.jsx
// Full rewrite — professional Excel-like assessment management

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool }  from '../contexts/SchoolContext';
import { useAuth }    from '../contexts/AuthContext';
import {
  getWindowsForSchool, setAssessmentWindow,
  lockAssessmentWindow, unlockAssessmentWindow, extendDeadline,
  getScoreAuditLog, adminEditScore, adminDeleteScore, adminApproveScore
} from '../services/assessmentService';
import {
  getScores, applyGradingScale, defaultGradingScale
} from '../services/scoreService';
import { getStudents, getEnrollments } from '../services/studentService';

const GRADE_SCALE = defaultGradingScale();

function gradeColor(grade) {
  if (!grade || grade === 'N/A') return '#94a3b8';
  if (grade === 'A1')            return '#16a34a';
  if (grade.startsWith('B'))     return '#2563eb';
  if (grade.startsWith('C'))     return '#d97706';
  if (grade.startsWith('D') || grade.startsWith('E')) return '#ea580c';
  return '#dc2626';
}

// ── REUSABLE COMPONENTS ───────────────────────────────────────────
function Pill({ color, bg, children }) {
  return (
    <span style={{
      background: bg, color, fontWeight: 700,
      fontSize: '.68rem', padding: '3px 10px',
      borderRadius: 20, display: 'inline-block',
      textTransform: 'uppercase', letterSpacing: '.04em',
      whiteSpace: 'nowrap'
    }}>{children}</span>
  );
}

function WindowStatusPill({ win }) {
  const now = Date.now();
  if (!win) return null;
  if (win.isLocked)                              return <Pill color="#991b1b" bg="#fee2e2">🔒 Locked</Pill>;
  if (win.openDate  && now < win.openDate)       return <Pill color="#1d4ed8" bg="#dbeafe">⏳ Scheduled</Pill>;
  if (win.closeDate && now > win.closeDate)      return <Pill color="#6d28d9" bg="#ede9fe">⌛ Closed</Pill>;
  if (win.closeDate) {
    const days = Math.ceil((win.closeDate - now) / 864e5);
    return days <= 2
      ? <Pill color="#92400e" bg="#fef3c7">⚠ {days}d left</Pill>
      : <Pill color="#15803d" bg="#dcfce7">✅ Open · {days}d left</Pill>;
  }
  return <Pill color="#15803d" bg="#dcfce7">✅ Open</Pill>;
}

// ── WINDOW MODAL ──────────────────────────────────────────────────
function WindowModal({ win, classes, subjects, schoolId, onClose, onSaved }) {
  const pad = n => String(n).padStart(2, '0');
  const toLocal = ms => {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    classId:      win?.classId      || '',
    subjectId:    win?.subjectId    || 'all',
    academicYear: win?.academicYear || '',
    term:         win?.term         || '1',
    openDate:     win?.openDate     ? toLocal(win.openDate)  : '',
    closeDate:    win?.closeDate    ? toLocal(win.closeDate) : '',
    isLocked:     win?.isLocked     || false,
    note:         win?.note         || ''
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const fn = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const classSubjects = subjects.filter(s => s.classIds?.includes(form.classId));

  async function handleSave(e) {
    e.preventDefault();
    if (!form.classId || !form.academicYear || !form.term) {
      setError('Class, academic year and term are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      await setAssessmentWindow(schoolId, {
        ...form,
        openDate:  form.openDate  ? new Date(form.openDate).getTime()  : null,
        closeDate: form.closeDate ? new Date(form.closeDate).getTime() : null,
      });
      onSaved(); onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{win ? 'Edit Assessment Window' : 'New Assessment Window'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && <div className="alert alert-danger" style={{ marginBottom: 0 }}>{error}</div>}

            <div className="form-grid">
              <div className="form-group">
                <label>Class *</label>
                <select required value={form.classId} onChange={e => fn('classId', e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <select value={form.subjectId} onChange={e => fn('subjectId', e.target.value)} disabled={!form.classId}>
                  <option value="all">All Subjects</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Academic Year *</label>
                <input required value={form.academicYear} onChange={e => fn('academicYear', e.target.value)} placeholder="2024/2025" />
              </div>
              <div className="form-group">
                <label>Term *</label>
                <select value={form.term} onChange={e => fn('term', e.target.value)}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <div className="form-group">
                <label>Opening Date & Time</label>
                <input type="datetime-local" value={form.openDate} onChange={e => fn('openDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Closing Date (Deadline)</label>
                <input type="datetime-local" value={form.closeDate} onChange={e => fn('closeDate', e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Note for Teachers</label>
                <input value={form.note} onChange={e => fn('note', e.target.value)} placeholder="e.g. Submit all scores by end of week" />
              </div>
              <div className="form-group full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500 }}>
                  <input type="checkbox" checked={form.isLocked} onChange={e => fn('isLocked', e.target.checked)} />
                  Lock entry immediately
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : win ? 'Update Window' : 'Create Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SCORE EDIT MODAL ──────────────────────────────────────────────
function EditScoreModal({ score, subject, student, editor, onClose, onSaved }) {
  const maxCS   = subject?.maxClassScore ?? 30;
  const maxES   = subject?.maxExamScore  ?? 70;
  const [cs,    setCs]    = useState(String(score?.classScore ?? ''));
  const [es,    setEs]    = useState(String(score?.examScore  ?? ''));
  const [reason,setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const total = Math.min((Number(cs)||0) + (Number(es)||0), maxCS + maxES);
  const gi    = applyGradingScale(total, GRADE_SCALE);

  async function handleSave(e) {
    e.preventDefault();
    if (!reason.trim()) { alert('Please enter a reason for the change.'); return; }
    setSaving(true);
    try {
      await adminEditScore(score.schoolId, score.id, {
        classScore: Number(cs), examScore: Number(es), reason
      }, editor);
      onSaved(); onClose();
    } catch (err) { alert('Edit failed: ' + err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit Score</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginTop: 2 }}>
              {student?.firstName} {student?.lastName} · {subject?.name}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {/* Before/after comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: '.7rem', color: '#991b1b', fontWeight: 700, marginBottom: 4 }}>BEFORE</div>
                <div style={{ fontSize: '.82rem' }}>CS: <strong>{score?.classScore}</strong> · ES: <strong>{score?.examScore}</strong></div>
                <div style={{ fontSize: '.82rem' }}>Total: <strong>{score?.total}</strong></div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: '.7rem', color: '#15803d', fontWeight: 700, marginBottom: 4 }}>AFTER</div>
                <div style={{ fontSize: '.82rem' }}>CS: <strong>{cs||0}</strong> · ES: <strong>{es||0}</strong></div>
                <div style={{ fontSize: '.82rem' }}>Total: <strong style={{ color: gradeColor(gi.grade) }}>{total} ({gi.grade})</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Class Score <span style={{ color: 'var(--text-lt)' }}>/ {maxCS}</span></label>
                <input type="number" min="0" max={maxCS} step="0.5" value={cs}
                  onChange={e => setCs(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Exam Score <span style={{ color: 'var(--text-lt)' }}>/ {maxES}</span></label>
                <input type="number" min="0" max={maxES} step="0.5" value={es}
                  onChange={e => setEs(e.target.value)} style={{ textAlign: 'center', fontWeight: 700 }} />
              </div>
            </div>

            <div className="form-group">
              <label>Reason for Change *</label>
              <input required value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g. Transcription error from mark sheet" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function AssessmentControl() {
  const { school, classes, subjects, schoolId } = useSchool();
  const { userProfile } = useAuth();

  const [tab,      setTab]      = useState('scores');
  const [windows,  setWindows]  = useState([]);
  const [scores,   setScores]   = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [modal,    setModal]    = useState(null);
  const [selWin,   setSelWin]   = useState(null);
  const [selScore, setSelScore] = useState(null);
  const [editedScores, setEditedScores] = useState({}); // local edits before save

  const defaultYear = school?.academicYear || '';
  const defaultTerm = school?.currentTerm  || '1';

  const [filters, setFilters] = useState({
    classId: '', subjectId: '', academicYear: defaultYear, term: defaultTerm
  });

  const editor = {
    id:    userProfile?.id,
    email: userProfile?.email,
    name:  `${userProfile?.firstName||''} ${userProfile?.lastName||''}`.trim()
  };

  // Update defaults when school loads
  useEffect(() => {
    if (school) {
      setFilters(f => ({
        ...f,
        academicYear: f.academicYear || school.academicYear || '',
        term:         f.term         || school.currentTerm  || '1'
      }));
    }
  }, [school]);

  const classSubjects = subjects.filter(s => s.classIds?.includes(filters.classId));
  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  // ── LOADERS ─────────────────────────────────────────────────────
  const loadWindows = useCallback(async () => {
    if (!schoolId) return;
    const w = await getWindowsForSchool(schoolId);
    setWindows(w.sort((a, b) => (b.updatedAt||0) - (a.updatedAt||0)));
  }, [schoolId]);

  const loadScores = useCallback(async () => {
    if (!schoolId || !filters.classId || !filters.subjectId) return;
    setLoading(true);
    setEditedScores({});
    try {
      const [sc, st, en] = await Promise.all([
        getScores(schoolId, { ...filters }),
        getStudents(schoolId),
        getEnrollments(schoolId, {
          classId: filters.classId, academicYear: filters.academicYear,
          term: filters.term, status: 'active'
        })
      ]);
      setScores(sc);
      setStudents(st);
      setEnrollments(en);
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters]);

  const loadAudit = useCallback(async () => {
    if (!schoolId) return;
    const log = await getScoreAuditLog(schoolId);
    setAuditLog(log);
  }, [schoolId]);

  useEffect(() => { loadWindows(); }, [loadWindows]);
  useEffect(() => { if (tab === 'scores')  loadScores();  }, [tab, loadScores]);
  useEffect(() => { if (tab === 'windows') loadWindows(); }, [tab, loadWindows]);
  useEffect(() => { if (tab === 'audit')   loadAudit();   }, [tab, loadAudit]);

  // Build display rows — merge enrollments with scores
  const displayRows = enrollments.map(enr => {
    const existing = scores.find(s => s.enrollmentId === enr.id);
    const local    = editedScores[enr.id];
    const cs  = local?.classScore ?? existing?.classScore ?? '';
    const es  = local?.examScore  ?? existing?.examScore  ?? '';
    const maxCS = selectedSubject?.maxClassScore ?? 30;
    const maxES = selectedSubject?.maxExamScore  ?? 70;
    const total = cs !== '' || es !== '' ? Math.min((Number(cs)||0)+(Number(es)||0), maxCS+maxES) : null;
    const gi    = total !== null ? applyGradingScale(total, GRADE_SCALE) : null;
    return { enr, existing, cs, es, total, gi, isEdited: !!local,
             isApproved: existing?.isApproved, isFinalized: existing?.isFinalized };
  });

  function updateLocal(enrollmentId, field, value) {
    setEditedScores(prev => ({
      ...prev,
      [enrollmentId]: { ...(prev[enrollmentId] || {}), [field]: value }
    }));
    setSaved(false);
  }

  async function handleAdminSave() {
    if (!filters.classId || !filters.subjectId) return;
    const changed = Object.entries(editedScores);
    if (changed.length === 0) { alert('No changes to save.'); return; }
    setSaving(true);
    try {
      const { saveBatchScores } = await import('../services/scoreService');
      const batch = changed.map(([enrollmentId, vals]) => {
        const enr = enrollments.find(e => e.id === enrollmentId);
        return {
          enrollmentId,
          studentId:    enr?.studentId,
          classId:      filters.classId,
          subjectId:    filters.subjectId,
          academicYear: filters.academicYear,
          term:         filters.term,
          classScore:   Number(vals.classScore ?? 0),
          examScore:    Number(vals.examScore  ?? 0)
        };
      });
      await saveBatchScores(schoolId, batch, 'admin');
      setSaved(true);
      setEditedScores({});
      setTimeout(() => setSaved(false), 3000);
      await loadScores();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAll() {
    if (!window.confirm(`Approve all scores for ${selectedSubject?.name}?`)) return;
    const toApprove = scores.filter(s => !s.isApproved && !s.isFinalized);
    for (const s of toApprove) {
      await adminApproveScore(schoolId, s.id, editor);
    }
    await loadScores();
  }

  async function handleDeleteScore(score) {
    const reason = window.prompt('Reason for deletion:');
    if (reason === null) return;
    try {
      await adminDeleteScore(schoolId, score.id, editor, reason);
      await loadScores();
    } catch (err) { alert('Delete failed: ' + err.message); }
  }

  async function handleLockWindow(win) {
    if (!window.confirm(`Lock assessment entry for ${classMap[win.classId]?.name}? Teachers will not be able to submit scores.`)) return;
    await lockAssessmentWindow(schoolId, win.classId, win.academicYear, win.term, win.subjectId || 'all');
    loadWindows();
  }

  async function handleUnlockWindow(win) {
    await unlockAssessmentWindow(schoolId, win.classId, win.academicYear, win.term, win.subjectId || 'all');
    loadWindows();
  }

  async function handleExtend(win) {
    const input = window.prompt('New closing date and time (YYYY-MM-DDTHH:MM):');
    if (!input) return;
    const ts = new Date(input).getTime();
    if (isNaN(ts)) { alert('Invalid date format. Use: YYYY-MM-DDTHH:MM'); return; }
    await extendDeadline(schoolId, win.classId, win.academicYear, win.term, ts, win.subjectId || 'all');
    loadWindows();
  }

  const maxCS = selectedSubject?.maxClassScore ?? 30;
  const maxES = selectedSubject?.maxExamScore  ?? 70;
  const hasEdits = Object.keys(editedScores).length > 0;
  const pendingCount = scores.filter(s => !s.isApproved && !s.isFinalized).length;

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Assessment Control</h1>
          <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginTop: 2 }}>
            Manage score entry windows · Review and approve teacher submissions
          </p>
        </div>
        <div className="actions">
          {tab === 'windows' && (
            <button className="btn btn-primary" onClick={() => { setSelWin(null); setModal('window'); }}>
              + New Window
            </button>
          )}
          {tab === 'scores' && filters.classId && filters.subjectId && (
            <>
              {pendingCount > 0 && (
                <button className="btn btn-success btn-sm" onClick={handleApproveAll}>
                  ✓ Approve All ({pendingCount})
                </button>
              )}
              {hasEdits && (
                <button className="btn btn-primary" onClick={handleAdminSave} disabled={saving}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : `Save Changes (${Object.keys(editedScores).length})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab==='scores'  ? ' active':''}`} onClick={() => setTab('scores')}>
          Score Review
        </button>
        <button className={`tab${tab==='windows' ? ' active':''}`} onClick={() => setTab('windows')}>
          Entry Windows {windows.length > 0 && <span style={{ marginLeft: 5, background: '#0f3460', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '.68rem' }}>{windows.length}</span>}
        </button>
        <button className={`tab${tab==='audit'   ? ' active':''}`} onClick={() => setTab('audit')}>
          Audit Log
        </button>
      </div>

      {/* ── SCORE REVIEW TAB ────────────────────────────────────── */}
      {tab === 'scores' && (
        <div>
          {/* Filter bar */}
          <div style={{
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 18px',
            marginBottom: 14, boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ minWidth: 180 }}>
                <label style={{ fontSize: '.72rem' }}>Class</label>
                <select value={filters.classId}
                  onChange={e => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 180 }}>
                <label style={{ fontSize: '.72rem' }}>Subject</label>
                <select value={filters.subjectId}
                  onChange={e => setFilters(f => ({ ...f, subjectId: e.target.value }))}
                  disabled={!filters.classId}>
                  <option value="">— Select Subject —</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 120 }}>
                <label style={{ fontSize: '.72rem' }}>Academic Year</label>
                <input value={filters.academicYear}
                  onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} />
              </div>
              <div className="form-group" style={{ minWidth: 100 }}>
                <label style={{ fontSize: '.72rem' }}>Term</label>
                <select value={filters.term}
                  onChange={e => setFilters(f => ({ ...f, term: e.target.value }))}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <button className="btn btn-primary btn-sm"
                onClick={loadScores}
                disabled={!filters.classId || !filters.subjectId || loading}
                style={{ alignSelf: 'flex-end' }}>
                {loading ? 'Loading…' : 'Load'}
              </button>
            </div>

            {/* Score summary bar */}
            {selectedSubject && enrollments.length > 0 && (
              <div style={{
                display: 'flex', gap: 20, marginTop: 12,
                padding: '8px 0', borderTop: '1px solid var(--border)',
                fontSize: '.78rem', color: 'var(--text-mid)', flexWrap: 'wrap'
              }}>
                <span><strong style={{ color: 'var(--navy)' }}>{enrollments.length}</strong> students</span>
                <span><strong style={{ color: 'var(--navy)' }}>{scores.filter(s => s.total > 0).length}</strong> scores entered</span>
                <span><strong style={{ color: 'var(--success)' }}>{scores.filter(s => s.isApproved).length}</strong> approved</span>
                <span style={{ color: 'var(--text-lt)' }}>Max CS: {maxCS} · Max ES: {maxES} · Total: {maxCS+maxES}</span>
                {hasEdits && (
                  <span style={{ color: 'var(--warning)', fontWeight: 700 }}>
                    ✏️ {Object.keys(editedScores).length} unsaved change{Object.keys(editedScores).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Excel-like Score Table */}
          {!filters.classId || !filters.subjectId ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '60px 20px',
              textAlign: 'center', color: 'var(--text-lt)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
              <p style={{ fontSize: '.9rem' }}>Select a class and subject to review scores.</p>
            </div>
          ) : loading ? (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 40 }}>
              <div className="spinner-center"><div className="spinner" /></div>
            </div>
          ) : enrollments.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '60px 20px',
              textAlign: 'center', color: 'var(--text-lt)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👥</div>
              <p style={{ fontSize: '.9rem' }}>No active enrollments in this class/term.</p>
            </div>
          ) : (
            <div style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)', overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
                  <thead>
                    <tr style={{ background: '#0f3460' }}>
                      <th style={thStyle('#0f3460')}>#</th>
                      <th style={thStyle('#0f3460')}>Student ID</th>
                      <th style={{ ...thStyle('#0f3460'), textAlign: 'left', minWidth: 180 }}>Student Name</th>
                      <th style={thStyle('#1a4a7a')}>
                        Class Score
                        <div style={{ fontSize: '.62rem', fontWeight: 400, opacity: .8 }}>max {maxCS}</div>
                      </th>
                      <th style={thStyle('#1a4a7a')}>
                        Exam Score
                        <div style={{ fontSize: '.62rem', fontWeight: 400, opacity: .8 }}>max {maxES}</div>
                      </th>
                      <th style={thStyle('#162d52')}>Total</th>
                      <th style={thStyle('#162d52')}>Grade</th>
                      <th style={thStyle('#0d2844')}>Status</th>
                      <th style={thStyle('#0d2844')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, i) => {
                      const student = studentMap[row.enr.studentId];
                      const isEven  = i % 2 === 0;
                      const rowBg   = row.isEdited    ? '#fffbeb'
                                    : row.isApproved  ? '#f0fdf4'
                                    : isEven          ? '#fff'
                                    : '#f8fafc';

                      return (
                        <tr key={row.enr.id}
                          style={{ background: rowBg, transition: 'background .1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                          onMouseLeave={e => e.currentTarget.style.background = rowBg}
                        >
                          {/* # */}
                          <td style={{ ...tdStyle, width: 40, textAlign: 'center', color: 'var(--text-lt)', fontWeight: 600 }}>
                            {i + 1}
                          </td>

                          {/* Student ID */}
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '.76rem', color: 'var(--text-mid)' }}>
                            {student?.studentCode || '—'}
                          </td>

                          {/* Student Name */}
                          <td style={{ ...tdStyle, fontWeight: 600 }}>
                            {student ? `${student.firstName} ${student.lastName}` : '—'}
                          </td>

                          {/* Class Score input */}
                          <td style={{ ...tdStyle, textAlign: 'center', padding: '5px 8px' }}>
                            <input
                              type="number" min="0" max={maxCS} step="0.5"
                              value={row.cs}
                              disabled={row.isFinalized}
                              onChange={e => updateLocal(row.enr.id, 'classScore', e.target.value)}
                              onFocus={e => e.target.select()}
                              style={{
                                width: 70, textAlign: 'center',
                                padding: '5px 6px', fontWeight: 700, fontSize: '.82rem',
                                border: `1.5px solid ${row.isEdited ? '#f59e0b' : 'var(--border)'}`,
                                borderRadius: 6, background: row.isFinalized ? '#f8fafc' : '#fff',
                                outline: 'none', fontFamily: 'var(--font)',
                                cursor: row.isFinalized ? 'not-allowed' : 'text',
                                boxSizing: 'border-box'
                              }}
                              onFocus_={e => !row.isFinalized && (e.target.style.borderColor = '#0f3460')}
                            />
                          </td>

                          {/* Exam Score input */}
                          <td style={{ ...tdStyle, textAlign: 'center', padding: '5px 8px' }}>
                            <input
                              type="number" min="0" max={maxES} step="0.5"
                              value={row.es}
                              disabled={row.isFinalized}
                              onChange={e => updateLocal(row.enr.id, 'examScore', e.target.value)}
                              onFocus={e => e.target.select()}
                              style={{
                                width: 70, textAlign: 'center',
                                padding: '5px 6px', fontWeight: 700, fontSize: '.82rem',
                                border: `1.5px solid ${row.isEdited ? '#f59e0b' : 'var(--border)'}`,
                                borderRadius: 6, background: row.isFinalized ? '#f8fafc' : '#fff',
                                outline: 'none', fontFamily: 'var(--font)',
                                cursor: row.isFinalized ? 'not-allowed' : 'text',
                                boxSizing: 'border-box'
                              }}
                            />
                          </td>

                          {/* Total */}
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, fontSize: '.9rem',
                            color: row.total !== null ? 'var(--navy)' : 'var(--text-lt)' }}>
                            {row.total !== null ? row.total : '—'}
                          </td>

                          {/* Grade */}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {row.gi ? (
                              <span style={{
                                fontWeight: 800, fontSize: '.88rem',
                                color: gradeColor(row.gi.grade)
                              }}>{row.gi.grade}</span>
                            ) : <span style={{ color: 'var(--text-lt)' }}>—</span>}
                          </td>

                          {/* Status */}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {row.isFinalized
                              ? <Pill color="#1d4ed8" bg="#dbeafe">Final</Pill>
                              : row.isApproved
                              ? <Pill color="#15803d" bg="#dcfce7">Approved</Pill>
                              : row.existing?.total > 0
                              ? <Pill color="#92400e" bg="#fef3c7">Pending</Pill>
                              : <span style={{ color: 'var(--text-lt)', fontSize: '.75rem' }}>—</span>}
                          </td>

                          {/* Actions */}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {row.existing && !row.isFinalized && (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                {!row.isApproved && (
                                  <button
                                    onClick={() => adminApproveScore(schoolId, row.existing.id, editor).then(loadScores)}
                                    title="Approve"
                                    style={iconBtn('#dcfce7', '#15803d')}>✓</button>
                                )}
                                <button
                                  onClick={() => { setSelScore(row.existing); setModal('editScore'); }}
                                  title="Edit"
                                  style={iconBtn('#fef3c7', '#92400e')}>✏</button>
                                <button
                                  onClick={() => handleDeleteScore(row.existing)}
                                  title="Delete"
                                  style={iconBtn('#fee2e2', '#991b1b')}>✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Footer summary */}
                  {displayRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f1f5f9', borderTop: '2px solid var(--border)' }}>
                        <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: 'var(--navy)' }}>
                          Class Average
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--navy)' }}>
                          {displayRows.filter(r => r.cs !== '').length > 0
                            ? (displayRows.reduce((s, r) => s + (Number(r.cs)||0), 0) / displayRows.filter(r=>r.cs!=='').length).toFixed(1)
                            : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--navy)' }}>
                          {displayRows.filter(r => r.es !== '').length > 0
                            ? (displayRows.reduce((s, r) => s + (Number(r.es)||0), 0) / displayRows.filter(r=>r.es!=='').length).toFixed(1)
                            : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: 'var(--navy)' }}>
                          {displayRows.filter(r => r.total !== null).length > 0
                            ? (displayRows.reduce((s, r) => s + (r.total||0), 0) / displayRows.filter(r=>r.total!==null).length).toFixed(1)
                            : '—'}
                        </td>
                        <td colSpan={3} style={{ ...tdStyle, color: 'var(--text-lt)', fontSize: '.75rem' }}>
                          {displayRows.filter(r => r.total !== null).length}/{displayRows.length} entered
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Save bar */}
              {hasEdits && (
                <div style={{
                  background: 'linear-gradient(90deg, #fffbeb, #fef3c7)',
                  borderTop: '1px solid #fde68a',
                  padding: '10px 18px',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <span style={{ fontSize: '.82rem', color: '#92400e', fontWeight: 600 }}>
                    ✏️ You have {Object.keys(editedScores).length} unsaved change{Object.keys(editedScores).length > 1 ? 's' : ''}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditedScores({})}>Discard</button>
                  <button className="btn btn-primary btn-sm" onClick={handleAdminSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save All Changes'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── WINDOWS TAB ─────────────────────────────────────────── */}
      {tab === 'windows' && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Assessment Entry Windows</span>
              <p style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginTop: 2 }}>
                Control when teachers can submit and modify scores
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setSelWin(null); setModal('window'); }}>
              + New Window
            </button>
          </div>

          {windows.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-lt)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</div>
              <p style={{ fontSize: '.88rem' }}>No windows yet. Create one to control teacher score entry.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={th2}>Class</th>
                  <th style={th2}>Subject</th>
                  <th style={th2}>Year / Term</th>
                  <th style={th2}>Opens</th>
                  <th style={th2}>Deadline</th>
                  <th style={th2}>Status</th>
                  <th style={th2}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((win, i) => (
                  <tr key={win.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{classMap[win.classId]?.name || win.classId}</td>
                    <td style={tdStyle}>
                      {win.subjectId === 'all'
                        ? <span style={{ fontStyle: 'italic', color: 'var(--text-mid)' }}>All Subjects</span>
                        : (subjectMap[win.subjectId]?.name || win.subjectId)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '.76rem' }}>
                      {win.academicYear} · T{win.term}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '.76rem', color: 'var(--text-mid)' }}>
                      {win.openDate ? new Date(win.openDate).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '.76rem', color: win.closeDate && Date.now() > win.closeDate ? 'var(--danger)' : 'var(--text-mid)' }}>
                      {win.closeDate ? new Date(win.closeDate).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={tdStyle}><WindowStatusPill win={win} /></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelWin(win); setModal('window'); }}>Edit</button>
                        {win.isLocked
                          ? <button className="btn btn-success btn-sm" onClick={() => handleUnlockWindow(win)}>Unlock</button>
                          : <button className="btn btn-danger  btn-sm" onClick={() => handleLockWindow(win)}>Lock</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => handleExtend(win)}>Extend</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── AUDIT LOG TAB ───────────────────────────────────────── */}
      {tab === 'audit' && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Score Audit Log</span>
            <p style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginTop: 2 }}>
              Every admin modification to teacher-submitted scores
            </p>
          </div>
          {auditLog.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-lt)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: '.88rem' }}>No audit entries yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.81rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={th2}>Time</th>
                  <th style={th2}>Action</th>
                  <th style={th2}>Editor</th>
                  <th style={th2}>Before</th>
                  <th style={th2}>After</th>
                  <th style={th2}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((log, i) => (
                  <tr key={log.id} style={{ background: i%2===0?'#fff':'#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontSize: '.74rem', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-GH', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={tdStyle}>
                      <Pill
                        color={log.action==='delete'?'#991b1b':log.action==='approve'?'#15803d':'#92400e'}
                        bg={log.action==='delete'?'#fee2e2':log.action==='approve'?'#dcfce7':'#fef3c7'}
                      >{log.action}</Pill>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '.74rem' }}>{log.editorEmail}</td>
                    <td style={{ ...tdStyle, fontSize: '.74rem', color: 'var(--text-mid)' }}>
                      {log.previousValue
                        ? `CS:${log.previousValue.classScore} ES:${log.previousValue.examScore} T:${log.previousValue.total}`
                        : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '.74rem', color: 'var(--text-mid)' }}>
                      {log.newValue
                        ? `CS:${log.newValue.classScore} ES:${log.newValue.examScore} T:${log.newValue.total}`
                        : <span style={{ color: 'var(--danger)' }}>Deleted</span>}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '.74rem', color: 'var(--text-mid)', maxWidth: 220 }}>
                      {log.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {modal === 'window' && (
        <WindowModal
          win={selWin}
          classes={classes} subjects={subjects} schoolId={schoolId}
          onClose={() => setModal(null)}
          onSaved={loadWindows}
        />
      )}
      {modal === 'editScore' && selScore && (
        <EditScoreModal
          score={selScore}
          subject={subjectMap[selScore.subjectId]}
          student={studentMap[selScore.studentId]}
          editor={editor}
          onClose={() => setModal(null)}
          onSaved={() => { loadScores(); loadAudit(); }}
        />
      )}
    </div>
  );
}

// ── STYLE CONSTANTS ───────────────────────────────────────────────
const thStyle = (bg = '#0f3460') => ({
  background: bg,
  color: '#fff',
  padding: '10px 12px',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '.72rem',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,.1)'
});

const th2 = {
  background: '#f1f5f9',
  color: '#475569',
  padding: '9px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '.7rem',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '9px 12px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle'
};

const iconBtn = (bg, color) => ({
  width: 26, height: 26,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: bg, color, border: 'none', borderRadius: 6,
  cursor: 'pointer', fontWeight: 700, fontSize: '.8rem',
  transition: 'opacity .15s',
  fontFamily: 'inherit'
});
