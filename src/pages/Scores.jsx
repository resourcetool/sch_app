// src/pages/Scores.jsx
//
// Changes:
// - Teachers see a deadline status banner and are blocked from saving after the deadline
//   (frontend validation + service-layer enforcement in scoreService).
// - School Admins see all submitted scores with edit / delete / approve controls.
// - Admin edit modal records a reason and writes an audit log entry.
// - Admin delete prompts for a reason before deleting.
// - Admin approve marks a score as finalised.
// - saveBatchScores() is called with { userRole } so the service layer can enforce the deadline.

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import { getEnrollments, getStudents } from '../services/studentService';
import {
  getScores, saveScore, saveBatchScores,
  defaultGradingScale, applyGradingScale,
} from '../services/scoreService';
import {
  getAssessmentDeadline, checkDeadlineStatus,
  adminEditScore, adminDeleteScore, adminApproveScore,
  getAllSchoolScores,
} from '../services/assessmentService';

// ── DEADLINE BANNER ───────────────────────────────────────────────

function DeadlineBanner({ deadline }) {
  if (!deadline) return null;
  const { allowed, reason } = checkDeadlineStatus(deadline);
  const now = Date.now();

  const closeDate = deadline.closeAt ? new Date(deadline.closeAt).toLocaleString() : null;
  const openDate  = deadline.openAt  ? new Date(deadline.openAt).toLocaleString()  : null;

  if (!allowed) {
    return (
      <div className="alert alert-danger" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>🔒</span>
        <div>
          <strong>Entry Closed</strong>
          <div style={{ fontSize: '.84rem', marginTop: 2 }}>{reason}</div>
        </div>
      </div>
    );
  }

  if (closeDate) {
    return (
      <div className="alert alert-warning" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>⏰</span>
        <div>
          <strong>Deadline:</strong> {closeDate}
          {deadline.label && <span style={{ marginLeft: 8, opacity: .7, fontSize: '.82rem' }}>({deadline.label})</span>}
        </div>
      </div>
    );
  }

  return null;
}

// ── ADMIN EDIT SCORE MODAL ────────────────────────────────────────

function AdminEditModal({ score, schoolId, userProfile, onClose, onSaved }) {
  const [classScore, setClassScore] = useState(score.classScore ?? 0);
  const [examScore,  setExamScore]  = useState(score.examScore  ?? 0);
  const [reason,     setReason]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (Number(classScore) < 0 || Number(examScore) < 0) {
      setError('Scores cannot be negative.'); return;
    }
    setSaving(true);
    setError('');
    try {
      await adminEditScore(
        score.id,
        schoolId,
        { classScore: Number(classScore), examScore: Number(examScore) },
        { uid: userProfile.id, email: userProfile.email },
        reason
      );
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
                <input
                  type="number" min="0" step="0.5"
                  value={classScore}
                  onChange={e => setClassScore(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Exam Score</label>
                <input
                  type="number" min="0" step="0.5"
                  value={examScore}
                  onChange={e => setExamScore(e.target.value)}
                />
              </div>
              <div className="form-group full">
                <label>Reason for Change (optional but recommended)</label>
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Data entry error corrected"
                />
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', marginTop: 8 }}>
              New total: <strong>{(Number(classScore) || 0) + (Number(examScore) || 0)}</strong>
              &nbsp;· This change will be recorded in the audit log.
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

// ── MAIN SCORES PAGE ──────────────────────────────────────────────

export default function Scores() {
  const { school, classes, subjects, schoolId } = useSchool();
  const { userProfile } = useAuth();

  const isAdmin = userProfile?.role === 'admin';

  const [tab, setTab] = useState(isAdmin ? 'teacher-entry' : 'entry');

  // Teacher entry state
  const [filters, setFilters] = useState({
    classId:      '',
    subjectId:    '',
    academicYear: school?.academicYear || '',
    term:         school?.currentTerm  || '1',
  });
  const [enrollments,  setEnrollments]  = useState([]);
  const [students,     setStudents]     = useState([]);
  const [scores,       setScores]       = useState({});
  const [deadline,     setDeadline]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [entryError,   setEntryError]   = useState('');

  // Admin view state
  const [allScores,    setAllScores]    = useState([]);
  const [adminFilters, setAdminFilters] = useState({ academicYear: school?.academicYear || '', term: school?.currentTerm || '1', classId: '', subjectId: '' });
  const [adminLoading, setAdminLoading] = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);

  const gradingScale = defaultGradingScale();

  const availableClasses = userProfile?.role === 'teacher'
    ? classes.filter(() => true) // future: filter by teacher's assigned classes
    : classes;

  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const maxClass = selectedSubject?.maxClassScore ?? 30;
  const maxExam  = selectedSubject?.maxExamScore  ?? 70;

  // ── Load teacher entry data + deadline ─────────────────────────

  const loadEntry = useCallback(async () => {
    if (!filters.classId || !filters.subjectId || !schoolId) return;
    setLoading(true);
    setEntryError('');
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
        const existing = existingScores.find(s => s.enrollmentId === e.id);
        scoreMap[e.id] = {
          classScore: existing?.classScore ?? '',
          examScore:  existing?.examScore  ?? '',
          total:      existing?.total      ?? 0,
        };
      });
      setScores(scoreMap);
    } catch (err) {
      setEntryError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, schoolId]);

  useEffect(() => { loadEntry(); }, [loadEntry]);

  function updateScore(enrollmentId, field, value) {
    setScores(prev => {
      const row   = { ...prev[enrollmentId], [field]: value };
      const cs    = Number(row.classScore) || 0;
      const es    = Number(row.examScore)  || 0;
      const total = Math.min(cs + es, maxClass + maxExam);
      return { ...prev, [enrollmentId]: { ...row, total } };
    });
    setSaved(false);
    setEntryError('');
  }

  async function handleSave() {
    if (!filters.classId || !filters.subjectId) {
      alert('Select class and subject first'); return;
    }

    // Frontend deadline check before even calling the service
    if (deadline) {
      const { allowed, reason } = checkDeadlineStatus(deadline);
      if (!allowed) {
        setEntryError(reason);
        return;
      }
    }

    setSaving(true);
    setEntryError('');
    try {
      const batchData = enrollments.map(e => ({
        enrollmentId: e.id,
        studentId:    e.studentId,
        classId:      filters.classId,
        subjectId:    filters.subjectId,
        academicYear: filters.academicYear,
        term:         filters.term,
        classScore:   Number(scores[e.id]?.classScore) || 0,
        examScore:    Number(scores[e.id]?.examScore)  || 0,
      }));

      await saveBatchScores(schoolId, batchData, {
        userRole:     userProfile?.role,
        academicYear: filters.academicYear,
        term:         filters.term,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setEntryError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Load admin all-scores view ─────────────────────────────────

  const loadAdminScores = useCallback(async () => {
    if (!schoolId || !isAdmin) return;
    setAdminLoading(true);
    try {
      const data = await getAllSchoolScores(schoolId, adminFilters);
      setAllScores(data);
    } catch (err) {
      console.error('Failed to load scores:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [schoolId, adminFilters, isAdmin]);

  useEffect(() => {
    if (tab === 'admin-view') loadAdminScores();
  }, [tab, loadAdminScores]);

  async function handleAdminDelete(score) {
    const reason = window.prompt('Reason for deletion (optional):') ?? '';
    if (!window.confirm(`Delete score for enrollment ${score.enrollmentId}? This cannot be undone.`)) return;
    try {
      await adminDeleteScore(score.id, schoolId, { uid: userProfile.id, email: userProfile.email }, reason);
      loadAdminScores();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function handleAdminApprove(score) {
    if (!window.confirm('Approve and finalise this assessment record?')) return;
    try {
      await adminApproveScore(score.id, schoolId, { uid: userProfile.id, email: userProfile.email });
      loadAdminScores();
    } catch (err) {
      alert('Approve failed: ' + err.message);
    }
  }

  const studentMap      = Object.fromEntries(students.map(s => [s.id, s]));
  const classSubjects   = subjects.filter(s => s.classIds?.includes(filters.classId));
  const deadlineAllowed = deadline ? checkDeadlineStatus(deadline).allowed : true;

  function getGradeClass(grade) {
    if (!grade || grade === 'N/A') return '';
    if (grade.startsWith('A')) return 'grade-A';
    if (grade.startsWith('B')) return 'grade-B';
    if (grade.startsWith('C')) return 'grade-C';
    if (grade.startsWith('D') || grade.startsWith('E')) return 'grade-C';
    return 'grade-F';
  }

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));

  return (
    <div>
      <div className="page-header">
        <h1>Assessment / Score Entry</h1>
        {isAdmin && (
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab${tab === 'teacher-entry' ? ' active' : ''}`} onClick={() => setTab('teacher-entry')}>
              Enter Scores
            </button>
            <button className={`tab${tab === 'admin-view' ? ' active' : ''}`} onClick={() => setTab('admin-view')}>
              All Submissions
            </button>
          </div>
        )}
        {(tab === 'teacher-entry' || !isAdmin) && enrollments.length > 0 && deadlineAllowed && (
          <button
            onClick={handleSave}
            className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All Scores'}
          </button>
        )}
      </div>

      {/* ── TEACHER ENTRY TAB ─────────────────────────────────── */}
      {(tab === 'teacher-entry' || !isAdmin) && (
        <>
          <DeadlineBanner deadline={deadline} />

          {entryError && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>{entryError}</div>
          )}

          {/* Filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="filter-bar">
              <div className="form-group" style={{ minWidth: 200 }}>
                <label style={{ fontSize: '.75rem' }}>Class</label>
                <select
                  value={filters.classId}
                  onChange={e => setFilters(f => ({ ...f, classId: e.target.value, subjectId: '' }))}
                >
                  <option value="">— Select Class —</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 200 }}>
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select
                  value={filters.subjectId}
                  onChange={e => setFilters(f => ({ ...f, subjectId: e.target.value }))}
                  disabled={!filters.classId}
                >
                  <option value="">— Select Subject —</option>
                  {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Academic Year</label>
                <input
                  value={filters.academicYear}
                  onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))}
                  style={{ maxWidth: 130 }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Term</label>
                <select
                  value={filters.term}
                  onChange={e => setFilters(f => ({ ...f, term: e.target.value }))}
                  style={{ maxWidth: 100 }}
                >
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
            </div>
            {selectedSubject && (
              <div style={{ fontSize: '.8rem', color: 'var(--text-mid)', marginTop: 8 }}>
                Max Class Score: <strong>{maxClass}</strong> ·
                Max Exam Score: <strong>{maxExam}</strong> ·
                Total: <strong>{maxClass + maxExam}</strong>
              </div>
            )}
          </div>

          {/* Score Table */}
          <div className="card">
            {loading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : !filters.classId || !filters.subjectId ? (
              <div className="empty-state">
                <div className="icon">✏️</div>
                <p>Select a class and subject to begin entering scores.</p>
              </div>
            ) : enrollments.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👥</div>
                <p>No active enrollments in this class/term. Enroll students first.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="score-table score-grid">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Class Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxClass}</span></th>
                      <th>Exam Score<br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxExam}</span></th>
                      <th>Total</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enr, i) => {
                      const student  = studentMap[enr.studentId];
                      const row      = scores[enr.id] || { classScore: '', examScore: '', total: 0 };
                      const cs       = Number(row.classScore) || 0;
                      const es       = Number(row.examScore)  || 0;
                      const total    = Math.min(cs + es, maxClass + maxExam);
                      const gradeInfo = applyGradingScale(total, gradingScale);

                      return (
                        <tr key={enr.id}>
                          <td style={{ color: 'var(--text-lt)', width: 32 }}>{i + 1}</td>
                          <td className="td-mono">{student?.studentCode || '—'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {student ? `${student.firstName} ${student.lastName}` : 'Unknown'}
                          </td>
                          <td>
                            <input
                              type="number" min="0" max={maxClass} step="0.5"
                              value={row.classScore}
                              disabled={!deadlineAllowed}
                              onChange={e => updateScore(enr.id, 'classScore', e.target.value)}
                              onFocus={e => e.target.select()}
                            />
                          </td>
                          <td>
                            <input
                              type="number" min="0" max={maxExam} step="0.5"
                              value={row.examScore}
                              disabled={!deadlineAllowed}
                              onChange={e => updateScore(enr.id, 'examScore', e.target.value)}
                              onFocus={e => e.target.select()}
                            />
                          </td>
                          <td className="score-total-cell">{(cs || es) ? total : '—'}</td>
                          <td className={`grade-cell ${getGradeClass(gradeInfo.grade)}`}>
                            {(cs || es) ? gradeInfo.grade : '—'}
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

      {/* ── ADMIN ALL-SCORES TAB ──────────────────────────────── */}
      {tab === 'admin-view' && isAdmin && (
        <>
          {/* Admin filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="filter-bar">
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Academic Year</label>
                <input
                  value={adminFilters.academicYear}
                  onChange={e => setAdminFilters(f => ({ ...f, academicYear: e.target.value }))}
                  style={{ maxWidth: 130 }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Term</label>
                <select
                  value={adminFilters.term}
                  onChange={e => setAdminFilters(f => ({ ...f, term: e.target.value }))}
                  style={{ maxWidth: 100 }}
                >
                  <option value="">All</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Class</label>
                <select
                  value={adminFilters.classId}
                  onChange={e => setAdminFilters(f => ({ ...f, classId: e.target.value }))}
                  style={{ minWidth: 180 }}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Subject</label>
                <select
                  value={adminFilters.subjectId}
                  onChange={e => setAdminFilters(f => ({ ...f, subjectId: e.target.value }))}
                  style={{ minWidth: 180 }}
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={loadAdminScores} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}>
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">All Submitted Assessments ({allScores.length})</span>
            </div>

            {adminLoading ? (
              <div className="spinner-center"><div className="spinner" /></div>
            ) : allScores.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📋</div>
                <p>No assessment records found for the selected filters.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Enrollment</th>
                      <th>Class Score</th>
                      <th>Exam Score</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allScores.map(score => {
                      const cls     = classMap[score.classId];
                      const subj    = subjectMap[score.subjectId];
                      const grade   = applyGradingScale(score.total || 0, gradingScale);
                      return (
                        <tr key={score.id} style={{ opacity: score.isFinalized ? .75 : 1 }}>
                          <td style={{ fontSize: '.82rem' }}>{cls?.name || score.classId}</td>
                          <td style={{ fontSize: '.82rem' }}>{subj?.name || score.subjectId}</td>
                          <td className="td-mono" style={{ fontSize: '.75rem' }}>{score.enrollmentId?.substring(0, 12)}…</td>
                          <td>{score.classScore ?? '—'}</td>
                          <td>{score.examScore  ?? '—'}</td>
                          <td style={{ fontWeight: 700 }}>
                            {score.total ?? '—'}
                            <span style={{ marginLeft: 6, fontSize: '.75rem', color: 'var(--text-lt)' }}>
                              ({grade.grade})
                            </span>
                          </td>
                          <td>
                            {score.isFinalized ? (
                              <span className="badge badge-success">Approved</span>
                            ) : (
                              <span className="badge badge-warning">Pending</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {!score.isFinalized && (
                                <>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setEditTarget(score)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => handleAdminApprove(score)}
                                  >
                                    Approve
                                  </button>
                                </>
                              )}
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleAdminDelete(score)}
                              >
                                Delete
                              </button>
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

      {/* Edit Modal */}
      {editTarget && (
        <AdminEditModal
          score={editTarget}
          schoolId={schoolId}
          userProfile={userProfile}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadAdminScores(); }}
        />
      )}
    </div>
  );
}
