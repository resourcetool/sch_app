// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <h1>School Management & Assessment System</h1>
        <p>A production-grade academic records platform with offline-first support, promotion tracking, and analytics — built for schools that take data seriously.</p>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['Multi-school isolation', 'Enrollment-based history tracking', 'Offline-first with auto sync', 'PDF reports & analytics'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .85, fontSize: '.88rem' }}>
              <span style={{ color: '#e94560' }}>✓</span> {f}
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <h2>Welcome Back</h2>
        <p className="sub">Sign in to your school's account</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email" required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="admin@school.edu.gh"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a href="/register" style={{ color: 'var(--navy)', fontSize: '.84rem' }}>
            Register your school →
          </a>
        </div>
      </div>
    </div>
  );
}
