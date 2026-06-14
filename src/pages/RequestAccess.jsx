// src/pages/RequestAccess.jsx
//
// Changes:
// - submitAccessRequest() (in superAdminService) now automatically sends EmailJS
//   notifications after saving to Firestore. No page-level changes are needed for
//   that feature — it is fully transparent to the form.
// - Fixed: duplicate `padding` style prop on plan comparison div (JSX lint warning).
// - Preserved all existing UI and form logic exactly.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitAccessRequest } from '../services/superAdminService';

export default function RequestAccess() {
  const [form, setForm] = useState({
    schoolName: '', adminName: '', phone: '', email: '',
    region: '', schoolType: '', studentCount: '', plan: 'pro', message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await submitAccessRequest(form);
      setSubmitted(true);
    } catch (err) {
      console.error('[RequestAccess] Submit error:', err);
      setError('Submission failed. Please try WhatsApp directly.');
    } finally {
      setLoading(false);
    }
  }

  const plans = [
    { id: 'starter', label: 'Starter — GHS 150/month', desc: 'Up to 200 students' },
    { id: 'pro',     label: 'Pro — GHS 250/month',     desc: 'Unlimited students + Analytics' },
    { id: 'premium', label: 'Premium — GHS 400/month', desc: 'Everything + Backup & Export' },
  ];

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <h1>SchoolMS</h1>
          <p>Professional school management for Ghana.</p>
        </div>
        <div className="auth-right" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Request Received!</h2>
          <p style={{ color: 'var(--text-mid)', marginBottom: 24, lineHeight: 1.7 }}>
            Thank you, <strong>{form.adminName}</strong>. We'll contact you within 24 hours
            to confirm payment details and send your access code.
          </p>
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 8 }}>
              For faster response, contact us directly:
            </p>
            <a
              href="https://wa.me/233240000000" target="_blank" rel="noreferrer"
              style={{
                display: 'block', background: '#25D366', color: '#fff',
                padding: '10px 20px', borderRadius: 8, fontWeight: 700,
                textDecoration: 'none', marginBottom: 8,
              }}
            >
              📱 WhatsApp: 024XXXXXXX
            </a>
            <a
              href="tel:+233240000000"
              style={{
                display: 'block', background: 'var(--navy)', color: '#fff',
                padding: '10px 20px', borderRadius: 8, fontWeight: 700, textDecoration: 'none',
              }}
            >
              📞 Call: 024XXXXXXX
            </a>
          </div>
          <Link to="/login" style={{ color: 'var(--navy)', fontSize: '.84rem' }}>← Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <h1>SchoolMS</h1>
        <p>Professional school management system built for Ghana.</p>

        <div style={{ marginTop: 36 }}>
          {[
            { icon: '📊', text: 'Student records & enrollment history' },
            { icon: '✏️', text: 'Score entry & automatic result generation' },
            { icon: '📄', text: 'Professional PDF report cards' },
            { icon: '🚀', text: 'Safe promotion engine with audit trail' },
            { icon: '📈', text: 'Performance analytics dashboard' },
            { icon: '💾', text: 'Excel & MS Access backup (Premium)' },
            { icon: '📱', text: 'Works offline — no internet required' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 12, fontSize: '.88rem', opacity: .9,
            }}>
              <span>{f.icon}</span> {f.text}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: '.78rem', opacity: .7, marginBottom: 6 }}>Starting from</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>
            GHS 150<span style={{ fontSize: '1rem', fontWeight: 400 }}>/month</span>
          </div>
          <div style={{ fontSize: '.8rem', opacity: .7 }}>First month free trial</div>
        </div>
      </div>

      <div className="auth-right" style={{ width: '480px', overflowY: 'auto' }}>
        <h2>Request Access</h2>
        <p className="sub">Fill this form and we'll contact you with payment details and your access code.</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-grid">
            <div className="form-group full">
              <label>School Name *</label>
              <input
                required
                value={form.schoolName}
                onChange={e => update('schoolName', e.target.value)}
                placeholder="e.g. Kumasi Preparatory School"
              />
            </div>
            <div className="form-group">
              <label>Admin Name *</label>
              <input required value={form.adminName} onChange={e => update('adminName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone (MoMo) *</label>
              <input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="024XXXXXXX" />
            </div>
            <div className="form-group full">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Region</label>
              <select value={form.region} onChange={e => update('region', e.target.value)}>
                <option value="">— Select —</option>
                {[
                  'Ashanti', 'Greater Accra', 'Northern', 'Western', 'Eastern', 'Central',
                  'Volta', 'Brong-Ahafo', 'Upper East', 'Upper West', 'Savannah',
                  'Bono East', 'Ahafo', 'North East', 'Oti', 'Western North',
                ].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>School Type</label>
              <select value={form.schoolType} onChange={e => update('schoolType', e.target.value)}>
                <option value="">— Select —</option>
                <option>Primary School</option>
                <option>JHS</option>
                <option>SHS</option>
                <option>Primary + JHS</option>
                <option>JHS + SHS</option>
                <option>Private Basic</option>
                <option>Private Secondary</option>
              </select>
            </div>
            <div className="form-group">
              <label>Number of Students</label>
              <input
                type="number"
                value={form.studentCount}
                onChange={e => update('studentCount', e.target.value)}
                placeholder="e.g. 350"
              />
            </div>
            <div className="form-group">
              <label>Preferred Plan *</label>
              <select required value={form.plan} onChange={e => update('plan', e.target.value)}>
                {plans.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Additional Message</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={e => update('message', e.target.value)}
                placeholder="Any questions or special requirements…"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Plan comparison */}
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, fontSize: '.8rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--navy)' }}>Plan Comparison</div>
            {plans.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 4, marginBottom: 2,
                  background: form.plan === p.id ? '#e3f2fd' : '',
                }}
              >
                <span style={{ fontWeight: form.plan === p.id ? 700 : 400 }}>{p.label}</span>
                <span style={{ color: 'var(--text-lt)' }}>{p.desc}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, color: 'var(--text-mid)' }}>
              + Backup Add-on: GHS 100/month on any plan
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: '.82rem', color: 'var(--text-mid)' }}>
          Already have an access code?{' '}
          <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>Register here →</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Link to="/login" style={{ color: 'var(--text-lt)', fontSize: '.8rem' }}>← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
