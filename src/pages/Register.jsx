// src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '', password: '', confirm: '',
    firstName: '', lastName: '',
    schoolName: '', address: '', phone: '', schoolEmail: '',
    code: '', academicYear: '2024/2025', currentTerm: '1'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await registerAdmin(form.email, form.password, {
        firstName: form.firstName,
        lastName: form.lastName,
        schoolName: form.schoolName,
        address: form.address,
        phone: form.phone,
        email: form.schoolEmail,
        code: form.code,
        academicYear: form.academicYear,
        currentTerm: form.currentTerm
      });
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
        <h1>Get Started</h1>
        <p>Register your school and start managing academic records in minutes.</p>
      </div>
      <div className="auth-right" style={{ width: '500px', overflowY: 'auto' }}>
        <h2>School Registration</h2>
        <p className="sub">Set up your school account</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name *</label>
              <input type="text" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input type="text" required value={form.lastName} onChange={e => update('lastName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Admin Email *</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Confirm Password *</label>
              <input type="password" required value={form.confirm} onChange={e => update('confirm', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>School Name *</label>
              <input type="text" required value={form.schoolName} onChange={e => update('schoolName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>School Code (3-4 chars)</label>
              <input type="text" maxLength={4} value={form.code} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="e.g. GHS" />
            </div>
            <div className="form-group">
              <label>School Phone</label>
              <input type="text" value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>School Address</label>
              <input type="text" value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <input type="text" value={form.academicYear} onChange={e => update('academicYear', e.target.value)} placeholder="2024/2025" />
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
            {loading ? 'Creating Account…' : 'Create School Account'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/login" style={{ color: 'var(--navy)', fontSize: '.84rem' }}>← Back to Sign In</a>
        </div>
      </div>
    </div>
  );
}
