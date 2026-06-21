// src/pages/TrialSignup.jsx
//
// New page — self-serve free trial signup. No registration code required.
// This is the missing piece that makes "30 days free, no code needed"
// actually true: previously Register.jsx required a super-admin-issued
// code for ANY signup, meaning schools could not try the system without
// first contacting the super admin.
//
// Flow:
//   1. School fills in admin + school details (same as paid registration)
//   2. registerAdmin() creates the Firebase Auth account + school doc
//      (reuses the exact same function the paid/code path uses)
//   3. startFreeTrial() creates a trial subscription tied to email + phone,
//      with anti-fraud eligibility check (one trial per email/phone)
//   4. Admin lands on the dashboard immediately — no waiting for anyone

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }           from '../contexts/AuthContext';
import { startFreeTrial }    from '../services/superAdminService';

export default function TrialSignup() {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '',
    schoolName: '', address: '', schoolPhone: '', schoolEmail: '',
    academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    currentTerm: '1',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters'); return; }
    if (!form.phone.trim())             { setError('Phone number is required to start your trial'); return; }

    setLoading(true);
    try {
      const { school } = await registerAdmin(form.email, form.password, {
        firstName:  form.firstName,
        lastName:   form.lastName,
        schoolName: form.schoolName,
        address:    form.address,
        phone:      form.schoolPhone || form.phone,
        email:      form.schoolEmail || form.email,
        code:       form.schoolName.substring(0, 3).toUpperCase(),
        academicYear: form.academicYear,
        currentTerm:  form.currentTerm,
      });

      // Anti-fraud check happens inside startFreeTrial — throws if this
      // email or phone has already used a trial before, even under a
      // different school name.
      await startFreeTrial(school.id, form.schoolName, form.email, form.phone);

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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 16px', marginBottom: 24 }}>
          <span style={{ fontSize: '1.3rem' }}>🎁</span>
          <span style={{ fontSize: '.85rem', fontWeight: 700, letterSpacing: '.04em' }}>Free Trial — No Card Needed</span>
        </div>
        <h1>Try SchoolMS Free</h1>
        <p style={{ marginTop: 12 }}>
          Set up your school and start using the real system today — no payment details, no waiting for approval.
        </p>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: '.86rem', marginBottom: 6 }}>How the free trial works</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.82rem', lineHeight: 1.8, opacity: .85 }}>
              <li>Full access to add students, teachers, classes, and subjects</li>
              <li>Trial ends when you generate your first report, finalise a full class, or after 21 days — whichever comes first</li>
              <li>After your trial, your account becomes read-only — nothing is ever deleted</li>
              <li>No card details collected. No auto-charge. You choose if and when to pay.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: '.86rem', marginBottom: 4 }}>Why we ask for a phone number</div>
            <div style={{ fontSize: '.8rem', opacity: .8, lineHeight: 1.6 }}>
              To keep the trial fair for everyone, each email and phone number can only be used
              for one free trial. This isn't used for marketing — only to prevent abuse.
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right" style={{ overflowY: 'auto' }}>
        <h2>Start Your Free Trial</h2>
        <p className="sub">No access code needed — just fill in your details below.</p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <label>Phone *</label>
              <input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="024XXXXXXX" />
              <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Used only to prevent duplicate trials</span>
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

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Setting up your trial…' : '🎁 Start My Free Trial'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>
            Already paying?{' '}
            <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>Register with your access code →</Link>
          </div>
          <Link to="/login" style={{ color: 'var(--text-lt)', fontSize: '.8rem' }}>← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
