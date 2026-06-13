// src/pages/AssessmentControl.jsx
// NEW FILE — Requirement #4, #5, #6
// Full assessment window management and score review for School Admins

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getWindowsForSchool, setAssessmentWindow,
  lockAssessmentWindow, unlockAssessmentWindow, extendDeadline,
  getScoreAuditLog
} from '../services/assessmentService';
import {
  getScores, saveBatchScores, applyGradingScale, defaultGradingScale
} from '../services/scoreService';
import {
  adminEditScore, adminDeleteScore, adminApproveScore
} from '../services/assessmentService';
import { getStudents, getEnrollments } from '../services/studentService';

const gradingScale = defaultGradingScale();

// ── WINDOW FORM MODAL ─────────────────────────────────────────────
function WindowModal({ window: existing, classes, subjects, schoolId, onClose, onSaved }) {
  const now    = new Date();
  const pad    = n => String(n).padStart(2, '0');
  const toLocal = ms => {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    classId:      existing?.classId      || '',
    subjectId:    existing?.subjectId    || 'all',
    academicYear: existing?.academicYear || '',
    term:         existing?.term         || '1',
    openDate:     existing?.openDate     ? toLocal(existing.openDate)  : '',
    closeDate:    existing?.closeDate    ? toLocal(existing.closeDate) : '',
    isLocked:     existing?.isLocked     || false,
    note:         existing?.note         || ''
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.classId || !form.academicYear || !form.term) {
      setError('Class, academic year and term are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const config = {
        ...form,
        openDate:  form.openDate  ? new Date(form.openDate).getTime()  : null,
        closeDate: form.closeDate ? new Date(form.closeDate).getTime() : null,
      };
      await setAssessmentWindow(schoolId, config);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const classSubjects = subjects.filter(s => s.classIds?.includes(form.classId));

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{existing ? 'Edit Assessment Window' : 'Create Assessment Window'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Class *</label>
                <select required value={form.classId} onChange={e => update('classId', e.target.value)}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject (optional — leave as "All" for class-wide)</label>
                <select value={form.subjectId} onChange={e => update('subjectId', e.target.value)} disabled={!form.classId}>
                  <option value="all">All Subjects</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Academic Year *</label>
                <input required value={form.academicYear} onChange={e => update('academicYear', e.target.value)} placeholder="2024/2025" />
              </div>
              <div className="form-group">
                <label>Term *</label>
                <select value={form.term} onChange={e => update('term', e.target.value)}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <div className="form-group">
                <label>Opening Date & Time</label>
                <input type="datetime-local" value={form.openDate} onChange={e => update('openDate', e.target.value)} />
                <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Leave empty to open immediately</span>
              </div>
              <div className="form-group">
                <label>Closing Date & Time (Deadline)</label>
                <input type="datetime-local" value={form.closeDate} onChange={e => update('closeDate', e.target.value)} />
                <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Leave empty for no deadline</span>
              </div>
              <div className="form-group full">
                <label>Note (visible to teachers)</label>
                <input value={form.note} onChange={e => update('note', e.target.value)} placeholder="e.g. Term 1 scores due by Friday" />
              </div>
              <div className="form-group full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isLocked} onChange={e => update('isLocked', e.target.checked)} />
                  Lock assessment entry immediately
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Window'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SCORE EDIT MODAL ──────────────────────────────────────────────
function ScoreEditModal({ score, subject, student, onClose, onSaved, editor }) {
  const [form, setForm]   = useState({
    classScore: score?.classScore || 0,
    examScore:  score?.examScore  || 0,
    reason:     ''
  });
  const [saving, setSaving] = useState(false);

  const maxClass = subject?.maxClassScore ?? 30;
  const maxExam  = subject?.maxExamScore  ?? 70;
  const total    = Math.min(Number(form.classScore) + Number(form.examScore), maxClass + maxExam);
  const grade    = applyGradingScale(total, gradingScale);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminEditScore(score.schoolId, score.id, {
        classScore: Number(form.classScore),
        examScore:  Number(form.examScore),
        reason:     form.reason
      }, editor);
      onSaved();
      onClose();
    } catch (err) {
      alert('Edit failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Score — {student?.firstName} {student?.lastName}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.82rem' }}>
              <strong>Subject:</strong> {subject?.name} &nbsp;|&nbsp;
              <strong>Max Class:</strong> {maxClass} &nbsp;|&nbsp;
              <strong>Max Exam:</strong> {maxExam}
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Class Score (was: {score?.classScore})</label>
                <input type="number" min="0" max={maxClass} step="0.5"
                  value={form.classScore}
                  onChange={e => setForm(f => ({ ...f, classScore: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Exam Score (was: {score?.examScore})</label>
                <input type="number" min="0" max={maxExam} step="0.5"
                  value={form.examScore}
                  onChange={e => setForm(f => ({ ...f, examScore: e.target.value }))} />
              </div>
              <div className="form-group full" style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
                <span style={{ fontSize: '.8rem' }}>
                  New Total: <strong>{total}</strong> &nbsp; Grade: <strong style={{ color: grade.grade.startsWith('A') ? 'var(--success)' : grade.grade.startsWith('F') ? 'var(--danger)' : 'var(--navy)' }}>{grade.grade}</strong>
                </span>
              </div>
              <div className="form-group full">
                <label>Reason for Change *</label>
                <input required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Transcription error from mark sheet" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={saving}>
              {saving ? 'Saving…' : '✏️ Save Changes'}
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

  const [tab,     setTab]     = useState('windows');
  const [windows, setWindows] = useState([]);
  const [scores,  setScores]  = useState([]);
  const [students, setStudents] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal,   setModal]   = useState(null);
  const [selWindow, setSelWindow] = useState(null);
  const [selScore,  setSelScore]  = useState(null);

  const [scoreFilters, setScoreFilters] = useState({
    classId: '', subjectId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1'
  });

  const editor = {
    id:    userProfile?.id,
    email: userProfile?.email,
    name:  `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()
  };

  const loadWindows = useCallback(async () => {
    if (!schoolId) return;
    const w = await getWindowsForSchool(schoolId);
    setWindows(w.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  }, [schoolId]);

  const loadScores = useCallback(async () => {
    if (!schoolId || !scoreFilters.classId || !scoreFilters.subjectId) return;
    setLoading(true);
    try {
      const [allScores, allStudents, enrs] = await Promise.all([
        getScores(schoolId, { ...scoreFilters }),
        getStudents(schoolId),
        getEnrollments(schoolId, { classId: scoreFilters.classId, academicYear: scoreFilters.academicYear, term: scoreFilters.term, status: 'active' })
      ]);
      setScores(allScores);
      setStudents(allStudents);
    } finally {
      setLoading(false);
    }
  }, [schoolId, scoreFilters]);

  const loadAudit = useCallback(async () => {
    if (!schoolId) return;
    const log = await getScoreAuditLog(schoolId);
    setAuditLog(log);
  }, [schoolId]);

  useEffect(() => { loadWindows(); }, [loadWindows]);
  useEffect(() => { if (tab === 'scores') loadScores(); }, [tab, loadScores]);
  useEffect(() => { if (tab === 'audit')  loadAudit();  }, [tab, loadAudit]);

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));

  async function handleLock(win) {
    if (!window.confirm(`Lock assessment entry for ${classMap[win.classId]?.name}?`)) return;
    await lockAssessmentWindow(schoolId, win.classId, win.academicYear, win.term, win.subjectId || 'all');
    loadWindows();
  }

  async function handleUnlock(win) {
    await unlockAssessmentWindow(schoolId, win.classId, win.academicYear, win.term, win.subjectId || 'all');
    loadWindows();
  }

  async function handleExtend(win) {
    const dateStr = prompt('Enter new closing date and time (YYYY-MM-DDTHH:MM):');
    if (!dateStr) return;
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) { alert('Invalid date format.'); return; }
    await extendDeadline(schoolId, win.classId, win.academicYear, win.term, ts, win.subjectId || 'all');
    loadWindows();
  }

  async function handleDeleteScore(score) {
    const reason = prompt('Reason for deletion:');
    if (reason === null) return;
    try {
      await adminDeleteScore(schoolId, score.id, editor, reason);
      loadScores();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function handleApproveScore(score) {
    try {
      await adminApproveScore(schoolId, score.id, editor);
      loadScores();
    } catch (err) {
      alert('Approve failed: ' + err.message);
    }
  }

  function windowStatus(win) {
    const now = Date.now();
    if (win.isLocked) return { label: '🔒 Locked',   color: '#dc2626', bg: '#fee2e2' };
    if (win.openDate  && now < win.openDate)  return { label: '⏳ Scheduled', color: '#2563eb', bg: '#dbeafe' };
    if (win.closeDate && now > win.closeDate) return { label: '⌛ Closed',    color: '#7c3aed', bg: '#ede9fe' };
    return { label: '✅ Open', color: '#16a34a', bg: '#dcfce7' };
  }

  return (
    <div>
      <div className="page-header">
        <h1>Assessment Control</h1>
        {tab === 'windows' && (
          <button className="btn btn-primary" onClick={() => { setSelWindow(null); setModal('window'); }}>
            + New Assessment Window
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'windows' ? ' active' : ''}`} onClick={() => setTab('windows')}>
          Assessment Windows
        </button>
        <button className={`tab${tab === 'scores' ? ' active' : ''}`} onClick={() => setTab('scores')}>
          Review Scores
        </button>
        <button className={`tab${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>
          Audit Log
        </button>
      </div>

      {/* ── WINDOWS TAB ── */}
      {tab === 'windows' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Assessment Entry Windows</span>
            <span style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>
              Control when teachers can submit and modify scores
            </span>
          </div>
          {windows.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📅</div>
              <p>No assessment windows configured. Create one to control when teachers can enter scores.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th><th>Subject</th><th>Year/Term</th>
                    <th>Opens</th><th>Deadline</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {windows.map(win => {
                    const st = windowStatus(win);
                    return (
                      <tr key={win.id}>
                        <td style={{ fontWeight: 600 }}>{classMap[win.classId]?.name || win.classId}</td>
                        <td>{win.subjectId === 'all' ? <span className="badge badge-info">All Subjects</span> : (subjectMap[win.subjectId]?.name || win.subjectId)}</td>
                        <td className="td-mono">{win.academicYear} T{win.term}</td>
                        <td style={{ fontSize: '.78rem' }}>{win.openDate  ? new Date(win.openDate).toLocaleString('en-GH')  : '—'}</td>
                        <td style={{ fontSize: '.78rem', color: win.closeDate && Date.now() > win.closeDate ? 'var(--danger)' : 'inherit' }}>
                          {win.closeDate ? new Date(win.closeDate).toLocaleString('en-GH') : '—'}
                        </td>
                        <td>
                          <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontSize: '.72rem', fontWeight: 700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelWindow(win); setModal('window'); }}>Edit</button>
                            {win.isLocked
                              ? <button className="btn btn-success btn-sm" onClick={() => handleUnlock(win)}>Unlock</button>
                              : <button className="btn btn-danger btn-sm"  onClick={() => handleLock(win)}>Lock</button>}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleExtend(win)}>Extend</button>
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
      )}

      {/* ── SCORES REVIEW TAB ── */}
      {tab === 'scores' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="filter-bar">
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Class</label>
                <select value={scoreFilters.classId} onChange={e => setScoreFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select value={scoreFilters.subjectId} onChange={e => setScoreFilters(f => ({ ...f, subjectId: e.target.value }))} disabled={!scoreFilters.classId}>
                  <option value="">— Select Subject —</option>
                  {subjects.filter(s => s.classIds?.includes(scoreFilters.classId)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Year</label>
                <input value={scoreFilters.academicYear} onChange={e => setScoreFilters(f => ({ ...f, academicYear: e.target.value }))} style={{ maxWidth: 120 }} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Term</label>
                <select value={scoreFilters.term} onChange={e => setScoreFilters(f => ({ ...f, term: e.target.value }))} style={{ maxWidth: 100 }}>
                  <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
                </select>
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <button onClick={loadScores} className="btn btn-primary" disabled={!scoreFilters.classId || !scoreFilters.subjectId}>Load Scores</button>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : !scoreFilters.classId || !scoreFilters.subjectId ? (
              <div className="empty-state"><div className="icon">✏️</div><p>Select a class and subject to review scores.</p></div>
            ) : scores.length === 0 ? (
              <div className="empty-state"><div className="icon">📝</div><p>No scores entered yet for this selection.</p></div>
            ) : (
              <div className="table-wrap">
                <table className="score-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Student</th><th>Class Score</th><th>Exam Score</th>
                      <th>Total</th><th>Grade</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, i) => {
                      const student = studentMap[score.studentId];
                      const subject = subjectMap[score.subjectId];
                      const grade   = applyGradingScale(score.total, gradingScale);
                      return (
                        <tr key={score.id} style={{ background: score.adminModified ? '#fffbeb' : '' }}>
                          <td style={{ color: 'var(--text-lt)' }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>{student?.studentCode}</div>
                          </td>
                          <td>{score.classScore}</td>
                          <td>{score.examScore}</td>
                          <td style={{ fontWeight: 800 }}>{score.total}</td>
                          <td style={{ fontWeight: 700, color: grade.grade.startsWith('A') ? 'var(--success)' : grade.grade.startsWith('F') ? 'var(--danger)' : 'var(--navy)' }}>
                            {grade.grade}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {score.isApproved    && <span className="badge badge-success">✓ Approved</span>}
                              {score.adminModified && <span className="badge badge-warning">✏️ Edited</span>}
                              {score.isFinalized   && <span className="badge badge-info">🔒 Final</span>}
                              {!score.isApproved && !score.isFinalized && <span className="badge badge-neutral">Pending</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              {!score.isFinalized && (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelScore(score); setModal('editScore'); }}>
                                  ✏️ Edit
                                </button>
                              )}
                              {!score.isApproved && !score.isFinalized && (
                                <button className="btn btn-success btn-sm" onClick={() => handleApproveScore(score)}>
                                  ✓
                                </button>
                              )}
                              {!score.isFinalized && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteScore(score)}>
                                  🗑
                                </button>
                              )}
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
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Score Audit Log</span>
            <span style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>All admin modifications to teacher scores</span>
          </div>
          {auditLog.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>No audit entries yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th><th>Action</th><th>Editor</th>
                    <th>Previous</th><th>New Value</th><th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '.76rem' }}>{new Date(log.timestamp).toLocaleString('en-GH')}</td>
                      <td>
                        <span className={`badge ${log.action === 'delete' ? 'badge-danger' : log.action === 'approve' ? 'badge-success' : 'badge-warning'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '.78rem' }}>{log.editorEmail}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>
                        {log.previousValue ? `CS:${log.previousValue.classScore} ES:${log.previousValue.examScore} T:${log.previousValue.total}` : '—'}
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>
                        {log.newValue ? `CS:${log.newValue.classScore} ES:${log.newValue.examScore} T:${log.newValue.total}` : 'Deleted'}
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-mid)', maxWidth: 200 }}>{log.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal === 'window' && (
        <WindowModal
          window={selWindow}
          classes={classes}
          subjects={subjects}
          schoolId={schoolId}
          onClose={() => setModal(null)}
          onSaved={loadWindows}
        />
      )}
      {modal === 'editScore' && selScore && (
        <ScoreEditModal
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
