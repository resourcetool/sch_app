// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isSuperAdmin } from '../services/superAdminService';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const cred = await login(form.email, form.password);
      // Redirect based on role
      if (isSuperAdmin(cred.user.email)) {
        navigate('/superadmin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
        'auth/network-request-failed': 'No internet connection. Check your network.',
      };
      setError(msg[err.code] || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: '👥', text: 'Student records & enrollment history' },
    { icon: '✏️', text: 'Score entry & automatic result generation' },
    { icon: '📄', text: 'Professional PDF report cards' },
    { icon: '🚀', text: 'Safe promotion engine with audit trail' },
    { icon: '📈', text: 'Performance analytics dashboard' },
    { icon: '📱', text: 'Works offline — no internet required' },
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
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@school.edu.gh"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-lt)', cursor: 'pointer', fontSize: '.85rem', padding: 4
                }}
              >{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
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
      </div>
    </div>
  );
}
