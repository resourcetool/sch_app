// src/pages/AssessmentDeadlines.jsx
//
// New page — School Admin assessment deadline management.
// Lets admins set open/close dates, lock/unlock entry manually, extend deadlines,
// and view the full audit log of admin score changes.

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import {
  getAllDeadlines, setAssessmentDeadline,
  setDeadlineLock, extendDeadline, getAuditLog,
  checkDeadlineStatus,
} from '../services/assessmentService';

// ── DEADLINE CARD ─────────────────────────────────────────────────

function DeadlineCard({ deadline, onEdit, onLock, onExtend }) {
  const { allowed, reason } = checkDeadlineStatus(deadline);
  const isExpired = deadline.closeAt && Date.now() > deadline.closeAt;

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${deadline.isLocked ? 'var(--danger)' : allowed ? 'var(--success)' : 'var(--warning)'}`,
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{deadline.label}</span>
            {deadline.isLocked ? (
              <span className="badge badge-danger">🔒 Locked</span>
            ) : allowed ? (
              <span className="badge badge-success">✓ Open</span>
            ) : (
              <span className="badge badge-neutral">Closed</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: '.82rem', color: 'var(--text-mid)', flexWrap: 'wrap' }}>
            <span>
              Opens: <strong>{deadline.openAt ? new Date(deadline.openAt).toLocaleString() : 'Not set'}</strong>
            </span>
            <span>
              Closes: <strong style={{ color: isExpired ? 'var(--danger)' : 'inherit' }}>
                {deadline.closeAt ? new Date(deadline.closeAt).toLocaleString() : 'Not set'}
              </strong>
            </span>
            <span>Year: <strong>{deadline.academicYear}</strong></span>
            <span>Term: <strong>{deadline.term}</strong></span>
          </div>
          {!allowed && reason && (
            <div style={{ fontSize: '.78rem', color: 'var(--danger)', marginTop: 4 }}>{reason}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(deadline)}>Edit</button>
          <button
            className={`btn btn-sm ${deadline.isLocked ? 'btn-success' : 'btn-warning'}`}
            onClick={() => onLock(deadline)}
          >
            {deadline.isLocked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
          {deadline.closeAt && (
            <button className="btn btn-primary btn-sm" onClick={() => onExtend(deadline)}>Extend</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DEADLINE FORM MODAL ───────────────────────────────────────────

function DeadlineModal({ initial, academicYear, term, onClose, onSaved }) {
  const [form, setForm] = useState({
    label:        initial?.label        || `${academicYear} Term ${term}`,
    openAt:       initial?.openAt  ? toDatetimeLocal(initial.openAt)  : '',
    closeAt:      initial?.closeAt ? toDatetimeLocal(initial.closeAt) : '',
    academicYear: initial?.academicYear || academicYear,
    term:         initial?.term         || term,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function toDatetimeLocal(ms) {
    const d = new Date(ms);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function fromDatetimeLocal(str) {
    return str ? new Date(str).getTime() : null;
  }

  const { schoolId } = useSchool();
  const { userProfile } = useAuth();

  async function handleSave(e) {
    e.preventDefault();
    const openMs  = fromDatetimeLocal(form.openAt);
    const closeMs = fromDatetimeLocal(form.closeAt);
    if (openMs && closeMs && closeMs <= openMs) {
      setError('Close date must be after open date.'); return;
    }
    setSaving(true);
    setError('');
    try {
      await setAssessmentDeadline(
        schoolId,
        form.academicYear,
        form.term,
        { openAt: openMs, closeAt: closeMs, label: form.label, isLocked: initial?.isLocked ?? false },
        userProfile.id
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
          <span className="modal-title">{initial ? 'Edit Deadline' : 'Set Deadline'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Label</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Academic Year</label>
                <input
                  value={form.academicYear}
                  onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
                  placeholder="e.g. 2024/2025"
                />
              </div>
              <div className="form-group">
                <label>Term</label>
                <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
              <div className="form-group">
                <label>Entry Opens</label>
                <input
                  type="datetime-local"
                  value={form.openAt}
                  onChange={e => setForm(f => ({ ...f, openAt: e.target.value }))}
                />
                <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Leave blank to allow entry immediately</span>
              </div>
              <div className="form-group">
                <label>Entry Closes (Deadline)</label>
                <input
                  type="datetime-local"
                  value={form.closeAt}
                  onChange={e => setForm(f => ({ ...f, closeAt: e.target.value }))}
                />
                <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Leave blank for no deadline</span>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AUDIT LOG TABLE ───────────────────────────────────────────────

function AuditLogTable({ auditLog }) {
  if (auditLog.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📋</div>
        <p>No audit entries yet. Changes made by admins will appear here.</p>
      </div>
    );
  }

  const actionLabel = { edit: 'Edited', delete: 'Deleted', approve: 'Approved' };

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Action</th>
            <th>Editor</th>
            <th>Score ID</th>
            <th>Previous</th>
            <th>New</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {auditLog.map(entry => (
            <tr key={entry.id}>
              <td style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                {new Date(entry.timestamp).toLocaleString()}
              </td>
              <td>
                <span className={`badge ${
                  entry.action === 'approve' ? 'badge-success' :
                  entry.action === 'delete'  ? 'badge-danger'  :
                  'badge-warning'
                }`}>
                  {actionLabel[entry.action] || entry.action}
                </span>
              </td>
              <td style={{ fontSize: '.82rem' }}>{entry.editorEmail}</td>
              <td className="td-mono" style={{ fontSize: '.72rem' }}>
                {entry.scoreId?.substring(0, 10)}…
              </td>
              <td style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>
                {entry.previousValue
                  ? `CS:${entry.previousValue.classScore ?? '—'} ES:${entry.previousValue.examScore ?? '—'} T:${entry.previousValue.total ?? '—'}`
                  : '—'}
              </td>
              <td style={{ fontSize: '.78rem' }}>
                {entry.newValue
                  ? `CS:${entry.newValue.classScore ?? '—'} ES:${entry.newValue.examScore ?? '—'} T:${entry.newValue.total ?? '—'}`
                  : '—'}
              </td>
              <td style={{ fontSize: '.78rem', color: 'var(--text-mid)', maxWidth: 180 }}>
                {entry.reason || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────

export default function AssessmentDeadlines() {
  const { schoolId, school } = useSchool();
  const { userProfile }      = useAuth();

  const [deadlines,  setDeadlines]  = useState([]);
  const [auditLog,   setAuditLog]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState('');
  const [tab,        setTab]        = useState('deadlines');
  const [modal,      setModal]      = useState(null); // null | 'create' | 'edit'
  const [editing,    setEditing]    = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);
  const [newClose,   setNewClose]   = useState('');

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError('');
    try {
      const [dl, al] = await Promise.all([
        getAllDeadlines(schoolId),
        getAuditLog(schoolId),
      ]);
      setDeadlines(dl);
      setAuditLog(al);
    } catch (err) {
      console.error('AssessmentDeadlines load error:', err);
      setLoadError(
        'Could not load deadlines: ' + err.message +
        '. Try refreshing — if this keeps happening, contact support.'
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function handleLock(deadline) {
    const action = deadline.isLocked ? 'unlock' : 'lock';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} assessment entry for ${deadline.label}?`)) return;
    try {
      await setDeadlineLock(schoolId, deadline.academicYear, deadline.term, !deadline.isLocked, userProfile.id);
      load();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  async function handleExtend(e) {
    e.preventDefault();
    if (!newClose) return;
    try {
      const ms = new Date(newClose).getTime();
      if (ms <= Date.now()) { alert('New deadline must be in the future.'); return; }
      await extendDeadline(schoolId, extendTarget.academicYear, extendTarget.term, ms, userProfile.id);
      setExtendTarget(null);
      setNewClose('');
      load();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Assessment Deadlines</h1>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('create'); }}>
          + Set Deadline
        </button>
      </div>

      {loadError && (
        <div className="alert alert-danger" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>⚠ {loadError}</span>
          <button onClick={load} className="btn btn-ghost btn-sm">↻ Retry</button>
        </div>
      )}

      <div className="tabs">
        <button className={`tab${tab === 'deadlines' ? ' active' : ''}`} onClick={() => setTab('deadlines')}>
          Deadlines ({deadlines.length})
        </button>
        <button className={`tab${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>
          Audit Log ({auditLog.length})
        </button>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner" /></div>
      ) : tab === 'deadlines' ? (
        <div style={{ marginTop: 16 }}>
          {deadlines.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="icon">📅</div>
                <p>No assessment deadlines configured. Click <strong>+ Set Deadline</strong> to get started.</p>
                <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', maxWidth: 420, margin: '0 auto' }}>
                  Until a deadline is set, teachers can submit scores at any time.
                </p>
              </div>
            </div>
          ) : (
            deadlines.map(d => (
              <DeadlineCard
                key={d.id}
                deadline={d}
                onEdit={dl => { setEditing(dl); setModal('edit'); }}
                onLock={handleLock}
                onExtend={dl => { setExtendTarget(dl); setNewClose(''); }}
              />
            ))
          )}
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Assessment Audit Log</span>
            <span style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>
              Records all administrator edits, deletions, and approvals
            </span>
          </div>
          <AuditLogTable auditLog={auditLog} />
        </div>
      )}

      {/* Create / Edit deadline modal */}
      {(modal === 'create' || modal === 'edit') && (
        <DeadlineModal
          initial={modal === 'edit' ? editing : null}
          academicYear={school?.academicYear || ''}
          term={school?.currentTerm || '1'}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Extend deadline modal */}
      {extendTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Extend Deadline — {extendTarget.label}</span>
              <button onClick={() => setExtendTarget(null)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <form onSubmit={handleExtend}>
              <div className="modal-body">
                <div style={{ marginBottom: 12, fontSize: '.84rem', color: 'var(--text-mid)' }}>
                  Current deadline: <strong>
                    {extendTarget.closeAt ? new Date(extendTarget.closeAt).toLocaleString() : 'None'}
                  </strong>
                </div>
                <div className="form-group">
                  <label>New Closing Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClose}
                    onChange={e => setNewClose(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setExtendTarget(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">Extend Deadline</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
