// src/pages/TrialSignup.jsx
//
// FIXES:
// 1. Terms & Conditions acceptance is now MANDATORY before submission.
//    A clearly visible checkbox with links to all legal docs must be ticked.
//    Form submit is blocked until T&C is accepted — for legal compliance.
// 2. After account creation, the user is IMMEDIATELY signed out so they
//    cannot be auto-routed to the dashboard while pending approval.
//    They are shown the email-verification screen while logged out.
// 3. Atomic error handling: if startFreeTrial() fails after registerAdmin()
//    succeeds, the error is shown and admin is asked to contact support —
//    the AuthContext atomic rollback handles the Auth cleanup.
// 4. All validation preserved (email, Ghana phone, password strength, school name).

import React, { useState }              from 'react';
import { Link }                         from 'react-router-dom';
import { useAuth }                      from '../contexts/AuthContext';
import { startFreeTrial }               from '../services/superAdminService';
import { sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, deleteDoc }               from 'firebase/firestore';
import { auth, db }                     from '../services/firebase';
import PasswordInput                    from '../components/PasswordInput';
import {
  validateEmail, validateGhanaPhone, validateSchoolName, checkPasswordStrength,
} from '../utils/validation';

export default function TrialSignup() {
  const { registerAdmin, logout } = useAuth();

  // step 1=form, 2=email-verify (logged out), 3=pending-approval (logged out)
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '',
    schoolName: '', address: '',
    academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    currentTerm: '1',
    agreedToTerms: false,
  });
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [globalError, setGlobalError] = useState('');
  // Store submitted email for display after logout
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedSchool, setSubmittedSchool] = useState('');

  function update(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
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

    // T&C is required — legal compliance
    if (!form.agreedToTerms) errs.agreedToTerms = 'You must read and accept the Terms & Conditions to proceed.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true); setGlobalError('');
    let registeredUser = null;
    try {
      const phoneCheck = validateGhanaPhone(form.phone);

      // Step A: Create Firebase Auth + school + user profile (atomic —
      // registerAdmin() already rolls itself back internally if either
      // Firestore write fails).
      const { school, user } = await registerAdmin(form.email, form.password, {
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
      registeredUser = user;

      // Step B: Send email verification while still signed in
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser);
      }

      // Step C: Create pending trial subscription (NOT active — admin must approve)
      await startFreeTrial(school.id, form.schoolName.trim(), form.email.trim(), phoneCheck.normalised);

      // Step D: Record the email & school for display, then SIGN OUT immediately.
      // This prevents auto-routing to dashboard while pending_approval.
      // The SubscriptionContext would catch it too, but defence-in-depth:
      // a logged-out user cannot reach any app route at all.
      setSubmittedEmail(form.email.trim());
      setSubmittedSchool(form.schoolName.trim());
      await logout();

      setStep(2); // show email verification screen (logged-out state)

    } catch (err) {
      // ── FULL ROLLBACK ──────────────────────────────────────────
      // If ANYTHING after the Auth account was created fails (email
      // verification, or — most importantly — creating the pending trial
      // subscription itself), we must not leave behind a fully working,
      // logged-in account with no subscription tracking it at all. That
      // exact gap used to let a signup that failed partway through remain
      // silently usable and invisible to super admin monitoring.
      //
      // registerAdmin() already cleans up school/user docs if IT fails
      // internally. This handles the case where registerAdmin() SUCCEEDED
      // but a later step didn't: delete the user profile (allowed — an
      // admin can delete their own profile) and delete the Auth account
      // itself (a user can always delete their own current session),
      // then force sign-out no matter what, so nothing is ever left
      // logged in after an error here.
      if (registeredUser && err.code !== 'auth/email-already-in-use') {
        try {
          await deleteDoc(doc(db, 'users', registeredUser.uid));
        } catch (cleanupErr) {
          console.warn('[TrialSignup] Could not clean up user profile after failed signup:', cleanupErr.message);
        }
        try {
          if (auth.currentUser) await deleteUser(auth.currentUser);
        } catch (cleanupErr) {
          console.warn('[TrialSignup] Could not delete Auth account after failed signup:', cleanupErr.message);
        }
      }
      try { await logout(); } catch { /* already signed out or never fully signed in */ }

      if (err.code === 'auth/email-already-in-use') {
        setErrors(e => ({ ...e, email: 'This email is already registered. Try signing in.' }));
      } else {
        setGlobalError(
          `${err.message}\n\nYour account was not created — please try again. If this keeps happening, contact support.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function FieldError({ field }) {
    if (!errors[field]) return null;
    return <div style={{ fontSize: '.72rem', color: '#ef5350', marginTop: 3 }}>⚠ {errors[field]}</div>;
  }

  // ── STEP 2: Email verification (logged out) ──────────────────────
  if (step === 2) {
    return (
      <div className="auth-page" style={{ justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 500, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 10 }}>Verify Your Email</h2>
          <p style={{ color: 'var(--text-mid)', marginBottom: 6, lineHeight: 1.7, fontSize: '.88rem' }}>
            We've sent a verification link to:
          </p>
          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1rem', marginBottom: 20, padding: '10px 16px', background: '#e3f2fd', borderRadius: 8 }}>
            {submittedEmail}
          </div>

          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6, fontSize: '.85rem' }}>What happens next</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: '.82rem', lineHeight: 2.2, color: '#388e3c' }}>
              <li>Click the link in your email to verify your address</li>
              <li>Our team reviews your trial request for <strong>{submittedSchool}</strong></li>
              <li>You'll be notified via WhatsApp when approved</li>
              <li>Log in and you'll have full trial access</li>
            </ol>
          </div>

          <div style={{ background: '#fff3e0', borderRadius: 12, padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: '.84rem' }}>⚠ Important</div>
            <div style={{ fontSize: '.8rem', color: '#bf6000', lineHeight: 1.6 }}>
              Your account is <strong>pending admin approval</strong>. Do not attempt to log in until you
              receive confirmation — your access will be blocked until our team approves the request.
              Check your <strong>spam or junk folder</strong> if you don't see the verification email.
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginBottom: 10 }}
          >
            ✓ I've Verified My Email — What Now?
          </button>
          <Link to="/login" style={{ display: 'block', textAlign: 'center', color: 'var(--text-lt)', fontSize: '.8rem', marginTop: 8 }}>
            ← Back to login
          </Link>
        </div>
      </div>
    );
  }

  // ── STEP 3: Pending approval (logged out) ────────────────────────
  if (step === 3) {
    return (
      <div className="auth-page" style={{ justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 10 }}>Trial Request Submitted!</h2>
          <p style={{ color: 'var(--text-mid)', marginBottom: 16, fontSize: '.88rem', lineHeight: 1.6 }}>
            Your request for <strong>{submittedSchool}</strong> is under review.<br />
            You will be contacted when it is approved.
          </p>
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>✓ What happens next</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: '.84rem', lineHeight: 2, color: '#388e3c' }}>
              <li>Our team reviews your application (usually within a few hours)</li>
              <li>You'll receive a WhatsApp/SMS confirmation when approved</li>
              <li>Log back in — your trial will be active immediately after approval</li>
            </ol>
          </div>
          <div style={{ background: '#fff3e0', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: '.85rem' }}>Why manual review?</div>
            <div style={{ fontSize: '.8rem', color: '#bf6000', lineHeight: 1.6 }}>
              We verify each trial request to ensure SchoolPilot is being used by real schools.
              This protects the integrity of the platform for all subscribing schools.
            </div>
          </div>
          <a
            href="https://wa.me/233549548274?text=Hello, I just submitted a trial request for SchoolPilot for my school."
            target="_blank" rel="noreferrer"
            className="btn btn-primary btn-lg"
            style={{ display: 'block', textDecoration: 'none', marginBottom: 10 }}
          >
            📱 Message us on WhatsApp — 0549548274
          </a>
          <Link to="/login" style={{ display: 'block', textAlign: 'center', color: 'var(--text-lt)', fontSize: '.8rem', marginTop: 8 }}>
            ← Back to login (log in after approval)
          </Link>
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
        <h1>Try SchoolPilot Free</h1>
        <p style={{ marginTop: 12, opacity: .9 }}>Set up your school and experience the full system — not a watered-down demo.</p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['✓', 'No card or payment details required'],
            ['✓', 'Full access during your approved trial period'],
            ['✓', 'Your data is safe after trial — nothing deleted'],
            ['✓', 'No auto-charges — you choose if and when to pay'],
            ['⚠', 'Real school name, email & Ghana phone required — we verify each request'],
            ['⚠', 'Admin approval required — you will not be logged in until approved'],
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

          {/* ── TERMS & CONDITIONS — MANDATORY ────────────────────── */}
          <div style={{
            background: errors.agreedToTerms ? '#fce4ec' : 'var(--surface2)',
            border: `2px solid ${errors.agreedToTerms ? '#ef5350' : 'var(--border)'}`,
            borderRadius: 10, padding: '14px 16px',
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={e => update('agreedToTerms', e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--navy)', flexShrink: 0 }}
              />
              <div style={{ fontSize: '.82rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--navy)' }}>I have read and agree to the following:</strong>
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
                  By checking this box, you confirm that the information above is accurate, belongs to a real school,
                  and that you are authorised to register on behalf of this school.
                </div>
              </div>
            </label>
            {errors.agreedToTerms && (
              <div style={{ fontSize: '.75rem', color: '#c62828', marginTop: 8, fontWeight: 600 }}>
                ⚠ {errors.agreedToTerms}
              </div>
            )}
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
