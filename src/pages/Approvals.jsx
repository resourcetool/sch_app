// src/pages/Approvals.jsx
//
// Admin-only oversight for the assessment process — Pro/Premium feature.
// Two views:
//   1. Completion Overview — real score-entry progress per class+subject,
//      computed from actual enrollment and score records (not
//      self-reported), so an admin can see "Mathematics — 100%, Science
//      — 64%" and who hasn't even started, independent of whether
//      anyone's formally submitted anything yet.
//   2. Pending Approvals — the submit → approve/reject queue.
// These answer genuinely different questions (raw progress vs formal
// submission status), which is why they're both here rather than one
// replacing the other.

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getPendingSubmissions, approveSubmission, rejectSubmission, getSubmissionsForClass,
} from '../services/approvalService';
import { getEnrollments } from '../services/studentService';
import { getAllSchoolScores } from '../services/assessmentService';

// ── COMPLETION OVERVIEW ─────────────────────────────────────────────
function CompletionOverview({ schoolId, classes, subjects, school }) {
  const [academicYear, setAcademicYear] = useState(school?.academicYear || '');
  const [term, setTerm]                 = useState(school?.currentTerm  || '');
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(true);

  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  // Same fix as EnrollmentReview.jsx — school loads async, sync year/term
  // once it actually arrives instead of only at mount.
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (synced || !school) return;
    if (school.academicYear) setAcademicYear(prev => prev || school.academicYear);
    if (school.currentTerm)  setTerm(prev => prev || school.currentTerm);
    setSynced(true);
  }, [school, synced]);

  const load = useCallback(async () => {
    if (!schoolId || !academicYear || !term) return;
    setLoading(true);

    const [enrollments, scores] = await Promise.all([
      getEnrollments(schoolId, { academicYear, term, status: 'active' }),
      getAllSchoolScores(schoolId, { academicYear, term }),
    ]);

    // Every real class+subject pair that's actually taught, per the
    // school's own class/subject assignment — not every theoretical
    // combination, so an unrelated subject never shows as "0% missing."
    const pairs = [];
    for (const c of classes) {
      const classSubjects = subjects.filter(s =>
        s.classIds?.includes(c.id) || c.subjectIds?.includes(s.id)
      );
      for (const s of classSubjects) pairs.push({ classId: c.id, subjectId: s.id });
    }

    const results = await Promise.all(pairs.map(async ({ classId, subjectId }) => {
      const classEnrollments = enrollments.filter(e => e.classId === classId);
      const enrolledIds = new Set(classEnrollments.map(e => e.id));
      const enteredIds  = new Set(
        scores
          .filter(sc => sc.classId === classId && sc.subjectId === subjectId && enrolledIds.has(sc.enrollmentId))
          .map(sc => sc.enrollmentId)
      );
      const submission = await getSubmissionsForClass(schoolId, classId, academicYear, term)
        .then(subs => subs.find(s => s.subjectId === subjectId))
        .catch(() => null);

      return {
        classId, subjectId,
        enrolledCount: enrolledIds.size,
        enteredCount:  enteredIds.size,
        pct: enrolledIds.size > 0 ? Math.round((enteredIds.size / enrolledIds.size) * 100) : 0,
        submission,
      };
    }));

    setRows(results.sort((a, b) => a.pct - b.pct)); // worst-progress first — what needs attention
    setLoading(false);
  }, [schoolId, academicYear, term, classes, subjects]);

  useEffect(() => { load(); }, [load]);

  const notStarted = rows.filter(r => r.enrolledCount > 0 && r.enteredCount === 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Academic Year</div>
          <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025/2026" style={{ width: 130 }} />
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Term</div>
          <select value={term || '1'} onChange={e => setTerm(e.target.value)}>
            <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
          </select>
        </div>
      </div>

      {notStarted.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚠ {notStarted.length} subject{notStarted.length !== 1 ? 's' : ''} with no scores entered at all yet —{' '}
          {notStarted.slice(0, 3).map(r => `${subjectMap[r.subjectId]?.name || '?'} (${classMap[r.classId]?.name || '?'})`).join(', ')}
          {notStarted.length > 3 ? `, +${notStarted.length - 3} more` : ''}.
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <p>No classes with subjects assigned yet for this term.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const barColor = r.pct === 100 ? '#2F7D5A' : r.pct >= 50 ? '#D97706' : '#B23A48';
            const statusLabel = {
              approved:  '🔒 Approved',
              submitted: '⏳ Submitted',
              rejected:  '↩ Sent back',
            }[r.submission?.status] || null;
            return (
              <div key={`${r.classId}_${r.subjectId}`} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem' }}>
                    {subjectMap[r.subjectId]?.name || 'Unknown'} — {classMap[r.classId]?.name || 'Unknown'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {statusLabel && <span style={{ fontSize: '.74rem', color: 'var(--text-mid)' }}>{statusLabel}</span>}
                    <span style={{ fontWeight: 800, color: barColor, fontSize: '.9rem' }}>{r.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, background: '#eef1f5', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: barColor, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: '.74rem', color: 'var(--text-lt)', marginTop: 4 }}>
                  {r.enteredCount} of {r.enrolledCount} students scored
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PENDING APPROVALS QUEUE ─────────────────────────────────────────
function PendingApprovalsQueue({ schoolId, classes, subjects, userProfile }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [acting, setActing]           = useState(null);

  const classMap   = Object.fromEntries(classes.map(c => [c.id, c]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const subs = await getPendingSubmissions(schoolId);
    setSubmissions(subs);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(sub) {
    if (!window.confirm(
      `Approve ${subjectMap[sub.subjectId]?.name || 'this subject'} for ${classMap[sub.classId]?.name || 'this class'}?\n\n` +
      `This locks the scores — the teacher won't be able to edit them anymore.`
    )) return;
    setActing(sub.id);
    try {
      await approveSubmission(sub.schoolId, sub.classId, sub.subjectId, sub.academicYear, sub.term, userProfile.email);
      await load();
    } catch (err) {
      alert('Approval failed: ' + err.message);
    } finally {
      setActing(null);
    }
  }

  async function handleReject(sub) {
    const reason = window.prompt(
      `Send back ${subjectMap[sub.subjectId]?.name || 'this subject'} for ${classMap[sub.classId]?.name || 'this class'} for correction?\n\n` +
      `What needs fixing? (shown to the teacher)`
    );
    if (reason === null) return;
    setActing(sub.id);
    try {
      await rejectSubmission(sub.schoolId, sub.classId, sub.subjectId, sub.academicYear, sub.term, userProfile.email, reason);
      await load();
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    } finally {
      setActing(null);
    }
  }

  if (loading) return <div className="empty-state"><p>Loading…</p></div>;
  if (submissions.length === 0) return (
    <div className="empty-state">
      <div className="icon">✅</div>
      <p>Nothing waiting for approval right now.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {submissions.map(sub => (
        <div key={sub.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--navy)' }}>
              {subjectMap[sub.subjectId]?.name || 'Unknown Subject'} — {classMap[sub.classId]?.name || 'Unknown Class'}
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginTop: 2 }}>
              {sub.teacherName || 'A teacher'} · {sub.scoreCount} score(s) · {sub.academicYear} Term {sub.term} ·{' '}
              submitted {new Date(sub.submittedAt).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={acting === sub.id} onClick={() => handleReject(sub)}>
              ↩ Send Back
            </button>
            <button className="btn btn-success btn-sm" disabled={acting === sub.id} onClick={() => handleApprove(sub)}>
              {acting === sub.id ? '…' : '✓ Approve & Lock'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Approvals() {
  const { schoolId, classes, subjects, school } = useSchool();
  const { userProfile } = useAuth();
  const { can } = useSubscription();
  const [tab, setTab] = useState('overview');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!schoolId) return;
    getPendingSubmissions(schoolId).then(subs => setPendingCount(subs.length));
  }, [schoolId, tab]);

  if (!can('approvalWorkflow')) {
    return (
      <div>
        <div className="page-header"><h1>Approvals</h1></div>
        <div className="empty-state">
          <div className="icon">🔒</div>
          <p>The assessment approval workflow is a Pro/Premium feature. Upgrade your plan to use it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Assessment Oversight</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { id: 'overview',  label: 'Completion Overview' },
          { id: 'approvals', label: `Pending Approvals${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '.86rem',
              color: tab === t.id ? 'var(--navy)' : 'var(--text-lt)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'
        ? <CompletionOverview schoolId={schoolId} classes={classes} subjects={subjects} school={school} />
        : <PendingApprovalsQueue schoolId={schoolId} classes={classes} subjects={subjects} userProfile={userProfile} />
      }
    </div>
  );
}

