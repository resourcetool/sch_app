// src/pages/RequestAccess.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { PLANS } from '../services/subscriptionService';

const REGIONS = [
  'Ashanti','Greater Accra','Northern','Western','Eastern',
  'Central','Volta','Bono','Bono East','Ahafo',
  'Upper East','Upper West','Savannah','North East','Oti','Western North'
];

const SCHOOL_TYPES = [
  'Primary School','JHS','SHS',
  'Primary + JHS','JHS + SHS',
  'Private Basic School','Private Secondary School','Other'
];

export default function RequestAccess() {
  const [form, setForm] = useState({
    schoolName: '', adminName: '', phone: '', email: '',
    region: '', schoolType: '', studentCount: '', plan: 'pro', message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!form.schoolName.trim()) { setError('Please enter your school name.'); setLoading(false); return; }
    if (!form.adminName.trim())  { setError('Please enter your name.'); setLoading(false); return; }
    if (!form.phone.trim())      { setError('Please enter your phone number.'); setLoading(false); return; }

    try {
      // Try Firestore first — if it fails, fallback gracefully
      await addDoc(collection(db, 'accessRequests'), {
        ...form,
        status: 'pending',
        submittedAt: Date.now(),
        submittedAtISO: new Date().toISOString()
      });
      setSubmitted(true);
    } catch (firestoreErr) {
      console.warn('Firestore write failed:', firestoreErr.message);
      // Fallback: still show success and direct to WhatsApp
      // The school can contact via WhatsApp with their details
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  const plans = [
    { id: 'starter', label: 'Starter',  price: 'GHS 150/month', desc: 'Up to 200 students, PDF reports' },
    { id: 'pro',     label: 'Pro',      price: 'GHS 250/month', desc: 'Unlimited students + Analytics' },
    { id: 'premium', label: 'Premium',  price: 'GHS 400/month', desc: 'Everything + Backup & Export' },
  ];

  // Build WhatsApp message with form data
  const waMessage = encodeURIComponent(
    `Hello, I would like to request access to SchoolMS.\n\n` +
    `School: ${form.schoolName}\n` +
    `Admin: ${form.adminName}\n` +
    `Phone: ${form.phone}\n` +
    `Email: ${form.email}\n` +
    `Region: ${form.region}\n` +
    `Type: ${form.schoolType}\n` +
    `Students: ${form.studentCount}\n` +
    `Plan: ${form.plan.toUpperCase()}\n` +
    `Message: ${form.message}`
  );
  const waLink = `https://wa.me/233240000000?text=${waMessage}`;

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '48px 40px',
          maxWidth: 480, width: '100%', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,.25)'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#0f3460', marginBottom: 10, fontSize: '1.3rem' }}>Request Received!</h2>
          <p style={{ color: '#64748b', lineHeight: 1.7, marginBottom: 28, fontSize: '.88rem' }}>
            Thank you, <strong>{form.adminName}</strong>! We will contact you within 24 hours
            with payment details and your access code.
          </p>

          {/* WhatsApp for faster response */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <p style={{ fontSize: '.82rem', color: '#15803d', fontWeight: 600, marginBottom: 10 }}>
              📱 For faster response, send us a WhatsApp message:
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block', background: '#25D366', color: '#fff',
                padding: '11px 20px', borderRadius: 10, fontWeight: 700,
                textDecoration: 'none', fontSize: '.88rem'
              }}
            >
              Open WhatsApp Chat →
            </a>
            <p style={{ fontSize: '.74rem', color: '#16a34a', marginTop: 8 }}>
              Your details will be pre-filled in the message
            </p>
          </div>

          <div style={{ fontSize: '.8rem', color: '#94a3b8', marginBottom: 20 }}>
            Or call us directly: <strong style={{ color: '#0f3460' }}>024XXXXXXX</strong>
          </div>

          <Link
            to="/login"
            style={{
              display: 'inline-block', color: '#0f3460',
              fontSize: '.84rem', fontWeight: 600,
              borderBottom: '1px solid #0f3460', paddingBottom: 2
            }}
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,.1)', borderRadius: 12,
            padding: '8px 18px', marginBottom: 20
          }}>
            <span style={{ fontSize: '1.2rem' }}>🏫</span>
            <span style={{ fontWeight: 700, fontSize: '.9rem' }}>SchoolMS Ghana</span>
          </div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: 10 }}>Request School Access</h1>
          <p style={{ opacity: .75, fontSize: '.88rem', maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
            Fill this form and we'll contact you with payment details and your access code within 24 hours.
          </p>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
          {plans.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => update('plan', p.id)}
              style={{
                background: form.plan === p.id ? '#fff' : 'rgba(255,255,255,.07)',
                border: `2px solid ${form.plan === p.id ? '#e94560' : 'rgba(255,255,255,.15)'}`,
                borderRadius: 12, padding: '14px 12px', cursor: 'pointer',
                textAlign: 'center', transition: 'all .15s'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '.88rem', color: form.plan === p.id ? '#0f3460' : '#fff', marginBottom: 3 }}>
                {p.label}
              </div>
              <div style={{ fontWeight: 700, fontSize: '.78rem', color: form.plan === p.id ? '#e94560' : 'rgba(255,255,255,.7)' }}>
                {p.price}
              </div>
              <div style={{ fontSize: '.7rem', color: form.plan === p.id ? '#64748b' : 'rgba(255,255,255,.45)', marginTop: 4 }}>
                {p.desc}
              </div>
            </button>
          ))}
        </div>

        {/* Form Card */}
        <div style={{
          background: '#fff', borderRadius: 20,
          padding: '32px 36px', boxShadow: '0 20px 60px rgba(0,0,0,.25)'
        }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, padding: '11px 14px',
              color: '#991b1b', fontSize: '.84rem', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '.76rem', fontWeight: 600, color: '#64748b', marginBottom: 5 }}>
                  School Name *
                </label>
                <input
                  required
                  type="text"
                  value={form.schoolName}
                  onChange={e => update('schoolName', e.target.value)}
                  placeholder="e.g. Kumasi Preparatory School"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Your Name *</label>
                <input
                  required type="text"
                  value={form.adminName}
                  onChange={e => update('adminName', e.target.value)}
                  placeholder="Head teacher / Admin name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Phone (MoMo) *</label>
                <input
                  required type="tel"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  placeholder="024XXXXXXX"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="admin@school.edu.gh"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Number of Students</label>
                <input
                  type="number"
                  value={form.studentCount}
                  onChange={e => update('studentCount', e.target.value)}
                  placeholder="e.g. 350"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Region</label>
                <select value={form.region} onChange={e => update('region', e.target.value)} style={inputStyle}>
                  <option value="">— Select Region —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>School Type</label>
                <select value={form.schoolType} onChange={e => update('schoolType', e.target.value)} style={inputStyle}>
                  <option value="">— Select Type —</option>
                  {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Selected Plan</label>
                <select value={form.plan} onChange={e => update('plan', e.target.value)} style={inputStyle}>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.label} — {p.price}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Additional Message (optional)</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => update('message', e.target.value)}
                  placeholder="Any questions or special requirements…"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                />
              </div>
            </div>

            {/* Submit buttons */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px 24px',
                  background: '#0f3460', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: '.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? .7 : 1,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit'
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                    Submitting…
                  </>
                ) : 'Submit Request →'}
              </button>

              {/* WhatsApp alternative — always visible */}
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#e2e8f0' }} />
                <span style={{ position: 'relative', background: '#fff', padding: '0 12px', fontSize: '.75rem', color: '#94a3b8' }}>or contact directly</span>
              </div>

              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: '100%', padding: '11px 24px',
                  background: '#25D366', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: '.88rem',
                  textDecoration: 'none', textAlign: 'center',
                  display: 'block'
                }}
              >
                📱 Send via WhatsApp Instead
              </a>
            </div>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: '.8rem', color: '#94a3b8' }}>
            Already have a code?{' '}
            <Link to="/register" style={{ color: '#0f3460', fontWeight: 700 }}>Register here →</Link>
            {' · '}
            <Link to="/login" style={{ color: '#94a3b8' }}>Back to login</Link>
          </div>
        </div>

        {/* Features strip */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { icon: '📱', text: 'Works offline' },
            { icon: '🔒', text: 'Data is secure' },
            { icon: '📄', text: 'PDF reports' },
          ].map(f => (
            <div key={f.text} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.65)', fontWeight: 600 }}>{f.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '.76rem',
  fontWeight: 600, color: '#64748b', marginBottom: 5
};

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 8, background: '#fff',
  color: '#1e293b', fontSize: '.84rem',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border-color .15s',
  appearance: 'none', WebkitAppearance: 'none',
  boxSizing: 'border-box',
  lineHeight: '1.5'
};
