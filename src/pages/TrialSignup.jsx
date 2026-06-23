// src/pages/TrialSignup.jsx
//
// Changes:
// - Email validation: format check + disposable domain block
// - Ghana phone validation: must be a real Ghana mobile prefix
// - Strong password: 8+ chars, uppercase, number, special char — live meter
// - Firebase email verification: sent immediately after account creation
// - Trial is now pending_approval (not immediately active)
// - School lands on a clear "pending review" screen, not the dashboard

import React, { useState } from 'react';
import { Link }                          from 'react-router-dom';
import { useAuth }                       from '../contexts/AuthContext';
import { startFreeTrial }                from '../services/superAdminService';
import { sendEmailVerification }         from 'firebase/auth';
import { auth }                          from '../services/firebase';
import PasswordInput                     from '../components/PasswordInput';
import {
  validateEmail, validateGhanaPhone, validateSchoolName, checkPasswordStrength,
} from '../utils/validation';

export default function TrialSignup() {
  const { registerAdmin, logout } = useAuth();

  const [step, setStep]   = useState(1); // 1=form, 2=verify-email, 3=pending-approval
  const [form, setForm]   = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '',
    schoolName: '', address: '',
    academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    currentTerm: '1',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  function update(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' })); // clear field error on change
  }

  function validate() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required';

    const emailCheck = validateEmail(form.email);
    if (!emailCheck.valid) errs.email = emailCheck.error;

    const phoneCheck = validateGhanaPhone(form.phone);
    if (!phoneCheck.valid) errs.phone = phoneCheck.error;

    const strengthCheck = checkPasswordStrength(form.password);
    if (strengthCheck.score < 3) errs.password = 'Password is too weak — ' + strengthCheck.errors[0];
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';

    const nameCheck = validateSchoolName(form.schoolName);
    if (!nameCheck.valid) errs.schoolName = nameCheck.error;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true); setGlobalError('');
    try {
      const phoneCheck = validateGhanaPhone(form.phone);

      const { school, userProfile } = await registerAdmin(form.email, form.password, {
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        schoolName:  form.schoolName.trim(),
        address:     form.address.trim(),
        phone:       phoneCheck.normalised,
        email:       form.email.trim(),
        code:        form.schoolName.trim().substring(0, 3).toUpperCase(),
        academicYear: form.academicYear,
        currentTerm:  form.currentTerm,
      });

      // Send email verification immediately
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser);
      }

      // Create pending trial subscription (not active — super admin must approve)
      await startFreeTrial(school.id, form.schoolName.trim(), form.email.trim(), phoneCheck.normalised);

      setStep(2); // → verify email screen
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErrors(e => ({ ...e, email: 'This email is already registered. Try signing in.' }));
      } else {
        setGlobalError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      alert('Verification email resent! Check your inbox and spam folder.');
    }
  }

  async function handleCheckVerified() {
    const user = auth.currentUser;
    if (!user) return;
    await user.reload();
    if (user.emailVerified) {
      setStep(3); // → pending approval screen
    } else {
      alert("Email not verified yet. Check your inbox (and spam folder) and click the verification link first.");
    }
  }

  function FieldError({ field }) {
    if (!errors[field]) return null;
    return <div style={{ fontSize: '.72rem', color: '#ef5350', marginTop: 3 }}>⚠ {errors[field]}</div>;
  }

  // ── STEP 2: Email verification ──────────────────────────────────
  if (step === 2) {
    return (
      <div className="auth-page" style={{ justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 10 }}>Verify Your Email</h2>
          <p style={{ color: 'var(--text-mid)', marginBottom: 6, lineHeight: 1.7, fontSize: '.88rem' }}>
            We've sent a verification link to:
          </p>
          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1rem', marginBottom: 20, padding: '10px 16px', background: '#e3f2fd', borderRadius: 8 }}>
            {form.email}
          </div>
          <p style={{ color: 'var(--text-mid)', marginBottom: 24, fontSize: '.85rem', lineHeight: 1.6 }}>
            Click the link in the email, then come back here and click "I've Verified My Email" below.
            Check your <strong>spam or junk folder</strong> if you don't see it.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary btn-lg" onClick={handleCheckVerified}>
              ✓ I've Verified My Email
            </button>
            <button className="btn btn-ghost" onClick={handleResendVerification}>
              📨 Resend Verification Email
            </button>
          </div>
          <div style={{ marginTop: 20, fontSize: '.78rem', color: 'var(--text-lt)' }}>
            Wrong email?{' '}
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline' }}>
              Sign out and start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: Pending approval ─────────────────────────────────────
  if (step === 3) {
    return (
      <div className="auth-page" style={{ justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 10 }}>Trial Request Submitted!</h2>
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>✓ What happens next</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: '.84rem', lineHeight: 2, color: '#388e3c' }}>
              <li>Our team reviews your application (usually within a few hours)</li>
              <li>You'll receive a WhatsApp/SMS confirmation when approved</li>
              <li>Log back in and you'll have full trial access</li>
            </ol>
          </div>
          <div style={{ background: '#fff3e0', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: '.85rem' }}>Why manual review?</div>
            <div style={{ fontSize: '.8rem', color: '#bf6000', lineHeight: 1.6 }}>
              We verify each trial request to ensure SchoolMS is being used by real schools.
              This protects the integrity of the platform for all paying schools.
            </div>
          </div>
          <a
            href="https://wa.me/233549548274?text=Hello, I just submitted a trial request for SchoolMS for my school."
            target="_blank" rel="noreferrer"
            className="btn btn-primary btn-lg"
            style={{ display: 'block', textDecoration: 'none', marginBottom: 10 }}
          >
            📱 Message us on WhatsApp — 0549548274
          </a>
          <div style={{ fontSize: '.78rem', color: 'var(--text-lt)' }}>
            Already approved?{' '}
            <button onClick={() => window.location.href = '/login'} style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', textDecoration: 'underline', fontSize: '.78rem' }}>
              Sign in here
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: Signup form ──────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 16px', marginBottom: 24 }}>
          <span style={{ fontSize: '1.3rem' }}>🎁</span>
          <span style={{ fontSize: '.85rem', fontWeight: 700 }}>Free Trial</span>
        </div>
        <h1>Try SchoolMS Free</h1>
        <p style={{ marginTop: 12, opacity: .9 }}>Set up your school and experience the real system — not a watered-down demo.</p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['✓', 'No card or payment details required'],
            ['✓', 'Full access during your trial period'],
            ['✓', 'Your data is safe after trial — nothing deleted'],
            ['✓', 'No auto-charges — you choose if and when to pay'],
            ['⚠', 'Real school name, email & Ghana phone required — we verify each request'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 10, fontSize: '.83rem', opacity: icon === '⚠' ? 1 : .85 }}>
              <span style={{ color: icon === '⚠' ? '#ffd54f' : '#81c784', fontWeight: 700, flexShrink: 0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right" style={{ overflowY: 'auto' }}>
        <h2>Create Your Trial Account</h2>
        <p className="sub">All fields marked * are required and must be accurate.</p>

        {globalError && (
          <div className="alert alert-danger" style={{ marginBottom: 14, whiteSpace: 'pre-line' }}>⚠ {globalError}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)' }}>Admin Contact</div>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input required value={form.firstName} onChange={e => update('firstName', e.target.value)} style={{ borderColor: errors.firstName ? '#ef5350' : '' }} />
              <FieldError field="firstName" />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input required value={form.lastName} onChange={e => update('lastName', e.target.value)} style={{ borderColor: errors.lastName ? '#ef5350' : '' }} />
              <FieldError field="lastName" />
            </div>
            <div className="form-group full">
              <label>Email Address *</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@school.edu.gh or gmail.com" style={{ borderColor: errors.email ? '#ef5350' : '' }} />
              <FieldError field="email" />
              <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', marginTop: 2 }}>Must be a real email — a verification link will be sent</div>
            </div>
            <div className="form-group full">
              <label>Ghana Mobile Phone *</label>
              <input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="e.g. 0241234567 or 0541234567" style={{ borderColor: errors.phone ? '#ef5350' : '' }} />
              <FieldError field="phone" />
              <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', marginTop: 2 }}>Ghana mobile only. Used to confirm your identity — never for marketing.</div>
            </div>
            <div className="form-group full">
              <PasswordInput value={form.password} onChange={e => update('password', e.target.value)} label="Password" />
              {errors.password && <div style={{ fontSize: '.72rem', color: '#ef5350', marginTop: 2 }}>⚠ {errors.password}</div>}
            </div>
            <div className="form-group full">
              <PasswordInput value={form.confirm} onChange={e => update('confirm', e.target.value)} label="Confirm Password" showStrength={false} />
              {errors.confirm && <div style={{ fontSize: '.72rem', color: '#ef5350', marginTop: 2 }}>⚠ {errors.confirm}</div>}
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', paddingTop: 6, borderTop: '1px solid var(--border)' }}>School Information</div>
          <div className="form-grid">
            <div className="form-group full">
              <label>School Name *</label>
              <input required value={form.schoolName} onChange={e => update('schoolName', e.target.value)} placeholder="e.g. Holy Family Basic School" style={{ borderColor: errors.schoolName ? '#ef5350' : '' }} />
              <FieldError field="schoolName" />
              <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', marginTop: 2 }}>Your school's real registered name — we verify this</div>
            </div>
            <div className="form-group full">
              <label>School Address</label>
              <input value={form.address} onChange={e => update('address', e.target.value)} placeholder="e.g. Kasoa, Central Region" />
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <input value={form.academicYear} onChange={e => update('academicYear', e.target.value)} placeholder="2024/2025" />
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

          <div style={{ fontSize: '.75rem', color: 'var(--text-mid)', background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6 }}>
            By submitting, you confirm that the information above is accurate and belongs to a real school. 
            False information will result in the trial being rejected. Your email will be verified before access is granted.
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Creating your account…' : '🎁 Submit Trial Request'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>
            Already paying?{' '}
            <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>Register with access code →</Link>
          </div>
          <Link to="/login" style={{ color: 'var(--text-lt)', fontSize: '.8rem' }}>← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
