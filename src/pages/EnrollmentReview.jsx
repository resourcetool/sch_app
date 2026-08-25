// src/pages/EnrollmentReview.jsx
//
// Lets an admin see every currently-enrolled student for a class/term and
// bulk-withdraw the ones that shouldn't have been enrolled — built to fix
// the fallout from the Quick Add "sticky class" bug (see Students.jsx):
// an admin could have unknowingly enrolled a run of students into a class
// they didn't mean to, and there was no way to review and undo that in
// bulk, only one student at a time.
//
// Withdrawing here uses the same mechanism as everywhere else in the app
// (status: 'withdrawn', never a hard delete) — score history for any of
// these students is preserved either way.

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { getEnrollments, updateEnrollmentStatus } from '../services/studentService';

export default function EnrollmentReview() {
  const { school, classes, students, schoolId } = useSchool();
  const [academicYear, setAcademicYear] = useState(school?.academicYear || '');
  const [term, setTerm]                 = useState(school?.currentTerm  || '1');
  const [enrollments, setEnrollments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(new Set());
  const [withdrawing, setWithdrawing]   = useState(false);
  const [classFilter, setClassFilter]   = useState('');

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));

  const load = useCallback(async () => {
    if (!schoolId || !academicYear || !term) return;
    setLoading(true);
    const active = await getEnrollments(schoolId, { academicYear, term, status: 'active' });
    setEnrollments(active.sort((a, b) => (b.enrolledAt || 0) - (a.enrolledAt || 0)));
    setSelected(new Set());
    setLoading(false);
  }, [schoolId, academicYear, term]);

  useEffect(() => { load(); }, [load]);

  // Heuristic, not a hard rule: enrollments created within 2 minutes of
  // each other are likely the same quick-add session — worth a second
  // look if some of them weren't meant to happen. Purely a visual hint,
  // never blocks or auto-selects anything.
  function isClustered(e, i, arr) {
    const prev = arr[i - 1];
    const next = arr[i + 1];
    const CLOSE = 2 * 60 * 1000;
    return (prev && Math.abs(prev.enrolledAt - e.enrolledAt) < CLOSE) ||
           (next && Math.abs(next.enrolledAt - e.enrolledAt) < CLOSE);
  }

  const visible = classFilter ? enrollments.filter(e => e.classId === classFilter) : enrollments;

  function toggle(id) {
    setSelected(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(s => s.size === visible.length ? new Set() : new Set(visible.map(e => e.id)));
  }

  async function handleWithdrawSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(
      `Withdraw ${selected.size} student(s) from their class?\n\n` +
      `This only removes them from the class roster for ${academicYear} Term ${term} — ` +
      `nothing is deleted, and any scores already entered stay exactly as they are. ` +
      `You (or the admin) can re-enroll them any time.`
    )) return;
    setWithdrawing(true);
    try {
      for (const id of selected) {
        await updateEnrollmentStatus(schoolId, id, 'withdrawn');
      }
      await load();
    } catch (err) {
      alert('Some withdrawals failed: ' + err.message);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Review Enrollments</h1>
      </div>
      <p style={{ fontSize: '.86rem', color: 'var(--text-mid)', marginBottom: 18, maxWidth: 640 }}>
        Every student currently enrolled in a class, for the term you pick below. If some of these
        were enrolled by mistake — for example, added while a class was still selected from a
        previous student — select them and withdraw. This only removes them from the class roster;
        nothing about the student record itself is deleted.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Academic Year</div>
          <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025/2026" style={{ width: 130 }} />
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Term</div>
          <select value={term} onChange={e => setTerm(e.target.value)}>
            <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Class</div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selected.size > 0 && (
          <button className="btn btn-danger btn-sm" disabled={withdrawing} onClick={handleWithdrawSelected} style={{ height: 36 }}>
            {withdrawing ? 'Withdrawing…' : `↩ Withdraw ${selected.size} Selected`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No active enrollments found for this term{classFilter ? ' in this class' : ''}.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input type="checkbox" checked={selected.size === visible.length} onChange={toggleAll} />
                </th>
                <th>Student</th>
                <th>Class</th>
                <th>Enrolled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e, i) => {
                const s = studentMap[e.studentId];
                const clustered = isClustered(e, i, visible);
                return (
                  <tr key={e.id} style={selected.has(e.id) ? { background: '#fce4e4' } : undefined}>
                    <td><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} /></td>
                    <td>{s ? `${s.firstName} ${s.lastName}` : 'Unknown student'}</td>
                    <td>{classMap[e.classId]?.name || 'Unknown class'}</td>
                    <td style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>
                      {e.enrolledAt ? new Date(e.enrolledAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      {clustered && (
                        <span
                          title="Enrolled within 2 minutes of another student — possibly from the same quick-add session. Worth a closer look, not necessarily wrong."
                          style={{ fontSize: '.7rem', color: '#e65100', fontWeight: 700, cursor: 'help' }}
                        >
                          ⏱ clustered
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
