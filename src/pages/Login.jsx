// src/pages/Login.jsx
//
// Changes:
// - Added "Forgot Password?" flow using Firebase sendPasswordResetEmail.
//   Teacher or admin types their email, Firebase sends a reset link.
// - Shows success confirmation after sending reset email.
// - All existing login logic preserved.

import React, { useState } from 'react';
import { useNavigate, Link }          from 'react-router-dom';
import { useAuth }                    from '../contexts/AuthContext';
import { isSuperAdmin }               from '../services/superAdminService';
import { sendPasswordResetEmail }     from 'firebase/auth';
import { auth }                       from '../services/firebase';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form,       setForm]       = useState({ email: '', password: '' });
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [resetMode,  setResetMode]  = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent,  setResetSent]  = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const cred = await login(form.email, form.password);
      if (isSuperAdmin(cred.user.email)) {
        navigate('/superadmin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = {
        'auth/user-not-found':       'No account found with this email.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/invalid-credential':   'Incorrect email or password.',
        'auth/too-many-requests':    'Too many attempts. Try again in a few minutes.',
        'auth/network-request-failed':'No internet connection. Check your network.',
      };
      setError(msg[err.code] || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    if (!resetEmail.trim()) { setResetError('Enter your email address.'); return; }
    setResetLoading(true); setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      const msg = {
        'auth/user-not-found':       'No account found with this email address.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/network-request-failed':'No internet. Check your connection.',
      };
      setResetError(msg[err.code] || 'Failed to send reset email. Try again.');
    } finally { setResetLoading(false); }
  }

  const features = [
    { icon: '👥', text: 'Student records & enrollment history'  },
    { icon: '✏️', text: 'Score entry & automatic result generation' },
    { icon: '📄', text: 'Professional PDF report cards'          },
    { icon: '🚀', text: 'Safe promotion engine with audit trail' },
    { icon: '📈', text: 'Performance analytics dashboard'        },
    { icon: '📱', text: 'Works offline — no internet required'   },
  ];

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 16px', marginBottom: 24 }}>
            <span style={{ fontSize: '1.3rem' }}>🏫</span>
            <span style={{ fontSize: '.85rem', fontWeight: 700, letterSpacing: '.04em' }}>SchoolMS Ghana</span>
          </div>
          <h1>Manage Your School Records Professionally</h1>
          <p style={{ marginTop: 12 }}>
            A complete academic management system built for Ghanaian schools — from score entry to promotion, reports to analytics.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '.85rem', opacity: .85 }}>
              <span style={{ fontSize: '1rem', width: 28, textAlign: 'center', flexShrink: 0 }}>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 20px', maxWidth: 340 }}>
          <div style={{ fontSize: '.72rem', opacity: .6, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Starting from</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>GHS 150<span style={{ fontSize: '.9rem', fontWeight: 400, opacity: .7 }}>/month</span></div>
          <div style={{ fontSize: '.78rem', opacity: .6, marginTop: 2 }}>First month free trial</div>
        </div>
      </div>

      <div className="auth-right">
        {/* ── FORGOT PASSWORD ── */}
        {resetMode ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); setResetError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontSize: '.84rem', padding: 0, marginBottom: 12 }}
              >
                ← Back to login
              </button>
              <h2>Reset Password</h2>
              <p className="sub">Enter your email address and we'll send you a link to reset your password.</p>
            </div>

            {resetSent ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
                <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Reset link sent!</h3>
                <p style={{ color: 'var(--text-mid)', fontSize: '.88rem', marginBottom: 20, lineHeight: 1.6 }}>
                  Check your email at <strong>{resetEmail}</strong> for a password reset link.
                  Check your spam folder if you don't see it within a few minutes.
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); setForm(f => ({ ...f, email: resetEmail })); }}
                  className="btn btn-primary"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {resetError && (
                  <div className="alert alert-danger"><span>⚠️</span> {resetError}</div>
                )}
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email" required autoFocus
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={resetLoading}>
                  {resetLoading ? 'Sending…' : '📧 Send Reset Link'}
                </button>
              </form>
            )}
          </>
        ) : (
          /* ── NORMAL LOGIN ── */
          <>
            <div style={{ marginBottom: 28 }}>
              <h2>Sign In</h2>
              <p className="sub">Welcome back. Enter your credentials to continue.</p>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email" type="email" required autoComplete="email"
                  placeholder="admin@school.edu.gh"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label htmlFor="password" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetEmail(form.email); setResetError(''); setResetSent(false); }}
                    style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    required autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-lt)', cursor: 'pointer', fontSize: '.85rem', padding: 4 }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
              <div style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>
                Have an access code?{' '}
                <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>Register your school →</Link>
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>
                New school?{' '}
                <Link to="/request-access" style={{ color: 'var(--text-mid)' }}>Request access</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
