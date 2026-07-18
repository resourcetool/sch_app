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
import { checkAndSendTrialExpiryWarnings } from '../services/trialExpiryService';
import {
  isSuperAdmin, getAllSchools, getAllCodes, getAllAccessRequests,
  createRegistrationCode, renewSubscription, suspendSchool,
  unsuspendSchool, toggleBackupAddon, updateRequestStatus,
  addSuperAdminNote, getSchoolDetails, getSchoolAdminProfiles, deleteAccessRequest,
  getSuperAdminSchoolData, superAdminDeleteDoc, superAdminDeleteSchool,
  approveTrialRequest, rejectTrialRequest, getPendingTrials,
  sendSuperAdminEmail, broadcastEmailToAllSchools,
  getSchoolActivityLog, getPendingDeletions,
  cancelDeletionRequest, logActivity,
} from '../services/superAdminService';
import {
  PLANS, BILLING_CYCLES, getPlanPrice, PLAN_FEATURE_LIST, PLAN_SUMMARY,
  BACKUP_ADDON_PRICE, BACKUP_ADDON_TERMLY_PRICE,
} from '../services/subscriptionService';
import { getSubscriptionStatus, daysRemaining } from '../services/subscriptionService';
import { createStudent, enrollStudent, updateStudent, updateEnrollmentStatus } from '../services/studentService';
import { createTeacherAccount } from '../services/teacherAuthService';
import { writeRecord } from '../services/syncService';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

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
    plan:        school.subscription?.plan  || 'pro',
    cycle:       school.subscription?.billingCycle || 'termly', // termly is the default/recommended cycle
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
      await renewSubscription(
        school.id, form.plan, form.paymentRef, Number(form.amountPaid),
        form.notes, form.backupAddon, form.cycle,
      );
      onRenewed && onRenewed();
      onClose();
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const planData     = PLANS[form.plan];
  const billing      = BILLING_CYCLES[form.cycle] || BILLING_CYCLES.termly;
  const planPrice    = getPlanPrice(form.plan, form.cycle);
  const backupPrice  = form.backupAddon && form.plan !== 'premium'
    ? (form.cycle === 'termly' ? BACKUP_ADDON_TERMLY_PRICE : BACKUP_ADDON_PRICE)
    : 0;
  const expectedAmount = planData ? planPrice + backupPrice : 0;

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Renew / Upgrade: {school.name}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleRenew}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

            {/* Billing cycle — termly is the recommended default; monthly is optional */}
            <div className="form-group full" style={{ marginBottom: 14 }}>
              <label>How will this school pay? *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['termly', 'monthly'].map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, cycle: c }))}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${form.cycle === c ? 'var(--navy)' : 'var(--border)'}`,
                      background: form.cycle === c ? 'var(--navy)' : '#fff',
                      color: form.cycle === c ? '#fff' : 'var(--text-mid)',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '.85rem' }}>
                      {c === 'termly' ? 'Per Term (recommended)' : 'Monthly'}
                    </div>
                    <div style={{ fontSize: '.7rem', opacity: .85 }}>
                      {c === 'termly'
                        ? 'Pay once, ~every 4 months — saves half a month'
                        : 'Pay every 30 days — no discount'}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 6 }}>
                Termly is the main billing option — it matches how schools already budget per term.
                Monthly stays available for schools that specifically prefer it; it's never forced.
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label>Plan *</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="starter">Starter — GHS {getPlanPrice('starter', form.cycle)} {billing.label === 'Monthly' ? '/month' : '/term'}</option>
                  <option value="pro">Pro — GHS {getPlanPrice('pro', form.cycle)} {billing.label === 'Monthly' ? '/month' : '/term'}</option>
                  <option value="premium">Premium — GHS {getPlanPrice('premium', form.cycle)} {billing.label === 'Monthly' ? '/month' : '/term'} (backup included)</option>
                </select>
              </div>

              {/* Clear feature breakdown so the right plan is obvious */}
              <div className="form-group full" style={{
                background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginTop: -6,
              }}>
                <div style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginBottom: 6, fontStyle: 'italic' }}>
                  {PLAN_SUMMARY[form.plan]}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.78rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
                  {(PLAN_FEATURE_LIST[form.plan] || []).map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>

              {form.plan !== 'premium' && (
                <div className="form-group full">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.backupAddon}
                      onChange={e => setForm(f => ({ ...f, backupAddon: e.target.checked }))}
                    />
                    Add Backup Add-on (+GHS {form.cycle === 'termly' ? BACKUP_ADDON_TERMLY_PRICE : BACKUP_ADDON_PRICE} {form.cycle === 'termly' ? '/term' : '/month'})
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
              Expected payment: <strong>GHS {expectedAmount}</strong> · Extends subscription by{' '}
              <strong>{billing.durationDays} days</strong> ({form.cycle === 'termly' ? '~1 school term' : '1 month'}).
              If not renewed again before this period plus a 7-day grace window, the school's
              access is automatically blocked until payment resumes (data is never deleted).
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
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const sub = school.subscription;

  useEffect(() => {
    let active = true;
    setLoadingAdmins(true);
    getSchoolAdminProfiles(school.id)
      .then(profiles => { if (active) setAdminProfiles(profiles); })
      .catch(err => console.warn('Could not load school admin profiles:', err.message))
      .finally(() => { if (active) setLoadingAdmins(false); });
    return () => { active = false; };
  }, [school.id]);

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
                ['School ID',      school.id],
                ['Code',           school.code],
                ['Address',        school.address      || '—'],
                ['Phone',          school.phone        || '—'],
                ['Email',          school.email        || '—'],
                ['Academic Year',  school.academicYear],
                ['Current Term',   `Term ${school.currentTerm}`],
                ['Registered On',  school.createdAt ? new Date(school.createdAt).toLocaleString() : '—'],
                ['Last Admin Login', school.lastLoginAt ? new Date(school.lastLoginAt).toLocaleString() : 'Never logged in'],
                ['Grading Scale',   school.gradingScale   ? '✓ Configured' : 'Default'],
                ['Promotion Rules', school.promotionRules ? '✓ Configured' : 'Default'],
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

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Registered Admin / Staff Accounts
            </div>
            {loadingAdmins ? (
              <p style={{ fontSize: '.82rem', color: 'var(--text-lt)' }}>Loading…</p>
            ) : adminProfiles.length === 0 ? (
              <p style={{ fontSize: '.82rem', color: 'var(--text-lt)' }}>No login accounts found for this school.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Last Login</th></tr>
                  </thead>
                  <tbody>
                    {adminProfiles.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600, fontSize: '.82rem' }}>{p.firstName} {p.lastName}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{p.email || '—'}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{p.phone || '—'}</td>
                        <td>
                          <span className={`badge badge-${p.role === 'admin' ? 'info' : 'neutral'}`} style={{ fontSize: '.7rem' }}>
                            {p.role || '—'}
                          </span>
                        </td>
                        <td style={{ fontSize: '.78rem', color: 'var(--text-lt)' }}>
                          {p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

// ── PENDING DELETIONS PANEL ───────────────────────────────────────
function PendingDeletionsPanel({ userProfile, onRefresh }) {
  const [deletions, setDeletions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(null);

  useEffect(() => {
    getPendingDeletions().then(d => { setDeletions(d); setLoading(false); });
  }, []);

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(typeof ts === 'number' ? ts : ts.seconds * 1000)
      .toLocaleDateString('en-GH', { dateStyle: 'medium' });
  }

  async function handleCancel(del) {
    if (!window.confirm(`Cancel deletion request for "${del.schoolName}"?\n\nThis will restore their account to active.`)) return;
    setActing(del.id);
    try {
      await cancelDeletionRequest(del.id, userProfile.email);
      setDeletions(d => d.filter(x => x.id !== del.id));
      onRefresh();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { setActing(null); }
  }

  async function handleExecuteDelete(del) {
    if (!window.confirm(
      `PERMANENTLY DELETE "${del.schoolName}"?\n\nThis removes all Firestore data AND all Firebase Auth login accounts (emails freed). Cannot be undone.\n\nType CONFIRM to proceed.`
    )) return;
    const typed = window.prompt('Type CONFIRM (all caps) to permanently delete:');
    if (typed !== 'CONFIRM') { alert('Deletion cancelled.'); return; }
    setActing(del.id);
    try {
      const { superAdminDeleteSchool } = await import('../services/superAdminService');
      await superAdminDeleteSchool(del.id);
      setDeletions(d => d.filter(x => x.id !== del.id));
      onRefresh();
      alert(`✓ School "${del.schoolName}" deleted.\n\nAll Firebase Auth accounts queued for deletion — emails are now free for re-registration.`);
    } catch (err) { alert('Delete failed: ' + err.message); }
    finally { setActing(null); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 6 }}>🗑 Pending Deletion Requests</div>
        <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginBottom: 0 }}>
          Schools that have requested data deletion. You can cancel (restore their account) or execute the permanent deletion after the grace period.
        </p>
      </div>
      {loading ? (
        <div className="card"><div className="spinner-center"><div className="spinner" /></div></div>
      ) : deletions.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="icon">✅</div><p>No pending deletion requests.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {deletions.map(del => (
            <div key={del.id} className="card" style={{ border: '1.5px solid #ef5350' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 4 }}>{del.schoolName}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-mid)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px' }}>
                    <div>📧 {del.adminEmail || del.deletionRequestedBy}</div>
                    <div>📅 Requested: {formatDate(del.deletionRequestedAt)}</div>
                    <div>⏰ Delete after: {formatDate(del.deleteAfter)}</div>
                    <div>💬 {del.deletionReason || 'No reason given'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleCancel(del)}
                    disabled={acting === del.id}
                  >
                    ↩ Cancel & Restore
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleExecuteDelete(del)}
                    disabled={acting === del.id}
                  >
                    🗑 Delete Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EMAIL COMPOSER PANEL ─────────────────────────────────────────
function EmailComposerPanel({ schools, userProfile }) {
  const [mode,      setMode]      = useState('individual'); // 'individual' | 'bulk'
  const [toEmail,   setToEmail]   = useState('');
  const [toSchool,  setToSchool]  = useState('');
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');

  // Bulk filter
  const [bulkFilter, setBulkFilter] = useState('all'); // 'all' | 'active' | 'trial' | 'expired'

  const bulkTargets = schools.filter(s => {
    if (bulkFilter === 'all')     return true;
    if (bulkFilter === 'active')  return s.subscription?.status === 'active' && s.subscription?.plan !== 'trial';
    if (bulkFilter === 'trial')   return s.subscription?.plan   === 'trial';
    if (bulkFilter === 'expired') return ['expired','trial_ended','grace'].includes(s.subscription?.status);
    return true;
  }).filter(s => s.subscription?.adminEmail || s.email);

  async function handleSend(e) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { setError('Subject and message are required'); return; }
    setSending(true); setError(''); setResult(null);

    try {
      if (mode === 'individual') {
        const email = toEmail.trim() || schools.find(s => s.id === toSchool)?.subscription?.adminEmail;
        if (!email) { setError('Enter an email address or select a school'); setSending(false); return; }
        await sendSuperAdminEmail(email, subject, body, 'SchoolMS Team');
        setResult({ sent: [{ email }], failed: [] });
      } else {
        const res = await broadcastEmailToAllSchools(subject, body, bulkTargets);
        setResult(res);
      }
    } catch (err) {
      setError('Send failed: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>✉️ Send Email</div>

        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['individual','👤 Individual'],['bulk','📢 Bulk Broadcast']].map(([m, label]) => (
            <button
              key={m} onClick={() => { setMode(m); setResult(null); setError(''); }}
              style={{
                padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '.84rem',
                border: `2px solid ${mode === m ? 'var(--navy)' : 'var(--border)'}`,
                background: mode === m ? 'var(--navy)' : '#fff',
                color: mode === m ? '#fff' : 'var(--text-mid)', fontWeight: mode === m ? 700 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}

        {result && (
          <div className="alert alert-success" style={{ marginBottom: 10 }}>
            ✓ Sent to {result.sent?.length || 1} recipient(s).
            {result.failed?.length > 0 && ` ⚠ ${result.failed.length} failed: ${result.failed.map(f => f.email || f.school).join(', ')}`}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'individual' ? (
            <div className="form-grid">
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Select School</label>
                <select value={toSchool} onChange={e => { setToSchool(e.target.value); setToEmail(schools.find(s => s.id === e.target.value)?.subscription?.adminEmail || ''); }}>
                  <option value="">— Pick a school —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Or type email directly</label>
                <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="admin@school.edu.gh" />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-lt)', marginBottom: 6 }}>Send to:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[['all','All Schools'],['active','Active Plans'],['trial','Trial Schools'],['expired','Expired']].map(([f, label]) => (
                  <button key={f} type="button" onClick={() => setBulkFilter(f)}
                    style={{
                      padding: '4px 12px', borderRadius: 16, fontSize: '.78rem', cursor: 'pointer',
                      border: `1.5px solid ${bulkFilter === f ? 'var(--navy)' : 'var(--border)'}`,
                      background: bulkFilter === f ? 'var(--navy)' : '#fff',
                      color: bulkFilter === f ? '#fff' : 'var(--text-mid)', fontWeight: bulkFilter === f ? 700 : 400,
                    }}
                  >
                    {label} ({(schools.filter(s => {
                      if (f === 'all')     return s.subscription?.adminEmail || s.email;
                      if (f === 'active')  return s.subscription?.status === 'active' && s.subscription?.plan !== 'trial';
                      if (f === 'trial')   return s.subscription?.plan === 'trial';
                      if (f === 'expired') return ['expired','trial_ended','grace'].includes(s.subscription?.status);
                      return false;
                    })).length})
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '.76rem', color: 'var(--text-mid)', background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px' }}>
                Will send to <strong>{bulkTargets.length}</strong> school admin(s)
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Subject *</label>
            <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Important update about SchoolMS" />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Message *</label>
            <textarea
              required rows={6}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Type your message here…"
              style={{ width: '100%', resize: 'vertical', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: '.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? '⏳ Sending…' : mode === 'individual' ? '✉️ Send Email' : `📢 Broadcast to ${bulkTargets.length} schools`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setSubject(''); setBody(''); setResult(null); setError(''); }}>
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Email templates */}
      <div className="card">
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8, fontSize: '.85rem' }}>Quick Templates</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Payment Reminder', 'Reminder: Your SchoolMS subscription', 'Dear School Admin,\n\nThis is a friendly reminder that your SchoolMS subscription is due for renewal.\n\nTo continue enjoying uninterrupted access, please make your payment and contact us on WhatsApp at 0549548274.\n\nThank you for using SchoolMS.\n\nBest regards,\nSchoolMS Team'],
            ['Trial Approved', 'Your SchoolMS Free Trial is Now Active!', 'Dear School Admin,\n\nGreat news! Your SchoolMS free trial request has been approved. You can now log in and start setting up your school.\n\nIf you need any help getting started, tap "Help & Support" in the app menu or WhatsApp us at 0549548274.\n\nWelcome to SchoolMS!\n\nBest regards,\nSchoolMS Team'],
            ['System Update', 'Important Update to SchoolMS', 'Dear School Admin,\n\nWe have made improvements to SchoolMS. Please log out and log back in to get the latest updates.\n\nIf you experience any issues, contact us on WhatsApp at 0549548274.\n\nThank you.\n\nSchoolMS Team'],
          ].map(([label, tmplSubject, tmplBody]) => (
            <button
              key={label}
              type="button"
              onClick={() => { setSubject(tmplSubject); setBody(tmplBody); }}
              style={{
                textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                fontSize: '.8rem', color: 'var(--navy)', fontWeight: 600,
              }}
            >
              📝 {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY LOG PANEL ────────────────────────────────────────────
const ACTION_LABELS = {
  login:              { label: 'Logged in',            icon: '🔑', color: '#2196F3' },
  scores_saved:       { label: 'Scores saved',          icon: '✏️', color: '#4CAF50' },
  results_generated:  { label: 'Results generated',     icon: '📊', color: '#9C27B0' },
  student_added:      { label: 'Student added',         icon: '👤', color: '#00BCD4' },
  student_removed:    { label: 'Student removed',       icon: '🗑️', color: '#F44336' },
  report_printed:     { label: 'Report printed',        icon: '🖨️', color: '#FF9800' },
  settings_changed:   { label: 'Settings updated',      icon: '⚙️', color: '#607D8B' },
  teacher_created:    { label: 'Teacher account created', icon: '👨‍🏫', color: '#009688' },
  teacher_removed:    { label: 'Teacher deactivated',   icon: '🚫', color: '#795548' },
  class_added:        { label: 'Class added',            icon: '🏫', color: '#3F51B5' },
  class_updated:      { label: 'Class updated',          icon: '📝', color: '#607D8B' },
  subject_added:      { label: 'Subject added',          icon: '📚', color: '#E91E63' },
  promotion_run:      { label: 'Promotion run',          icon: '🚀', color: '#FF5722' },
  deletion_requested: { label: 'Deletion requested',     icon: '🗑', color: '#F44336' },
  deletion_cancelled: { label: 'Deletion cancelled',     icon: '↩️', color: '#4CAF50' },
};

// ── TRIAL EXPIRY WARNING BUTTON ───────────────────────────────────
// Sends EmailJS warnings to trial schools approaching expiry.
// De-duplicated — won't send the same threshold warning twice.
function TrialExpiryButton({ schools }) {
  const [sending,  setSending]  = useState(false);
  const [results,  setResults]  = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  async function handleSendWarnings() {
    const trialCount = schools.filter(s =>
      s.subscription?.isTrial && s.subscription?.status === 'active'
    ).length;

    if (trialCount === 0) {
      alert('No active trial schools found.');
      return;
    }

    if (!window.confirm(
      `Send expiry warning emails to ${trialCount} trial school(s)?\n\n` +
      `Emails are only sent for schools within 7, 3, or 1 day of expiry.\n` +
      `Already-sent warnings for the same threshold are skipped (no duplicate spam).`
    )) return;

    setSending(true); setResults(null);
    try {
      const res = await checkAndSendTrialExpiryWarnings(schools);
      setResults(res);
      setShowInfo(true);
    } catch (err) {
      alert('Failed to send warnings: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={handleSendWarnings}
        disabled={sending}
        className="btn btn-warning btn-sm"
        title="Send EmailJS expiry warnings to trial schools within 7, 3, or 1 day of expiry"
      >
        {sending ? '⏳ Sending…' : '📧 Send Expiry Warnings'}
      </button>

      {showInfo && results && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Expiry Warning Results</span>
              <button onClick={() => setShowInfo(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div className="modal-body">
              {results.sent.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>✓ Sent ({results.sent.length})</div>
                  {results.sent.map((r, i) => (
                    <div key={i} style={{ fontSize: '.82rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <strong>{r.school}</strong> — {r.daysRemaining}d remaining → {r.email}
                    </div>
                  ))}
                </div>
              )}
              {results.skipped.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 6 }}>⏭ Skipped ({results.skipped.length})</div>
                  {results.skipped.map((r, i) => (
                    <div key={i} style={{ fontSize: '.8rem', color: 'var(--text-mid)', padding: '3px 0' }}>
                      {r.school} — {r.reason}
                    </div>
                  ))}
                </div>
              )}
              {results.failed.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 6 }}>✗ Failed ({results.failed.length})</div>
                  {results.failed.map((r, i) => (
                    <div key={i} style={{ fontSize: '.8rem', color: '#c62828', padding: '3px 0' }}>
                      {r.school} — {r.reason}
                    </div>
                  ))}
                </div>
              )}
              {results.sent.length === 0 && results.failed.length === 0 && (
                <div style={{ color: 'var(--text-mid)', fontSize: '.85rem' }}>
                  No warnings needed right now. All trial schools are either outside the warning window or already notified.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowInfo(false)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActivityLogPanel({ schools }) {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [logs,           setLogs]           = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [filterAction,   setFilterAction]   = useState('');

  async function loadLogs(schoolId) {
    if (!schoolId) { setLogs([]); return; }
    setLoading(true); setError('');
    try {
      const data = await getSchoolActivityLog(schoolId, 200);
      setLogs(data);
    } catch (err) {
      setError('Failed to load activity: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterAction ? logs.filter(l => l.action === filterAction) : logs;
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  function resolveTimestamp(ts) {
    // serverTimestamp() comes back as a Firestore Timestamp object with .toMillis()
    // or as a plain number (clientTimestamp fallback). Handle both.
    if (!ts) return Date.now();
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'object' && ts.toMillis) return ts.toMillis();
    if (typeof ts === 'object' && ts.seconds)  return ts.seconds * 1000;
    return Date.now();
  }

  function timeAgo(ts) {
    const ms   = resolveTimestamp(ts);
    const diff = Date.now() - ms;
    const m    = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function formatLogTime(ts) {
    const ms = resolveTimestamp(ts);
    return new Date(ms).toLocaleString('en-GH', {
      dateStyle: 'medium', timeStyle: 'short', hour12: true,
    });
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>📋 Account Activity Log</div>
        <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginBottom: 12 }}>
          Tracks logins, score entries, report generation, and other key actions per school.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
            <label style={{ fontSize: '.75rem' }}>Select School</label>
            <select value={selectedSchool} onChange={e => { setSelectedSchool(e.target.value); loadLogs(e.target.value); }}>
              <option value="">— Select a school —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {uniqueActions.length > 0 && (
            <div className="form-group" style={{ minWidth: 160, margin: 0 }}>
              <label style={{ fontSize: '.75rem' }}>Filter by action</label>
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                <option value="">All Actions</option>
                {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>)}
              </select>
            </div>
          )}
          {selectedSchool && <button onClick={() => loadLogs(selectedSchool)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}>↻</button>}
        </div>
        {error && <div className="alert alert-danger" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {!selectedSchool ? (
        <div className="card"><div className="empty-state"><div className="icon">📋</div><p>Select a school to view its activity log.</p></div></div>
      ) : loading ? (
        <div className="card"><div className="spinner-center"><div className="spinner" /></div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="icon">📭</div><p>No activity recorded yet for this school.</p></div></div>
      ) : (
        <div className="card">
          <div style={{ fontSize: '.78rem', color: 'var(--text-lt)', marginBottom: 10 }}>
            Showing {filtered.length} events
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((log, i) => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, icon: '•', color: '#888' };
              return (
                <div key={log.id} style={{
                  display: 'flex', gap: 12, padding: '10px 0',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: meta.color + '18', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: '.84rem', color: 'var(--navy)' }}>{meta.label}</div>
                      <div style={{ fontSize: '.74rem', color: 'var(--text-lt)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeAgo(log.timestamp)}
                      </div>
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text-mid)', marginTop: 1 }}>
                      {log.userEmail}
                      {log.details?.role && ` · ${log.details.role.charAt(0).toUpperCase() + log.details.role.slice(1)}`}
                      {(log.details?.firstName || log.details?.lastName) && ` · ${[log.details.firstName, log.details.lastName].filter(Boolean).join(' ')}`}
                      {log.details?.teacherName && ` · ${log.details.teacherName}`}
                      {log.details?.classId && ` · Class: ${log.details.classId?.substring(0, 8)}…`}
                      {log.details?.count && ` · ${log.details.count} records`}
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', marginTop: 1 }}>
                      {formatLogTime(log.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PENDING TRIAL REQUESTS PANEL ─────────────────────────────────
function PendingTrialsPanel({ pendingTrials, userProfile, onRefresh }) {
  const [acting, setActing] = useState(null);

  async function handleApprove(trial) {
    if (!window.confirm(`Approve trial for "${trial.schoolName}"?\n\nThis gives them full trial access immediately.`)) return;
    setActing(trial.id);
    try {
      await approveTrialRequest(trial.id, userProfile.email);
      onRefresh();
    } catch (err) { alert('Approve failed: ' + err.message); }
    finally { setActing(null); }
  }

  async function handleReject(trial) {
    const reason = window.prompt(
      `Reason for rejecting "${trial.schoolName}"?\n\n(This is shown to the applicant.)`,
      'Could not verify school details'
    );
    if (reason === null) return;
    setActing(trial.id);
    try {
      await rejectTrialRequest(trial.id, reason, userProfile.email);
      onRefresh();
    } catch (err) { alert('Reject failed: ' + err.message); }
    finally { setActing(null); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
          🎁 Pending Trial Requests ({pendingTrials.length})
        </div>
        <p style={{ fontSize: '.83rem', color: 'var(--text-mid)', marginBottom: 0 }}>
          Each school submits a trial request with their real name, verified email, and Ghana phone.
          Review and approve or reject below. Approved schools get immediate access.
        </p>
      </div>

      {pendingTrials.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">✅</div>
            <p>No pending trial requests. All caught up!</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingTrials.map(trial => (
            <div key={trial.id} className="card" style={{ border: '1.5px solid #ff9800' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--navy)', marginBottom: 4 }}>
                    {trial.schoolName}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '4px 16px', fontSize: '.8rem', color: 'var(--text-mid)' }}>
                    <div>📧 {trial.adminEmail}</div>
                    <div>📞 {trial.trialPhone}</div>
                    <div>🕐 {trial.requestedAt ? new Date(trial.requestedAt).toLocaleString() : '—'}</div>
                    <div>🔑 {trial.schoolId?.substring(0, 12)}…</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(trial)}
                    disabled={acting === trial.id}
                  >
                    {acting === trial.id ? '…' : '✓ Approve'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleReject(trial)}
                    disabled={acting === trial.id}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SUPER ADMIN — EDIT STUDENT (name / gender / status / class) ────
function SuperAdminStudentEditModal({ student, classes, currentClassId, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: student.firstName || '',
    lastName:  student.lastName  || '',
    gender:    student.gender    || 'Male',
    status:    student.status    || 'active',
    classId:   currentClassId    || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Super Admin — Edit Student</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input required value={form.firstName} onChange={e => up('firstName', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input required value={form.lastName} onChange={e => up('lastName', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={e => up('gender', e.target.value)}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => up('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <div className="form-group full">
                <label>Class</label>
                <select value={form.classId} onChange={e => up('classId', e.target.value)}>
                  <option value="">— Not enrolled —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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

// ── SUPER ADMIN — EDIT TEACHER (name / class / subject) ────────────
function SuperAdminTeacherEditModal({ teacher, classes, subjects, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName:        teacher.firstName || '',
    lastName:         teacher.lastName  || '',
    assignedClasses:  teacher.assignedClasses  || [],
    assignedSubjects: teacher.assignedSubjects || [],
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function togglePill(field, id) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Super Admin — Edit Teacher</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input required value={form.firstName} onChange={e => up('firstName', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input required value={form.lastName} onChange={e => up('lastName', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={teacher.email || ''} disabled />
              </div>
            </div>

            <div style={{ margin: '14px 0 6px', fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem' }}>
              Assigned Classes
            </div>
            {classes.length === 0
              ? <p style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No classes yet in this school.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {classes.map(c => {
                    const on = form.assignedClasses.includes(c.id);
                    return (
                      <button
                        key={c.id} type="button" onClick={() => togglePill('assignedClasses', c.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.8rem',
                          border: `1.5px solid ${on ? 'var(--navy)' : 'var(--border)'}`,
                          background: on ? 'var(--navy)' : '#fff',
                          color: on ? '#fff' : 'var(--text-mid)',
                          cursor: 'pointer', fontWeight: on ? 700 : 400,
                        }}
                      >
                        {on ? '✓ ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
              )
            }

            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem', margin: '10px 0 6px' }}>
              Assigned Subjects
            </div>
            {subjects.length === 0
              ? <p style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No subjects yet in this school.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {subjects.map(s => {
                    const on = form.assignedSubjects.includes(s.id);
                    return (
                      <button
                        key={s.id} type="button" onClick={() => togglePill('assignedSubjects', s.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.8rem',
                          border: `1.5px solid ${on ? '#2980b9' : 'var(--border)'}`,
                          background: on ? '#2980b9' : '#fff',
                          color: on ? '#fff' : 'var(--text-mid)',
                          cursor: 'pointer', fontWeight: on ? 700 : 400,
                        }}
                      >
                        {on ? '✓ ' : ''}{s.name}
                      </button>
                    );
                  })}
                </div>
              )
            }
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

  // ── QUICK-ADD STUDENT (on behalf of school) ──────────────────────
  const [sFirst,  setSFirst]  = useState('');
  const [sLast,   setSLast]   = useState('');
  const [sGender, setSGender] = useState('Male');
  const [sClass,  setSClass]  = useState('');
  const [sAdding, setSAdding] = useState(false);
  const [sError,  setSError]  = useState('');

  // ── QUICK-ADD TEACHER (on behalf of school) ──────────────────────
  const [tFirst,    setTFirst]    = useState('');
  const [tLast,     setTLast]     = useState('');
  const [tEmail,    setTEmail]    = useState('');
  const [tPassword, setTPassword] = useState('');
  const [tAdding,   setTAdding]   = useState(false);
  const [tError,    setTError]    = useState('');

  // ── EDIT (super admin, on behalf of school) ───────────────────────
  const [editStudent, setEditStudent] = useState(null);
  const [editTeacher, setEditTeacher] = useState(null);
  const [exporting,   setExporting]   = useState(false);

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

  // ── EDIT STUDENT (super admin, on behalf of school) ───────────────
  async function handleUpdateStudent(form) {
    const student = editStudent;
    await updateStudent(selectedSchoolId, student.id, {
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      gender:    form.gender,
      status:    form.status,
    });

    // Reconcile class assignment against the student's current active enrollment
    const currentEnrollment = (data?.enrollments || []).find(
      e => e.studentId === student.id && e.status === 'active'
    );
    const currentClassId = currentEnrollment?.classId || '';
    if (form.classId !== currentClassId) {
      if (currentEnrollment) {
        await updateEnrollmentStatus(selectedSchoolId, currentEnrollment.id, 'withdrawn');
      }
      if (form.classId) {
        await enrollStudent(
          selectedSchoolId, student.id, form.classId,
          selectedSchool?.academicYear || '', selectedSchool?.currentTerm || '1',
        );
      }
    }

    logActivity(selectedSchoolId, '', 'super-admin', 'student_edited_by_superadmin', {
      studentName: `${form.firstName.trim()} ${form.lastName.trim()}`,
    });
    await loadSchoolData(selectedSchoolId);
  }

  // ── EDIT TEACHER (super admin, on behalf of school) ────────────────
  async function handleUpdateTeacher(form) {
    const teacher = editTeacher;
    await superAdminUpdateDoc('teachers', teacher.id, {
      firstName:        form.firstName.trim(),
      lastName:         form.lastName.trim(),
      assignedClasses:  form.assignedClasses,
      assignedSubjects: form.assignedSubjects,
    });

    // Keep the linked login profile (users collection) in sync
    try {
      const q    = query(collection(db, 'users'), where('teacherId', '==', teacher.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          firstName:        form.firstName.trim(),
          lastName:         form.lastName.trim(),
          assignedClasses:  form.assignedClasses,
          assignedSubjects: form.assignedSubjects,
          updatedAt:        Date.now(),
        });
      }
    } catch (err) {
      console.warn('Could not sync teacher login profile:', err.message);
    }

    logActivity(selectedSchoolId, '', 'super-admin', 'teacher_edited_by_superadmin', {
      teacherName: `${form.firstName.trim()} ${form.lastName.trim()}`,
    });
    await loadSchoolData(selectedSchoolId);
  }

  // ── EXPORT SCHOOL DATA (super admin, on behalf of school) ──────────
  function handleExportSchoolData() {
    if (!data || !selectedSchoolId) return;
    setExporting(true);
    try {
      const studentMap = Object.fromEntries((data.students || []).map(s => [s.id, s]));
      const classMap   = Object.fromEntries((data.classes  || []).map(c => [c.id, c]));
      const subjectMap = Object.fromEntries((data.subjects || []).map(s => [s.id, s]));
      const studentName = id => studentMap[id] ? `${studentMap[id].firstName} ${studentMap[id].lastName}` : id;
      const className    = id => classMap[id]?.name   || id;
      const subjectName  = id => subjectMap[id]?.name || id;

      const wb = XLSX.utils.book_new();

      const studentsRows = (data.students || []).map(s => ({
        'Student Code': s.studentCode, 'First Name': s.firstName, 'Last Name': s.lastName,
        Gender: s.gender, 'Date of Birth': s.dateOfBirth || '', 'Guardian Name': s.guardianName || '',
        'Guardian Phone': s.guardianPhone || '', Address: s.address || '', Status: s.status,
      }));
      if (studentsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsRows), 'Students');

      const teachersRows = (data.teachers || []).map(t => ({
        'First Name': t.firstName, 'Last Name': t.lastName, Email: t.email, Phone: t.phone || '',
        'Staff ID': t.staffId || '', Classes: (t.assignedClasses || []).map(className).join(', '),
        Subjects: (t.assignedSubjects || []).map(subjectName).join(', '), Status: t.status || 'active',
      }));
      if (teachersRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teachersRows), 'Teachers');

      const classesRows = (data.classes || []).map(c => ({
        Name: c.name, Level: c.level || '', Capacity: c.capacity || '',
      }));
      if (classesRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classesRows), 'Classes');

      const subjectsRows = (data.subjects || []).map(s => ({
        Name: s.name, Code: s.code || '', 'Max Class Score': s.maxClassScore ?? 30, 'Max Exam Score': s.maxExamScore ?? 70,
      }));
      if (subjectsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subjectsRows), 'Subjects');

      const enrollmentsRows = (data.enrollments || []).map(e => ({
        Student: studentName(e.studentId), Class: className(e.classId),
        'Academic Year': e.academicYear, Term: e.term, Status: e.status,
      }));
      if (enrollmentsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(enrollmentsRows), 'Enrollments');

      const scoresRows = (data.scores || []).map(s => ({
        Student: studentName(s.studentId), Subject: subjectName(s.subjectId),
        'Class Score': s.classScore, 'Exam Score': s.examScore, Total: s.total,
        'Academic Year': s.academicYear, Term: s.term,
      }));
      if (scoresRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scoresRows), 'Scores');

      const resultsRows = (data.results || []).map(r => ({
        Student: studentName(r.studentId), Class: className(r.classId),
        Position: r.position, Average: r.average, 'Academic Year': r.academicYear,
        Status: r.isFinalized ? 'Final' : 'Draft',
      }));
      if (resultsRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultsRows), 'Results');

      if (wb.SheetNames.length === 0) {
        alert('This school has no data yet to export.');
        return;
      }
      const safeName = (selectedSchool?.name || 'school').replace(/[^a-z0-9]+/gi, '_');
      XLSX.writeFile(wb, `${safeName}_export_${Date.now()}.xlsx`);

      logActivity(selectedSchoolId, '', 'super-admin', 'school_data_exported_by_superadmin', {
        schoolName: selectedSchool?.name || '',
      });
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteSchool(school) {
    const first = window.confirm(
      `⚠ WARNING — Delete ENTIRE school?\n\n` +
      `School: ${school.name}\n\n` +
      `This will permanently delete:\n` +
      `• All students, teachers, classes, subjects, scores, results\n` +
      `• The school account and subscription in Firestore\n` +
      `• ALL Firebase Auth login accounts (emails freed for re-use)\n\n` +
      `Auth account deletion runs automatically via Cloud Function.\n` +
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
      alert(
        `✓ School "${school.name}" and all Firestore data deleted.\n\n` +
        `Firebase Auth accounts for this school have been queued for deletion ` +
        `and will be removed within seconds by the Cloud Function. ` +
        `All their emails are now free for re-registration.`
      );
    } catch (err) {
      alert('Delete school failed: ' + err.message);
    }
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  // ── ADD STUDENT (super admin, on behalf of the selected school) ──
  // Live duplicate check for the name currently typed in the quick-add form
  const sNameMatch = (sFirst.trim() && sLast.trim())
    ? (data?.students || []).find(s =>
        s.firstName.trim().toLowerCase() === sFirst.trim().toLowerCase() &&
        s.lastName.trim().toLowerCase()  === sLast.trim().toLowerCase()
      )
    : null;

  async function handleAddStudent(e) {
    e.preventDefault();
    if (!sFirst.trim() || !sLast.trim() || !selectedSchoolId) return;
    if (sNameMatch && !window.confirm(
      `A student named "${sFirst.trim()} ${sLast.trim()}" already exists in this school ` +
      `(code ${sNameMatch.studentCode}). Add another student with the same name anyway?`
    )) return;
    setSAdding(true); setSError('');
    try {
      const student = await createStudent(
        selectedSchoolId,
        { firstName: sFirst.trim(), lastName: sLast.trim(), gender: sGender, status: 'active' },
        selectedSchool?.code || 'STU',
        data?.students?.length || 0,
      );
      if (sClass) {
        await enrollStudent(
          selectedSchoolId, student.id, sClass,
          selectedSchool?.academicYear || '', selectedSchool?.currentTerm || '1',
        );
      }
      logActivity(selectedSchoolId, '', 'super-admin', 'student_created_by_superadmin', {
        studentName: `${sFirst.trim()} ${sLast.trim()}`,
        enrolledClass: sClass || null,
      });
      setSFirst(''); setSLast(''); setSGender('Male'); // keep class for next entry
      await loadSchoolData(selectedSchoolId);
    } catch (err) {
      setSError(err.message);
    } finally {
      setSAdding(false);
    }
  }

  // ── ADD TEACHER (super admin, on behalf of the selected school) ──
  async function handleAddTeacher(e) {
    e.preventDefault();
    if (!tFirst.trim() || !tLast.trim() || !tEmail.trim() || !tPassword.trim() || !selectedSchoolId) return;
    setTAdding(true); setTError('');
    try {
      const id = uuidv4();
      await createTeacherAccount(tEmail.trim(), tPassword, {
        schoolId:         selectedSchoolId,
        firstName:        tFirst.trim(),
        lastName:         tLast.trim(),
        teacherId:        id,
        assignedClasses:  [],
        assignedSubjects: [],
      });
      await writeRecord('teachers', id, {
        id, schoolId: selectedSchoolId,
        firstName: tFirst.trim(), lastName: tLast.trim(),
        email: tEmail.trim(), phone: '', staffId: '',
        assignedClasses: [], assignedSubjects: [],
        status: 'active', createdAt: Date.now(),
      }, selectedSchoolId);
      logActivity(selectedSchoolId, '', 'super-admin', 'teacher_created_by_superadmin', {
        teacherName:  `${tFirst.trim()} ${tLast.trim()}`,
        teacherEmail: tEmail.trim(),
      });
      setTFirst(''); setTLast(''); setTEmail(''); setTPassword('');
      await loadSchoolData(selectedSchoolId);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setTError('This email is already registered.');
      else setTError(err.message);
    } finally {
      setTAdding(false);
    }
  }

  const currentRecords = data?.[dataTab] || [];
  const filtered = search
    ? currentRecords.filter(r =>
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
      )
    : currentRecords;

  // Student → current class lookup (via active enrollment), so super admin
  // can see which class each enrolled student belongs to.
  const classById   = Object.fromEntries((data?.classes  || []).map(c => [c.id, c]));
  const studentById = Object.fromEntries((data?.students || []).map(s => [s.id, s]));
  const subjectById = Object.fromEntries((data?.subjects || []).map(s => [s.id, s]));
  const classByStudentId = {};
  (data?.enrollments || []).forEach(e => {
    if (e.status !== 'active') return;
    const existing = classByStudentId[e.studentId];
    if (!existing || (e.enrolledAt || 0) > (existing.enrolledAt || 0)) {
      classByStudentId[e.studentId] = e;
    }
  });
  function studentClassName(studentId) {
    const enr = classByStudentId[studentId];
    return enr ? (classById[enr.classId]?.name || '—') : null;
  }
  function studentDisplayName(studentId) {
    const s = studentById[studentId];
    return s ? `${s.firstName} ${s.lastName}` : (studentId ? studentId.substring(0, 8) + '…' : '—');
  }

  // ── DUPLICATE NAME DETECTION (students & teachers) ─────────────────
  function findDuplicateGroups(records) {
    const groups = {};
    records.forEach(r => {
      const key = `${(r.firstName || '').trim().toLowerCase()} ${(r.lastName || '').trim().toLowerCase()}`.trim();
      if (!key) return;
      (groups[key] = groups[key] || []).push(r);
    });
    return Object.values(groups).filter(g => g.length > 1);
  }
  const duplicateStudentGroups = dataTab === 'students' ? findDuplicateGroups(data?.students || []) : [];
  const duplicateTeacherGroups = dataTab === 'teachers' ? findDuplicateGroups(data?.teachers || []) : [];

  // Render a row's key fields for each collection type
  function renderRow(r) {
    switch (dataTab) {
      case 'students':
        return [`${r.firstName} ${r.lastName}`, r.studentCode, r.gender,
          studentClassName(r.id) || 'Not enrolled', r.status];
      case 'teachers':
        return [r.firstName + ' ' + r.lastName, r.email, r.phone || '—',
          (r.assignedClasses?.length || 0) + ' classes'];
      case 'classes':
        return [r.name, r.level || '—', r.capacity || '—'];
      case 'subjects':
        return [r.name, r.code, `${r.maxClassScore || 30}/${r.maxExamScore || 70}`];
      case 'enrollments':
        return [studentDisplayName(r.studentId), classById[r.classId]?.name || r.classId?.substring(0, 8) + '…',
          r.academicYear, `Term ${r.term}`, r.status];
      case 'scores':
        return [studentDisplayName(r.studentId), subjectById[r.subjectId]?.name || r.subjectId?.substring(0, 8) + '…',
          r.classScore, r.examScore, r.total, r.academicYear, `T${r.term}`];
      case 'results':
        return [studentDisplayName(r.studentId), classById[r.classId]?.name || r.classId?.substring(0, 8) + '…',
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
          {selectedSchoolId && data && (
            <button
              onClick={handleExportSchoolData}
              className="btn btn-ghost btn-sm"
              disabled={exporting}
              title="Export all of this school's data to an Excel workbook"
            >
              {exporting ? '…' : '⬇ Export Data (Excel)'}
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

          {/* Quick-add student, on behalf of this school */}
          {dataTab === 'students' && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', marginBottom: 8 }}>
                ⚡ Add Student — on behalf of {selectedSchool?.name}
              </div>
              {sError && <div className="alert alert-danger" style={{ marginBottom: 8 }}>{sError}</div>}
              <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>First Name *</div>
                  <input required value={sFirst} onChange={e => setSFirst(e.target.value)} placeholder="e.g. Kwame" />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Last Name *</div>
                  <input required value={sLast} onChange={e => setSLast(e.target.value)} placeholder="e.g. Mensah" />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Gender</div>
                  <select value={sGender} onChange={e => setSGender(e.target.value)}>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Enroll in Class (optional)</div>
                  <select value={sClass} onChange={e => setSClass(e.target.value)}>
                    <option value="">— No class yet —</option>
                    {(data?.classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-success btn-sm" disabled={sAdding || !sFirst.trim() || !sLast.trim()} style={{ alignSelf: 'flex-end', height: 36 }}>
                  {sAdding ? '…' : '+ Add Student'}
                </button>
              </form>
              {sNameMatch && (
                <div style={{
                  marginTop: 8, padding: '6px 10px', borderRadius: 6,
                  background: '#fff3e0', color: '#e65100', fontSize: '.76rem', fontWeight: 600,
                }}>
                  ⚠ A student named "{sFirst.trim()} {sLast.trim()}" already exists in this school
                  (code {sNameMatch.studentCode}). You'll be asked to confirm before adding a duplicate.
                </div>
              )}
              {(data?.classes || []).length === 0 && (
                <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 6 }}>
                  This school has no classes yet, so the student will be added without enrollment.
                </div>
              )}
            </div>
          )}

          {/* Quick-add teacher, on behalf of this school */}
          {dataTab === 'teachers' && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', marginBottom: 8 }}>
                ⚡ Add Teacher — on behalf of {selectedSchool?.name}
              </div>
              {tError && <div className="alert alert-danger" style={{ marginBottom: 8 }}>{tError}</div>}
              <form onSubmit={handleAddTeacher} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 110px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>First Name *</div>
                  <input required value={tFirst} onChange={e => setTFirst(e.target.value)} placeholder="Kwame" />
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Last Name *</div>
                  <input required value={tLast} onChange={e => setTLast(e.target.value)} placeholder="Mensah" />
                </div>
                <div style={{ flex: '2 1 180px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Email (login) *</div>
                  <input type="email" required value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="teacher@school.com" />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Password *</div>
                  <input type="password" required minLength={6} value={tPassword} onChange={e => setTPassword(e.target.value)} placeholder="Min 6 chars" />
                </div>
                <button type="submit" className="btn btn-success btn-sm" disabled={tAdding || !tFirst || !tLast || !tEmail || !tPassword} style={{ alignSelf: 'flex-end', height: 36 }}>
                  {tAdding ? '…' : '+ Add Teacher'}
                </button>
              </form>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 6 }}>
                Class and subject assignments can be edited from the school's own Teachers page later.
              </div>
            </div>
          )}

          {/* Duplicate name detection */}
          {(duplicateStudentGroups.length > 0 || duplicateTeacherGroups.length > 0) && (
            <div className="card" style={{ marginBottom: 10, border: '1.5px solid #e65100', background: '#fff8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#e65100', marginBottom: 8 }}>
                ⚠ Possible Duplicate {dataTab === 'students' ? 'Students' : 'Teachers'} Found
              </div>
              {(dataTab === 'students' ? duplicateStudentGroups : duplicateTeacherGroups).map((group, gi) => (
                <div key={gi} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #ffe0b2' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 4 }}>
                    {group[0].firstName} {group[0].lastName} — {group.length} entries
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {group.map(r => (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                        border: '1px solid var(--border)', borderRadius: 6, background: '#fff', fontSize: '.72rem',
                      }}>
                        <span>{dataTab === 'students' ? (r.studentCode || r.id.substring(0, 8)) : r.email}</span>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '.68rem', padding: '1px 6px' }}
                          onClick={() => handleDeleteRecord(dataTab, r.id, rowLabel(r))}
                        >
                          🗑 Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>
                Review carefully before removing — this permanently deletes the record.
              </div>
            </div>
          )}

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
                          students:    ['Name', 'Code', 'Gender', 'Class', 'Status'],
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
                          <div style={{ display: 'flex', gap: 4 }}>
                            {dataTab === 'students' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '.7rem', padding: '2px 8px' }}
                                onClick={() => setEditStudent(r)}
                              >
                                ✎ Edit
                              </button>
                            )}
                            {dataTab === 'teachers' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '.7rem', padding: '2px 8px' }}
                                onClick={() => setEditTeacher(r)}
                              >
                                ✎ Edit
                              </button>
                            )}
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '.7rem', padding: '2px 8px' }}
                              onClick={() => handleDeleteRecord(dataTab, r.id, rowLabel(r))}
                            >
                              🗑
                            </button>
                          </div>
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

      {editStudent && (
        <SuperAdminStudentEditModal
          student={editStudent}
          classes={data?.classes || []}
          currentClassId={classByStudentId[editStudent.id]?.classId || ''}
          onClose={() => setEditStudent(null)}
          onSave={handleUpdateStudent}
        />
      )}
      {editTeacher && (
        <SuperAdminTeacherEditModal
          teacher={editTeacher}
          classes={data?.classes || []}
          subjects={data?.subjects || []}
          onClose={() => setEditTeacher(null)}
          onSave={handleUpdateTeacher}
        />
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('schools');
  const [schools,  setSchools]  = useState([]);
  const [pendingTrials, setPendingTrials] = useState([]);
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

      // Load pending trials separately (non-blocking)
      try {
        const trials = await getPendingTrials();
        setPendingTrials(trials);
      } catch (err) {
        console.warn('SuperAdmin: getPendingTrials failed:', err.message);
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
          <button className={`tab${tab === 'deletions' ? ' active' : ''}`} onClick={() => setTab('deletions')}
            style={{ color: tab === 'deletions' ? '#fff' : '', background: tab === 'deletions' ? '#c62828' : '' }}>
            🗑 Deletions
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
            className={`tab${tab === 'trials' ? ' active' : ''}`}
            onClick={() => setTab('trials')}
            style={{ background: tab === 'trials' ? '#ff9800' : '', color: tab === 'trials' ? '#fff' : '' }}
          >
            🎁 Trial Requests
            {pendingTrials.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pendingTrials.length}</span>
            )}
          </button>
          <button
            className={`tab${tab === 'email' ? ' active' : ''}`}
            onClick={() => setTab('email')}
          >
            ✉️ Send Email
          </button>
          <button
            className={`tab${tab === 'activity' ? ' active' : ''}`}
            onClick={() => setTab('activity')}
          >
            📋 Activity Log
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <TrialExpiryButton schools={schools} />
                    <button onClick={() => { setGeneratePrefill({ schoolName: '', plan: 'pro' }); setModal('generate'); }} className="btn btn-primary">
                      + Generate Code
                    </button>
                  </div>
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
                        <tr><th>School</th><th>Plan</th><th>Status</th><th>Days Left</th><th>Last Login</th><th>Backup</th><th>Monthly</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filteredSchools.map(s => {
                          const sub     = s.subscription;
                          const status  = getSubscriptionStatus(sub);
                          const days    = daysRemaining(sub);
                          const monthly = sub ? (PLANS[sub.plan]?.price || 0) + (sub.backupAddon && sub.plan !== 'premium' ? 100 : 0) : 0;
                          const loginTs = s.lastLoginAt;
                          const loginAge = loginTs ? Math.floor((Date.now() - loginTs) / 86400000) : null;
                          const loginLabel = loginTs == null ? '—'
                            : loginAge === 0   ? 'Today'
                            : loginAge === 1   ? 'Yesterday'
                            : loginAge < 7     ? `${loginAge}d ago`
                            : new Date(loginTs).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' });
                          const loginFull = loginTs ? new Date(loginTs).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short', hour12: true }) : null;
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
                              <td title={loginFull || ''} style={{
                                fontSize: '.78rem',
                                color: loginAge == null ? '#bbb'
                                  : loginAge === 0 ? '#2e7d32'
                                  : loginAge <= 3  ? '#1b5e20'
                                  : loginAge <= 14 ? '#e65100'
                                  : '#999',
                                fontWeight: loginAge != null && loginAge <= 1 ? 700 : 400,
                                cursor: loginFull ? 'help' : 'default',
                              }}>
                                {loginLabel}
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

        {/* ── PENDING TRIAL REQUESTS ── */}
        {tab === 'trials' && (
          <PendingTrialsPanel
            pendingTrials={pendingTrials}
            userProfile={userProfile}
            onRefresh={load}
          />
        )}

        {/* ── PENDING DELETIONS ── */}
        {tab === 'deletions' && (
          <PendingDeletionsPanel userProfile={userProfile} onRefresh={load} />
        )}

        {/* ── EMAIL COMPOSER ── */}
        {tab === 'email' && (
          <EmailComposerPanel schools={schools} userProfile={userProfile} />
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'activity' && (
          <ActivityLogPanel schools={schools} />
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
