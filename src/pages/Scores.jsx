// src/pages/Scores.jsx
// CHANGED: Deadline enforcement UI, window status display,
//          teacher assignment fix, deadline warning banner

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';
import { getEnrollments, getStudents } from '../services/studentService';
import { getScores, saveBatchScores, defaultGradingScale, applyGradingScale } from '../services/scoreService';
import { getAssessmentWindow, checkDeadlineAllows } from '../services/assessmentService';

const gradingScale = defaultGradingScale();

export default function Scores() {
  const { school, classes, subjects, schoolId } = useSchool();
  const { userProfile } = useAuth();

  const [filters, setFilters] = useState({
    classId:      '',
    subjectId:    '',
    academicYear: school?.academicYear  || '',
    term:         school?.currentTerm   || '1'
  });
  const [enrollments, setEnrollments] = useState([]);
  const [students,    setStudents]    = useState([]);
  const [scores,      setScores]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [window_,     setWindow_]     = useState(null);   // assessment window
  const [deadline,    setDeadline]    = useState(null);   // { allowed, reason }

  const isAdmin   = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';

  // Role-based class filter
  const availableClasses = isTeacher
    ? classes.filter(c => userProfile?.assignedClasses?.includes(c.id))
    : classes;

  const selectedSubject = subjects.find(s => s.id === filters.subjectId);
  const classSubjects   = subjects.filter(s => s.classIds?.includes(filters.classId));

  // Load scores + check deadline whenever filters change
  const load = useCallback(async () => {
    if (!filters.classId || !filters.subjectId || !schoolId) return;
    setLoading(true);
    try {
      const [enrs, studs, existingScores, win, dl] = await Promise.all([
        getEnrollments(schoolId, {
          classId: filters.classId, academicYear: filters.academicYear,
          term: filters.term, status: 'active'
        }),
        getStudents(schoolId),
        getScores(schoolId, {
          classId: filters.classId, subjectId: filters.subjectId,
          academicYear: filters.academicYear, term: filters.term
        }),
        getAssessmentWindow(schoolId, filters.classId, filters.academicYear, filters.term, filters.subjectId),
        checkDeadlineAllows(schoolId, filters.classId, filters.academicYear, filters.term, filters.subjectId)
      ]);

      setEnrollments(enrs);
      setStudents(studs);
      setWindow_(win);
      setDeadline(dl);

      const scoreMap = {};
      enrs.forEach(e => {
        const existing = existingScores.find(s => s.enrollmentId === e.id);
        scoreMap[e.id] = {
          classScore: existing?.classScore ?? '',
          examScore:  existing?.examScore  ?? '',
          total:      existing?.total      ?? 0,
          isApproved: existing?.isApproved ?? false
        };
      });
      setScores(scoreMap);
    } catch (err) {
      console.error('Load scores error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, schoolId]);

  useEffect(() => { load(); }, [load]);

  // Update school defaults when school loads
  useEffect(() => {
    if (school) {
      setFilters(f => ({
        ...f,
        academicYear: f.academicYear || school.academicYear || '',
        term:         f.term         || school.currentTerm  || '1'
      }));
    }
  }, [school]);

  function updateScore(enrollmentId, field, value) {
    setScores(prev => {
      const row   = { ...prev[enrollmentId], [field]: value };
      const cs    = Number(row.classScore) || 0;
      const es    = Number(row.examScore)  || 0;
      const max   = (selectedSubject?.maxClassScore || 30) + (selectedSubject?.maxExamScore || 70);
      const total = Math.min(cs + es, max);
      return { ...prev, [enrollmentId]: { ...row, total } };
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!filters.classId || !filters.subjectId) {
      alert('Select class and subject first.');
      return;
    }

    // Front-end deadline guard — requirement #5
    if (isTeacher && deadline && !deadline.allowed) {
      alert(deadline.reason || 'Assessment entry is closed.');
      return;
    }

    setSaving(true);
    try {
      const batchData = enrollments.map(e => ({
        enrollmentId: e.id,
        studentId:    e.studentId,
        classId:      filters.classId,
        subjectId:    filters.subjectId,
        academicYear: filters.academicYear,
        term:         filters.term,
        classScore:   Number(scores[e.id]?.classScore) || 0,
        examScore:    Number(scores[e.id]?.examScore)  || 0
      }));

      const role = isAdmin ? 'admin' : 'teacher';
      await saveBatchScores(schoolId, batchData, role);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Reload to get fresh approval/status
      await load();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const studentMap  = Object.fromEntries(students.map(s => [s.id, s]));
  const maxClass    = selectedSubject?.maxClassScore ?? 30;
  const maxExam     = selectedSubject?.maxExamScore  ?? 70;

  function getGradeClass(grade) {
    if (!grade || grade === 'N/A') return '';
    if (grade.startsWith('A')) return 'grade-A';
    if (grade.startsWith('B')) return 'grade-B';
    if (grade.startsWith('C')) return 'grade-C';
    if (grade.startsWith('D') || grade.startsWith('E')) return 'grade-C';
    return 'grade-F';
  }

  // Is entry blocked for this user?
  const entryBlocked = isTeacher && deadline && !deadline.allowed;

  // Window status display
  function renderWindowStatus() {
    if (!window_) return null;
    const now = Date.now();
    let info;
    if (window_.isLocked) {
      info = { bg: '#fee2e2', color: '#991b1b', icon: '🔒', text: 'Assessment entry is locked by the administrator.' };
    } else if (window_.closeDate && now > window_.closeDate) {
      info = { bg: '#ede9fe', color: '#6d28d9', icon: '⌛', text: `Deadline passed: ${new Date(window_.closeDate).toLocaleString('en-GH')}` };
    } else if (window_.closeDate) {
      const days = Math.ceil((window_.closeDate - now) / (1000 * 60 * 60 * 24));
      info = { bg: days <= 2 ? '#fef3c7' : '#f0fdf4', color: days <= 2 ? '#92400e' : '#15803d', icon: '📅', text: `Deadline: ${new Date(window_.closeDate).toLocaleString('en-GH')} (${days} day${days !== 1 ? 's' : ''} left)` };
    } else {
      info = { bg: '#f0fdf4', color: '#15803d', icon: '✅', text: 'Assessment entry is open.' };
    }
    return (
      <div style={{ background: info.bg, color: info.color, borderRadius: 8, padding: '9px 14px', fontSize: '.83rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span>{info.icon}</span> {info.text}
        {window_.note && <span style={{ fontWeight: 400, marginLeft: 4 }}>— {window_.note}</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Score Entry</h1>
        {enrollments.length > 0 && !entryBlocked && (
          <button
            onClick={handleSave}
            className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All Scores'}
          </button>
        )}
      </div>

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
            Max Exam Score:  <strong>{maxExam}</strong> ·
            Total:           <strong>{maxClass + maxExam}</strong>
          </div>
        )}

        {/* Window status */}
        {filters.classId && filters.subjectId && renderWindowStatus()}
      </div>

      {/* Blocked banner for teachers */}
      {entryBlocked && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <span>🔒</span>
          <span><strong>Entry Closed:</strong> {deadline.reason}</span>
        </div>
      )}

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
          <>
            {entryBlocked && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 14, fontSize: '.83rem', color: '#991b1b' }}>
                ℹ️ Scores are shown in read-only mode. Entry is closed.
              </div>
            )}
            <div className="table-wrap">
              <table className="score-table score-grid">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>
                      Class Score
                      <br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxClass}</span>
                    </th>
                    <th>
                      Exam Score
                      <br /><span style={{ fontWeight: 400, opacity: .7 }}>/{maxExam}</span>
                    </th>
                    <th>Total</th>
                    <th>Grade</th>
                    {isAdmin && <th>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enr, i) => {
                    const student   = studentMap[enr.studentId];
                    const row       = scores[enr.id] || { classScore: '', examScore: '', total: 0 };
                    const cs        = Number(row.classScore) || 0;
                    const es        = Number(row.examScore)  || 0;
                    const total     = Math.min(cs + es, maxClass + maxExam);
                    const gradeInfo = applyGradingScale(total, gradingScale);
                    const readOnly  = entryBlocked || row.isApproved;

                    return (
                      <tr key={enr.id} style={{ background: row.isApproved ? '#f0fdf4' : '' }}>
                        <td style={{ color: 'var(--text-lt)', width: 32 }}>{i + 1}</td>
                        <td className="td-mono">{student?.studentCode || '—'}</td>
                        <td style={{ fontWeight: 600 }}>
                          {student ? `${student.firstName} ${student.lastName}` : 'Unknown'}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={maxClass}
                            step="0.5"
                            value={row.classScore}
                            onChange={e => updateScore(enr.id, 'classScore', e.target.value)}
                            onFocus={e => e.target.select()}
                            disabled={readOnly}
                            style={{ opacity: readOnly ? .6 : 1 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={maxExam}
                            step="0.5"
                            value={row.examScore}
                            onChange={e => updateScore(enr.id, 'examScore', e.target.value)}
                            onFocus={e => e.target.select()}
                            disabled={readOnly}
                            style={{ opacity: readOnly ? .6 : 1 }}
                          />
                        </td>
                        <td className="score-total-cell">
                          {(cs || es) ? total : '—'}
                        </td>
                        <td className={`grade-cell ${getGradeClass(gradeInfo.grade)}`}>
                          {(cs || es) ? gradeInfo.grade : '—'}
                        </td>
                        {isAdmin && (
                          <td>
                            {row.isApproved
                              ? <span className="badge badge-success">✓ Approved</span>
                              : <span className="badge badge-neutral">Pending</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Admin save button at bottom for long lists */}
            {enrollments.length > 10 && !entryBlocked && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSave}
                  className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All Scores'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
