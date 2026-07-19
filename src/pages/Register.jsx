// src/pages/Register.jsx
//
// FIXES:
// 1. Terms & Conditions acceptance is now MANDATORY in Step 2 before account creation.
//    Legal compliance requires this for all school registrations.
// 2. Atomic error handling from registerAdmin() (handled in AuthContext) means
//    failed registrations clean up their own Firebase Auth account automatically.
// 3. All existing registration and code-validation logic preserved.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }           from '../contexts/AuthContext';
import { validateCode, markCodeUsed, activateSchool } from '../services/superAdminService';

export default function Register() {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [step,     setStep]     = useState(1);
  const [codeData, setCodeData] = useState(null);
  const [form,     setForm]     = useState({
    accessCode: '', email: '', password: '', confirm: '',
    firstName: '', lastName: '', phone: '',
    schoolName: '', address: '', schoolPhone: '', schoolEmail: '',
    code: '',
    academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    currentTerm: '1',
    agreedToTerms: false,
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleValidateCode(e) {
    e.preventDefault();
    if (!form.accessCode || !form.schoolName) {
      setError('Please enter both your school name and access code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await validateCode(form.accessCode, form.schoolName);
      if (!result.valid) {
        setError(result.reason);
        return;
      }
      setCodeData(result.data);
      setStep(2);
    } catch (err) {
      console.error('validateCode error:', err);
      setError(
        'Could not connect to the server. Please check your internet connection and try again.\n\nIf the problem persists, contact your provider.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters'); return; }
    if (!form.agreedToTerms) {
      setError('You must read and accept the Terms & Conditions to create your account.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { school } = await registerAdmin(form.email, form.password, {
        firstName:  form.firstName,
        lastName:   form.lastName,
        schoolName: form.schoolName,
        address:    form.address,
        phone:      form.schoolPhone,
        email:      form.schoolEmail,
        code:       form.code || form.schoolName.substring(0, 3).toUpperCase(),
        academicYear: form.academicYear,
        currentTerm:  form.currentTerm,
      });
      await markCodeUsed(codeData.id, school.id, form.schoolName);
      await activateSchool(
        school.id, form.schoolName, codeData.plan,
        form.email, 'CODE:' + form.accessCode, 0,
        'Initial activation via access code', codeData.id
      );
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <h1>School Registration</h1>
        <p>Set up your school and start managing records professionally.</p>
        <div style={{ marginTop: 32 }}>
          {[1, 2].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, opacity: step >= n ? 1 : .4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: step >= n ? '#e94560' : 'rgba(255,255,255,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '.8rem', color: '#fff', flexShrink: 0,
              }}>{n}</div>
              <span style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.8)' }}>
                {n === 1 ? 'Validate your access code' : 'Set up your school account'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '14px 18px', fontSize: '.82rem', color: 'rgba(255,255,255,.85)' }}>
          <strong>Tips for Step 1:</strong>
          <ul style={{ margin: '8px 0 0 16px', lineHeight: 1.8 }}>
            <li>Enter your school name <em>exactly</em> as you submitted when requesting access.</li>
            <li>The access code expires 48 hours after it was sent.</li>
            <li>The code is single-use — each school gets one code.</li>
          </ul>
        </div>

        <div style={{ marginTop: 16, background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '12px 18px', fontSize: '.82rem', color: 'rgba(255,255,255,.7)' }}>
          No access code yet?<br />
          <a href="/request-access" style={{ color: '#e94560', fontWeight: 700 }}>Request access here →</a>
        </div>
      </div>

      <div className="auth-right" style={{ width: '480px', overflowY: 'auto' }}>
        {error && (
          <div className="alert alert-danger" style={{ whiteSpace: 'pre-line', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Validate Code ── */}
        {step === 1 && (
          <>
            <div style={{
              background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 12,
              padding: '14px 18px', marginBottom: 20, display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#0d47a1' }}>🎁 New school? Try it free first</div>
                <div style={{ fontSize: '.78rem', color: '#1565c0' }}>No code, no card needed — just sign up and start using it.</div>
              </div>
              <Link
                to="/trial"
                style={{
                  background: '#0d47a1', color: '#fff', padding: '8px 16px', borderRadius: 8,
                  fontWeight: 700, fontSize: '.82rem', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Start Free Trial →
              </Link>
            </div>

            <h2>Enter Access Code</h2>
            <p className="sub">For schools converting from a trial, or already paying. Received from your provider after payment confirmation.</p>
            <form onSubmit={handleValidateCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>School Name *</label>
                <input
                  required
                  value={form.schoolName}
                  onChange={e => update('schoolName', e.target.value)}
                  placeholder="Enter exactly as submitted when requesting access"
                />
                <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>
                  Must match the name used when requesting access
                </span>
              </div>
              <div className="form-group">
                <label>Access Code *</label>
                <input
                  required
                  value={form.accessCode}
                  onChange={e => update('accessCode', e.target.value.toUpperCase().trim())}
                  placeholder="e.g. XK9-4MPQ-R7Z"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.12em', fontSize: '1.05rem' }}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>
                  Copy and paste from your WhatsApp/SMS message
                </span>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Validating…' : 'Validate Code →'}
              </button>
            </form>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link to="/request-access" style={{ color: 'var(--navy)', fontSize: '.84rem' }}>Need a paid plan code? Request access →</Link><br />
              <Link to="/login" style={{ color: 'var(--text-lt)', fontSize: '.8rem', marginTop: 6, display: 'inline-block' }}>← Back to login</Link>
            </div>
          </>
        )}

        {/* ── STEP 2: Create Account ── */}
        {step === 2 && codeData && (
          <>
            <h2>Create Account</h2>
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              ✓ Code valid — <strong>{codeData.plan?.toUpperCase()} plan</strong> for <strong>{form.schoolName}</strong>
            </div>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--navy)' }}>Admin Account</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input required value={form.lastName} onChange={e => update('lastName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="024XXXXXXX" />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input type="password" required value={form.confirm} onChange={e => update('confirm', e.target.value)} />
                </div>
              </div>

              <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--navy)', paddingTop: 8 }}>School Details</div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>School Name *</label>
                  <input required value={form.schoolName} onChange={e => update('schoolName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>School Code</label>
                  <input maxLength={4} value={form.code} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="e.g. KPS" />
                </div>
                <div className="form-group">
                  <label>School Phone</label>
                  <input value={form.schoolPhone} onChange={e => update('schoolPhone', e.target.value)} />
                </div>
                <div className="form-group full">
                  <label>Address</label>
                  <input value={form.address} onChange={e => update('address', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Academic Year</label>
                  <input value={form.academicYear} onChange={e => update('academicYear', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Current Term</label>
                  <select value={form.currentTerm} onChange={e => update('currentTerm', e.target.value)}>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>
              </div>

              {/* ── TERMS & CONDITIONS — MANDATORY ────────────────── */}
              <div style={{
                background: '#f8f9fa',
                border: '2px solid var(--border)',
                borderRadius: 10, padding: '14px 16px', marginTop: 4,
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.agreedToTerms}
                    onChange={e => update('agreedToTerms', e.target.checked)}
                    style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--navy)', flexShrink: 0 }}
                  />
                  <div style={{ fontSize: '.82rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--navy)' }}>I have read and agree to:</strong>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {[
                        ['/legal/terms',          'Terms of Service'],
                        ['/legal/privacy',        'Privacy Policy'],
                        ['/legal/subscription',   'Subscription Policy'],
                        ['/legal/data-retention', 'Data Retention Policy'],
                        ['/legal/data-security',  'Data Security Policy'],
                      ].map(([to, label]) => (
                        <a key={to} href={to} target="_blank" rel="noreferrer"
                           style={{ color: 'var(--navy)', fontWeight: 700, fontSize: '.78rem', textDecoration: 'underline' }}>
                          {label}
                        </a>
                      ))}
                    </div>
                    <div style={{ marginTop: 6, fontSize: '.76rem', color: 'var(--text-lt)' }}>
                      By checking this box you confirm you are authorised to register this school
                      and agree to be bound by all of the above policies.
                    </div>
                  </div>
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? 'Creating Account…' : 'Create School Account →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
