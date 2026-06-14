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
  addSuperAdminNote, getSchoolDetails,
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

export default function SuperAdmin() {
  const { user, userProfile } = useAuth();
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
    if (!window.confirm(`Reject request from ${r.schoolName}?`)) return;
    try {
      await updateRequestStatus(r.id, 'rejected', userProfile.email);
      load();
    } catch (err) {
      alert('Failed to reject: ' + err.message);
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
                                      Reject
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
