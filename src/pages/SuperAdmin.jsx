// src/pages/SuperAdmin.jsx
//
// Changes:
// - isSuperAdmin() now supports multiple emails (delegated to updated superAdminService).
// - updateRequestStatus() now passes the admin email for audit.
// - Approve action correctly awaits the status update before refreshing.
// - Reject action correctly awaits before refreshing.
// - GenerateCodeModal pre-fills school name when triggered from a request approval flow.
// - Fixed nav: "← School View" button navigates safely even when superadmin has no schoolId.
// - All Firestore permission errors are caught and displayed instead of crashing.

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  isSuperAdmin, getAllSchools, getAllCodes, getAllAccessRequests,
  createRegistrationCode, renewSubscription, suspendSchool,
  unsuspendSchool, toggleBackupAddon, updateRequestStatus,
  addSuperAdminNote, getSchoolDetails, deleteAccessRequest,
  getSuperAdminSchoolData, superAdminDeleteDoc, superAdminDeleteSchool,
} from '../services/superAdminService';
import { PLANS } from '../services/subscriptionService';
import { getSubscriptionStatus, daysRemaining } from '../services/subscriptionService';

// ── HELPERS ───────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active:    { cls: 'badge-success', label: 'Active'      },
    expiring:  { cls: 'badge-warning', label: 'Expiring'    },
    grace:     { cls: 'badge-danger',  label: 'Grace Period'},
    expired:   { cls: 'badge-danger',  label: 'Expired'     },
    suspended: { cls: 'badge-neutral', label: 'Suspended'   },
    none:      { cls: 'badge-neutral', label: 'No Sub'      },
    trial:     { cls: 'badge-info',    label: 'Trial'       },
  };
  const d = map[status] || map.none;
  return <span className={`badge ${d.cls}`}>{d.label}</span>;
}

function PlanBadge({ plan }) {
  const colors = { trial: '#8898aa', starter: '#2980b9', pro: '#0f3460', premium: '#e94560' };
  const p = PLANS[plan] || PLANS.trial;
  return (
    <span style={{
      background: colors[plan] || '#8898aa', color: '#fff',
      padding: '2px 8px', borderRadius: 10, fontSize: '.7rem', fontWeight: 700,
    }}>
      {p.name}
    </span>
  );
}

// ── GENERATE CODE MODAL ───────────────────────────────────────────

function GenerateCodeModal({ onClose, onGenerated, prefilledSchool = '', prefilledPlan = 'pro' }) {
  const { userProfile } = useAuth();
  const [form,      setForm]      = useState({ schoolName: prefilledSchool, plan: prefilledPlan });
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error,     setError]     = useState('');

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await createRegistrationCode(form.schoolName, form.plan, userProfile.email);
      setGenerated(result);
      onGenerated && onGenerated(result);
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(generated.code);
    alert('Code copied to clipboard!');
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Generate Registration Code</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div className="modal-body">
          {!generated ? (
            <form onSubmit={handleGenerate}>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div className="form-grid">
                <div className="form-group full">
                  <label>School Name *</label>
                  <input
                    required
                    value={form.schoolName}
                    onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
                    placeholder="Exact school name"
                  />
                  <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>
                    Must match what the school enters on registration
                  </span>
                </div>
                <div className="form-group full">
                  <label>Plan *</label>
                  <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="starter">Starter — GHS 150/month</option>
                    <option value="pro">Pro — GHS 250/month</option>
                    <option value="premium">Premium — GHS 400/month</option>
                  </select>
                </div>
              </div>
              <div className="alert alert-warning" style={{ marginTop: 12 }}>
                Only generate a code AFTER you have confirmed MoMo payment.
                This code expires in 48 hours and is single-use.
              </div>
              <div className="modal-footer" style={{ padding: '14px 0 0', border: 'none' }}>
                <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Generating…' : 'Generate Code'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
              <p style={{ color: 'var(--text-mid)', marginBottom: 16, fontSize: '.85rem' }}>
                Code generated for <strong>{generated.schoolName}</strong> — <strong>{generated.plan.toUpperCase()}</strong> plan
              </p>
              <div style={{
                background: 'var(--navy)', color: '#fff',
                borderRadius: 12, padding: '20px 24px',
                fontFamily: 'var(--font-mono)', fontSize: '1.6rem',
                fontWeight: 800, letterSpacing: '.15em',
                marginBottom: 16,
              }}>
                {generated.code}
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--text-lt)', marginBottom: 20 }}>
                Expires: {new Date(generated.expiresAt).toLocaleString()} · Single use only
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={copyCode} className="btn btn-primary">📋 Copy Code</button>
                <a
                  href={`https://wa.me/?text=Your SchoolMS access code is: ${generated.code}%0ASchool: ${generated.schoolName}%0APlan: ${generated.plan.toUpperCase()}%0AExpires in 48 hours.`}
                  target="_blank" rel="noreferrer"
                  className="btn btn-success"
                >
                  📱 Send via WhatsApp
                </a>
              </div>
              <button onClick={onClose} className="btn btn-ghost" style={{ marginTop: 12 }}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RENEW MODAL ───────────────────────────────────────────────────

function RenewModal({ school, onClose, onRenewed }) {
  const [form, setForm] = useState({
    plan:        school.subscription?.plan    || 'pro',
    paymentRef:  '',
    amountPaid:  '',
    notes:       '',
    backupAddon: school.subscription?.backupAddon || false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleRenew(e) {
    e.preventDefault();
    if (!form.paymentRef) { setError('Enter MoMo reference'); return; }
    setLoading(true);
    setError('');
    try {
      await renewSubscription(school.id, form.plan, form.paymentRef, Number(form.amountPaid), form.notes, form.backupAddon);
      onRenewed && onRenewed();
      onClose();
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const planData       = PLANS[form.plan];
  const backupPrice    = form.backupAddon && form.plan !== 'premium' ? 100 : 0;
  const expectedAmount = planData ? planData.price + backupPrice : 0;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Renew / Upgrade: {school.name}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleRenew}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Plan *</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="starter">Starter — GHS 150/month</option>
                  <option value="pro">Pro — GHS 250/month</option>
                  <option value="premium">Premium — GHS 400/month (backup included)</option>
                </select>
              </div>
              {form.plan !== 'premium' && (
                <div className="form-group full">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.backupAddon}
                      onChange={e => setForm(f => ({ ...f, backupAddon: e.target.checked }))}
                    />
                    Add Backup Add-on (+GHS 100/month)
                  </label>
                </div>
              )}
              <div className="form-group">
                <label>MoMo Reference *</label>
                <input
                  required
                  value={form.paymentRef}
                  onChange={e => setForm(f => ({ ...f, paymentRef: e.target.value }))}
                  placeholder="e.g. SCH-KUMPREP-JAN25"
                />
              </div>
              <div className="form-group">
                <label>Amount Paid (GHS)</label>
                <input
                  type="number"
                  value={form.amountPaid}
                  onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))}
                  placeholder={expectedAmount}
                />
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Annual payment, referred by School X"
                />
              </div>
            </div>
            <div style={{
              background: 'var(--surface2)', borderRadius: 8,
              padding: '10px 14px', fontSize: '.82rem', marginTop: 8,
            }}>
              Expected payment: <strong>GHS {expectedAmount}</strong> · Extends subscription by 30 days
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Processing…' : '✓ Confirm Renewal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SCHOOL DETAIL MODAL ───────────────────────────────────────────

function SchoolDetailModal({ school, onClose, onRefresh }) {
  const { userProfile } = useAuth();
  const [note,      setNote]      = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [error,     setError]     = useState('');
  const sub = school.subscription;

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    setError('');
    try {
      await addSuperAdminNote(school.id, note, userProfile.email);
      setNote('');
      onRefresh && onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSuspend() {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;
    try {
      await suspendSchool(school.id, reason);
      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  async function handleUnsuspend() {
    try {
      await unsuspendSchool(school.id);
      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  async function handleToggleBackup() {
    try {
      await toggleBackupAddon(school.id, !sub?.backupAddon);
      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{school.name}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>School Info</div>
              {[
                ['Code',          school.code],
                ['Address',       school.address      || '—'],
                ['Phone',         school.phone        || '—'],
                ['Email',         school.email        || '—'],
                ['Academic Year', school.academicYear],
                ['Current Term',  `Term ${school.currentTerm}`],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', gap: 8, fontSize: '.83rem',
                  borderBottom: '1px solid var(--border)', padding: '6px 0',
                }}>
                  <span style={{ color: 'var(--text-mid)', width: 110, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Subscription</div>
              {sub ? (
                <>
                  {[
                    ['Plan',        <PlanBadge plan={sub.plan} />],
                    ['Status',      <StatusBadge status={getSubscriptionStatus(sub)} />],
                    ['Days Left',   daysRemaining(sub)],
                    ['Expires',     new Date(sub.expiresAt).toLocaleDateString()],
                    ['Backup',      sub.backupAddon ? '✅ Yes' : '❌ No'],
                    ['Admin Email', sub.adminEmail || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: 'flex', gap: 8, fontSize: '.83rem',
                      borderBottom: '1px solid var(--border)', padding: '6px 0', alignItems: 'center',
                    }}>
                      <span style={{ color: 'var(--text-mid)', width: 110, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </>
              ) : (
                <p style={{ color: 'var(--text-lt)', fontSize: '.84rem' }}>No subscription found</p>
              )}
            </div>
          </div>

          {sub?.paymentHistory?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Payment History</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Plan</th><th>Amount (GHS)</th><th>MoMo Ref</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {sub.paymentHistory.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: '.78rem' }}>{new Date(p.date).toLocaleDateString()}</td>
                        <td><PlanBadge plan={p.plan} /></td>
                        <td style={{ fontWeight: 700 }}>{p.amount || '—'}</td>
                        <td className="td-mono" style={{ fontSize: '.75rem' }}>{p.ref}</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Admin Notes</div>
            {sub?.notes?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {sub.notes.map((n, i) => (
                  <div key={i} style={{
                    background: 'var(--surface2)', borderRadius: 6,
                    padding: '8px 12px', marginBottom: 6, fontSize: '.82rem',
                  }}>
                    <span style={{ color: 'var(--text-mid)', fontSize: '.72rem' }}>
                      {new Date(n.at).toLocaleString()} · {n.by}
                    </span>
                    <div>{n.text}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note…"
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              />
              <button onClick={handleAddNote} className="btn btn-ghost" disabled={savingNote}>Add</button>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleToggleBackup} className="btn btn-ghost btn-sm">
              {sub?.backupAddon ? '🔒 Remove Backup' : '🔓 Enable Backup'}
            </button>
            {sub?.status === 'suspended' ? (
              <button onClick={handleUnsuspend} className="btn btn-success btn-sm">✓ Unsuspend School</button>
            ) : (
              <button onClick={handleSuspend} className="btn btn-danger btn-sm">⛔ Suspend School</button>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN SUPER ADMIN PAGE ─────────────────────────────────────────

// ── SCHOOL DATA BROWSER ──────────────────────────────────────────
// Gives super admin complete visibility and control over every school's
// operational data. Select a school → see all students, teachers,
// classes, subjects, scores, results, enrollments. Can hard-delete
// individual records or the entire school (with double-confirm).
const DATA_TABS = [
  { key: 'students',    label: '👥 Students'    },
  { key: 'teachers',    label: '👨‍🏫 Teachers'    },
  { key: 'classes',     label: '🏫 Classes'     },
  { key: 'subjects',    label: '📚 Subjects'    },
  { key: 'enrollments', label: '📋 Enrollments' },
  { key: 'scores',      label: '✏️ Scores'      },
  { key: 'results',     label: '📄 Results'     },
];

function SchoolDataBrowser({ schools }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [data,             setData]             = useState(null);
  const [loadingData,      setLoadingData]       = useState(false);
  const [dataTab,          setDataTab]           = useState('students');
  const [dataError,        setDataError]         = useState('');
  const [search,           setSearch]            = useState('');

  async function loadSchoolData(schoolId) {
    if (!schoolId) { setData(null); return; }
    setLoadingData(true); setDataError(''); setData(null);
    try {
      const d = await getSuperAdminSchoolData(schoolId);
      setData(d);
    } catch (err) {
      setDataError('Failed to load school data: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleDeleteRecord(collectionName, docId, label) {
    if (!window.confirm(
      `SUPER ADMIN — Delete record from "${collectionName}"?\n\n` +
      `"${label}"\n\nThis is a PERMANENT hard-delete from Firestore. Cannot be undone.`
    )) return;
    try {
      await superAdminDeleteDoc(collectionName, docId);
      await loadSchoolData(selectedSchoolId); // refresh
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function handleDeleteSchool(school) {
    const first = window.confirm(
      `⚠ WARNING — Delete ENTIRE school?\n\n` +
      `School: ${school.name}\n\n` +
      `This will permanently delete ALL students, teachers, classes, subjects, ` +
      `scores, results, and the school account itself from Firestore.\n\n` +
      `This CANNOT be undone. Click OK to see final confirmation.`
    );
    if (!first) return;
    const confirm2 = window.prompt(
      `Type the school name exactly to confirm permanent deletion:\n\n${school.name}`
    );
    if (confirm2?.trim() !== school.name?.trim()) {
      alert('School name did not match. Deletion cancelled.');
      return;
    }
    try {
      await superAdminDeleteSchool(school.id);
      setData(null);
      setSelectedSchoolId('');
      alert('School and all data permanently deleted.');
    } catch (err) {
      alert('Delete school failed: ' + err.message);
    }
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);
  const currentRecords = data?.[dataTab] || [];
  const filtered = search
    ? currentRecords.filter(r =>
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
      )
    : currentRecords;

  // Render a row's key fields for each collection type
  function renderRow(r) {
    switch (dataTab) {
      case 'students':
        return [`${r.firstName} ${r.lastName}`, r.studentCode, r.gender, r.status];
      case 'teachers':
        return [r.firstName + ' ' + r.lastName, r.email, r.phone || '—',
          (r.assignedClasses?.length || 0) + ' classes'];
      case 'classes':
        return [r.name, r.level || '—', r.capacity || '—'];
      case 'subjects':
        return [r.name, r.code, `${r.maxClassScore || 30}/${r.maxExamScore || 70}`];
      case 'enrollments':
        return [r.studentId?.substring(0, 8) + '…', r.classId?.substring(0, 8) + '…',
          r.academicYear, `Term ${r.term}`, r.status];
      case 'scores':
        return [r.studentId?.substring(0, 8) + '…', r.subjectId?.substring(0, 8) + '…',
          r.classScore, r.examScore, r.total, r.academicYear, `T${r.term}`];
      case 'results':
        return [r.studentId?.substring(0, 8) + '…', r.classId?.substring(0, 8) + '…',
          r.position, r.average + '%', r.academicYear, r.isFinalized ? '✓ Final' : 'Draft'];
      default:
        return [r.id];
    }
  }

  function rowLabel(r) {
    switch (dataTab) {
      case 'students':    return `${r.firstName} ${r.lastName} (${r.studentCode})`;
      case 'teachers':    return `${r.firstName} ${r.lastName} (${r.email})`;
      case 'classes':     return r.name;
      case 'subjects':    return r.name;
      case 'enrollments': return `Enrollment ${r.id?.substring(0, 12)}`;
      case 'scores':      return `Score ${r.id?.substring(0, 12)}`;
      case 'results':     return `Result for student ${r.studentId?.substring(0, 12)}`;
      default:            return r.id;
    }
  }

  return (
    <div>
      {/* School selector */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10, fontSize: '.9rem' }}>
          🗄 School Data Browser — Full operational access
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 240, margin: 0 }}>
            <label style={{ fontSize: '.75rem' }}>Select School</label>
            <select
              value={selectedSchoolId}
              onChange={e => { setSelectedSchoolId(e.target.value); loadSchoolData(e.target.value); }}
            >
              <option value="">— Select a school to inspect —</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.subscription?.plan || 'no plan'})
                </option>
              ))}
            </select>
          </div>
          {selectedSchoolId && (
            <button
              onClick={() => loadSchoolData(selectedSchoolId)}
              className="btn btn-ghost btn-sm"
            >
              ↻ Refresh
            </button>
          )}
          {selectedSchool && (
            <button
              onClick={() => handleDeleteSchool(selectedSchool)}
              className="btn btn-danger btn-sm"
              style={{ fontWeight: 700 }}
            >
              🗑 Delete Entire School
            </button>
          )}
        </div>
        {dataError && <div className="alert alert-danger" style={{ marginTop: 10 }}>{dataError}</div>}
      </div>

      {!selectedSchoolId && (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏫</div>
            <p>Select a school above to view and manage all its data.</p>
          </div>
        </div>
      )}

      {loadingData && (
        <div className="card">
          <div className="spinner-center"><div className="spinner" /></div>
        </div>
      )}

      {data && !loadingData && (
        <>
          {/* School summary */}
          <div className="card" style={{ marginBottom: 10, background: '#e3f2fd', border: '1px solid #90caf9' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy)' }}>{selectedSchool?.name}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{selectedSchool?.subscription?.adminEmail}</div>
              </div>
              {DATA_TABS.map(t => (
                <div key={t.key} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy)' }}>
                    {data[t.key]?.length || 0}
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-lt)' }}>{t.label.replace(/.*\s/, '')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Collection tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {DATA_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setDataTab(t.key); setSearch(''); }}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: '.78rem', cursor: 'pointer',
                  border: `1.5px solid ${dataTab === t.key ? 'var(--navy)' : 'var(--border)'}`,
                  background: dataTab === t.key ? 'var(--navy)' : '#fff',
                  color: dataTab === t.key ? '#fff' : 'var(--text-mid)',
                  fontWeight: dataTab === t.key ? 700 : 400,
                }}
              >
                {t.label} <span style={{ opacity: .7 }}>({data[t.key]?.length || 0})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="card">
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <input
                placeholder={`Search ${dataTab}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '.8rem', color: 'var(--text-lt)', whiteSpace: 'nowrap' }}>
                {filtered.length} / {currentRecords.length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📭</div>
                <p>No {dataTab} records found.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ fontSize: '.72rem' }}>ID</th>
                      {(() => {
                        const headers = {
                          students:    ['Name', 'Code', 'Gender', 'Status'],
                          teachers:    ['Name', 'Email', 'Phone', 'Classes'],
                          classes:     ['Name', 'Level', 'Capacity'],
                          subjects:    ['Name', 'Code', 'Class/Exam'],
                          enrollments: ['Student', 'Class', 'Year', 'Term', 'Status'],
                          scores:      ['Student', 'Subject', 'Class', 'Exam', 'Total', 'Year', 'Term'],
                          results:     ['Student', 'Class', 'Position', 'Average', 'Year', 'Status'],
                        };
                        return (headers[dataTab] || []).map(h => (
                          <th key={h} style={{ fontSize: '.72rem' }}>{h}</th>
                        ));
                      })()}
                      <th style={{ fontSize: '.72rem' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id}>
                        <td className="td-mono" style={{ fontSize: '.68rem', color: 'var(--text-lt)', maxWidth: 80 }}>
                          {r.id?.substring(0, 10)}…
                        </td>
                        {renderRow(r).map((cell, i) => (
                          <td key={i} style={{ fontSize: '.8rem' }}>{cell ?? '—'}</td>
                        ))}
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '.7rem', padding: '2px 8px' }}
                            onClick={() => handleDeleteRecord(dataTab, r.id, rowLabel(r))}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('schools');
  const [schools,  setSchools]  = useState([]);
  const [codes,    setCodes]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  // For prefilling the generate-code modal from a request approval
  const [generatePrefill, setGeneratePrefill] = useState({ schoolName: '', plan: 'pro' });

  async function handleLogout() {
    if (!window.confirm('Sign out of Super Admin?')) return;
    await logout();
    navigate('/login');
  }

  // Guard — only super admin can access
  useEffect(() => {
    if (userProfile && !isSuperAdmin(userProfile.email)) {
      navigate('/dashboard');
    }
  }, [userProfile, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Use allSettled so a failure in one collection doesn't block the others.
      // Each call is independent — schools may load even if codes index is missing, etc.
      const [schoolsResult, codesResult, requestsResult] = await Promise.allSettled([
        getAllSchools(),
        getAllCodes(),
        getAllAccessRequests(),
      ]);

      if (schoolsResult.status === 'fulfilled') {
        setSchools(schoolsResult.value);
      } else {
        console.error('SuperAdmin: getAllSchools failed:', schoolsResult.reason);
      }

      if (codesResult.status === 'fulfilled') {
        setCodes(codesResult.value);
      } else {
        console.error('SuperAdmin: getAllCodes failed:', codesResult.reason);
      }

      if (requestsResult.status === 'fulfilled') {
        setRequests(requestsResult.value);
      } else {
        console.error('SuperAdmin: getAllAccessRequests failed:', requestsResult.reason);
      }

      // Only show top-level error if ALL three failed (likely a permissions issue)
      const allFailed = [schoolsResult, codesResult, requestsResult].every(r => r.status === 'rejected');
      if (allFailed) {
        setLoadError(
          'Permission denied. Make sure your email is listed in firestore.rules under SUPER_ADMIN_EMAILS and the rules have been deployed. ' +
          schoolsResult.reason?.message
        );
      } else if (schoolsResult.status === 'rejected') {
        setLoadError('Schools failed to load: ' + schoolsResult.reason?.message);
      }
    } catch (err) {
      console.error('SuperAdmin load error:', err);
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Revenue summary
  const totalMonthlyRevenue = schools.reduce((sum, s) => {
    if (!s.subscription) return sum;
    const status = getSubscriptionStatus(s.subscription);
    if (status === 'active' || status === 'expiring') {
      return sum + (PLANS[s.subscription.plan]?.price || 0) +
        (s.subscription.backupAddon && s.subscription.plan !== 'premium' ? 100 : 0);
    }
    return sum;
  }, 0);

  const activeSchools   = schools.filter(s => { const st = getSubscriptionStatus(s.subscription); return st === 'active' || st === 'expiring'; });
  const expiringSchools = schools.filter(s => getSubscriptionStatus(s.subscription) === 'expiring');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const filteredSchools = schools.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.subscription?.adminEmail?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleApproveRequest(r) {
    try {
      await updateRequestStatus(r.id, 'approved', userProfile.email);
      setGeneratePrefill({ schoolName: r.schoolName, plan: r.plan || 'pro' });
      setModal('generate');
      load();
    } catch (err) {
      alert('Failed to approve request: ' + err.message);
    }
  }

  async function handleRejectRequest(r) {
    if (!window.confirm(
      `Reject and permanently delete the request from "${r.schoolName}"?\n\nThis cannot be undone.`
    )) return;
    try {
      await deleteAccessRequest(r.id);
      load();
    } catch (err) {
      alert('Failed to delete request: ' + err.message);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy-mid)', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>⚡ Super Admin</div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '.75rem' }}>{userProfile?.email}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={load}
            className="btn btn-ghost btn-sm"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
          >
            ↻ Refresh
          </button>
          {/* Only show School View if the super-admin also has a school account */}
          {userProfile?.schoolId && (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-ghost btn-sm"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
            >
              ← School View
            </button>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {loadError && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <strong>Failed to load data:</strong> {loadError}
            <button onClick={load} className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }}>Retry</button>
          </div>
        )}

        {/* Revenue Stats */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card green">
            <span className="label">Monthly Revenue</span>
            <span className="value">GHS {totalMonthlyRevenue.toLocaleString()}</span>
            <span className="change">From active subscriptions</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Active Schools</span>
            <span className="value">{activeSchools.length}</span>
            <span className="change">of {schools.length} total</span>
          </div>
          <div className="stat-card gold">
            <span className="label">Expiring Soon</span>
            <span className="value">{expiringSchools.length}</span>
            <span className="change">Within 7 days</span>
          </div>
          <div className="stat-card blue">
            <span className="label">Pending Requests</span>
            <span className="value">{pendingRequests.length}</span>
            <span className="change">Awaiting your action</span>
          </div>
          <div className="stat-card">
            <span className="label">Annual Projection</span>
            <span className="value">GHS {(totalMonthlyRevenue * 12).toLocaleString()}</span>
            <span className="change">At current active schools</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab${tab === 'schools' ? ' active' : ''}`} onClick={() => setTab('schools')}>
            Schools ({schools.length})
          </button>
          <button className={`tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>
            Requests {pendingRequests.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pendingRequests.length}</span>
            )}
          </button>
          <button className={`tab${tab === 'codes' ? ' active' : ''}`} onClick={() => setTab('codes')}>
            Access Codes
          </button>
          <button className={`tab${tab === 'alerts' ? ' active' : ''}`} onClick={() => setTab('alerts')}>
            Alerts {expiringSchools.length > 0 && (
              <span className="badge badge-warning" style={{ marginLeft: 6 }}>{expiringSchools.length}</span>
            )}
          </button>
          <button
            className={`tab${tab === 'data' ? ' active' : ''}`}
            onClick={() => setTab('data')}
            style={{ background: tab === 'data' ? '#e94560' : '', color: tab === 'data' ? '#fff' : '', fontWeight: 700 }}
          >
            🗄 School Data
          </button>
        </div>

        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── SCHOOLS TAB ── */}
            {tab === 'schools' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">All Schools</span>
                  <button onClick={() => { setGeneratePrefill({ schoolName: '', plan: 'pro' }); setModal('generate'); }} className="btn btn-primary">
                    + Generate Code
                  </button>
                </div>
                <div className="filter-bar">
                  <input
                    placeholder="Search school or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: 300 }}
                  />
                </div>
                {filteredSchools.length === 0 ? (
                  <div className="empty-state"><div className="icon">🏫</div><p>No schools yet.</p></div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>School</th><th>Plan</th><th>Status</th><th>Days Left</th><th>Backup</th><th>Monthly</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filteredSchools.map(s => {
                          const sub     = s.subscription;
                          const status  = getSubscriptionStatus(sub);
                          const days    = daysRemaining(sub);
                          const monthly = sub ? (PLANS[sub.plan]?.price || 0) + (sub.backupAddon && sub.plan !== 'premium' ? 100 : 0) : 0;
                          return (
                            <tr key={s.id} style={{
                              background:
                                status === 'expiring' ? '#fffde7' :
                                status === 'grace' || status === 'expired' ? '#fce4ec' : '',
                            }}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{s.name}</div>
                                <div style={{ fontSize: '.75rem', color: 'var(--text-lt)' }}>{sub?.adminEmail || '—'}</div>
                              </td>
                              <td>{sub ? <PlanBadge plan={sub.plan} /> : <span className="badge badge-neutral">None</span>}</td>
                              <td><StatusBadge status={status} /></td>
                              <td style={{ fontWeight: days < 7 ? 700 : 400, color: days < 7 ? 'var(--danger)' : 'inherit' }}>
                                {sub ? `${days}d` : '—'}
                              </td>
                              <td>{sub?.backupAddon ? <span className="badge badge-success">✓ Yes</span> : <span className="badge badge-neutral">No</span>}</td>
                              <td style={{ fontWeight: 700 }}>GHS {monthly || '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('detail'); }}>View</button>
                                  <button className="btn btn-success btn-sm" onClick={() => { setSelected(s); setModal('renew'); }}>Renew</button>
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

            {/* ── REQUESTS TAB ── */}
            {tab === 'requests' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Access Requests</span>
                  <button onClick={() => { setGeneratePrefill({ schoolName: '', plan: 'pro' }); setModal('generate'); }} className="btn btn-primary">
                    + Generate Code
                  </button>
                </div>
                {requests.length === 0 ? (
                  <div className="empty-state"><div className="icon">📬</div><p>No requests yet.</p></div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th><th>School</th><th>Admin</th><th>Phone</th>
                          <th>Email</th><th>Type</th><th>Region</th><th>Plan</th>
                          <th>Students</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                              {new Date(r.submittedAt).toLocaleDateString()}
                            </td>
                            <td style={{ fontWeight: 700 }}>{r.schoolName}</td>
                            <td>{r.adminName}</td>
                            <td className="td-mono">{r.phone}</td>
                            <td style={{ fontSize: '.78rem' }}>{r.email || '—'}</td>
                            <td style={{ fontSize: '.78rem' }}>{r.schoolType || '—'}</td>
                            <td style={{ fontSize: '.78rem' }}>{r.region || '—'}</td>
                            <td><PlanBadge plan={r.plan} /></td>
                            <td>{r.studentCount || '—'}</td>
                            <td>
                              <span className={`badge ${
                                r.status === 'pending'  ? 'badge-warning' :
                                r.status === 'approved' ? 'badge-success' :
                                'badge-neutral'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <a
                                  href={`https://wa.me/233${r.phone?.replace(/^0/, '')}`}
                                  target="_blank" rel="noreferrer"
                                  className="btn btn-success btn-sm"
                                >
                                  📱 WhatsApp
                                </a>
                                {r.status === 'pending' && (
                                  <>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleApproveRequest(r)}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => handleRejectRequest(r)}
                                    >
                                      🗑 Reject & Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── CODES TAB ── */}
            {tab === 'codes' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Registration Codes</span>
                  <button onClick={() => { setGeneratePrefill({ schoolName: '', plan: 'pro' }); setModal('generate'); }} className="btn btn-primary">
                    + Generate Code
                  </button>
                </div>
                {codes.length === 0 ? (
                  <div className="empty-state"><div className="icon">🔑</div><p>No codes generated yet.</p></div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Code</th><th>School</th><th>Plan</th><th>Created</th><th>Expires</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {codes.map(c => (
                          <tr key={c.id}>
                            <td className="td-mono" style={{ fontWeight: 700, letterSpacing: '.08em' }}>{c.code}</td>
                            <td>{c.schoolName}</td>
                            <td><PlanBadge plan={c.plan} /></td>
                            <td style={{ fontSize: '.78rem' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td style={{ fontSize: '.78rem', color: Date.now() > c.expiresAt ? 'var(--danger)' : 'inherit' }}>
                              {new Date(c.expiresAt).toLocaleDateString()}
                            </td>
                            <td>
                              <span className={`badge ${
                                c.status === 'active' ? 'badge-success' :
                                c.status === 'used'   ? 'badge-neutral' :
                                'badge-danger'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ALERTS TAB ── */}
            {tab === 'alerts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {expiringSchools.length === 0 && schools.filter(s => getSubscriptionStatus(s.subscription) === 'grace').length === 0 ? (
                  <div className="card">
                    <div className="empty-state">
                      <div className="icon">✅</div>
                      <p>No alerts. All schools are in good standing.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {expiringSchools.map(s => (
                      <div key={s.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontSize: '1.5rem' }}>⏰</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{s.name}</div>
                            <div style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>
                              Expires in <strong>{daysRemaining(s.subscription)} days</strong> · {s.subscription?.adminEmail}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <a
                              href={`https://wa.me/233${s.subscription?.adminPhone?.replace(/^0/, '') || ''}`}
                              target="_blank" rel="noreferrer"
                              className="btn btn-success btn-sm"
                            >
                              📱 Remind
                            </a>
                            <button onClick={() => { setSelected(s); setModal('renew'); }} className="btn btn-primary btn-sm">
                              Renew
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {schools.filter(s => getSubscriptionStatus(s.subscription) === 'grace').map(s => (
                      <div key={s.id} className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontSize: '1.5rem' }}>🔒</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{s.name}</div>
                            <div style={{ fontSize: '.8rem', color: 'var(--danger)' }}>
                              In grace period — system locked for school admin
                            </div>
                          </div>
                          <button onClick={() => { setSelected(s); setModal('renew'); }} className="btn btn-danger btn-sm">
                            Renew Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── SCHOOL DATA BROWSER ── */}
        {tab === 'data' && (
          <SchoolDataBrowser schools={schools} />
        )}
      </div>

      {/* Modals */}
      {modal === 'generate' && (
        <GenerateCodeModal
          prefilledSchool={generatePrefill.schoolName}
          prefilledPlan={generatePrefill.plan}
          onClose={() => { setModal(null); load(); }}
          onGenerated={load}
        />
      )}
      {modal === 'renew'  && selected && <RenewModal       school={selected} onClose={() => setModal(null)} onRenewed={load} />}
      {modal === 'detail' && selected && <SchoolDetailModal school={selected} onClose={() => setModal(null)} onRefresh={load} />}
    </div>
  );
}
