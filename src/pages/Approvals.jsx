// src/pages/Approvals.jsx
//
// Admin-only review queue for the assessment approval workflow — Pro/Premium
// feature. Lists every subject+class submission awaiting approval, lets
// the headteacher approve (locks the underlying scores) or reject (sends
// back to the teacher with a reason).

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getPendingSubmissions, approveSubmission, rejectSubmission, reopenSubmission,
} from '../services/approvalService';

export default function Approvals() {
  const { schoolId, classes, subjects } = useSchool();
  const { userProfile } = useAuth();
  const { can } = useSubscription();
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
        <h1>Approvals <span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-lt)' }}>({submissions.length} awaiting review)</span></h1>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✅</div>
          <p>Nothing waiting for approval right now.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
