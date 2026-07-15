// src/pages/Login.jsx
//
// ADDED:
// 1. "Watch Demo" button on the left panel — opens a fullscreen modal
//    with your embedded training video (YouTube/Google Drive/Vimeo).
//    Set your video URL in the DEMO_VIDEO_URL constant below.
// 2. Interactive Feature Tour — 6-step guided walkthrough schools can
//    click through before signing up. Shows what each module does with
//    a short description, icon, and "what you can do" bullet points.
//    Helps first-time visitors understand the system immediately.
// 3. "How it works" 3-step section below the feature list — simple
//    visual flow: Request Trial → Admin Approves → Start Using.
// 4. All existing login, forgot-password logic fully preserved.

import React, { useState } from 'react';
import { useNavigate, Link }          from 'react-router-dom';
import { useAuth }                    from '../contexts/AuthContext';
import { isSuperAdmin }               from '../services/superAdminService';
import { sendPasswordResetEmail }     from 'firebase/auth';
import { auth }                       from '../services/firebase';

// ── SET YOUR VIDEO URL HERE ───────────────────────────────────────
// Paste any of these formats:
//   YouTube:      https://www.youtube.com/embed/YOUR_VIDEO_ID
//   Google Drive: https://drive.google.com/file/d/YOUR_FILE_ID/preview
//   Vimeo:        https://player.vimeo.com/video/YOUR_VIDEO_ID
const DEMO_VIDEO_URL = 'https://www.youtube.com/embed/YOUR_VIDEO_ID';
// ─────────────────────────────────────────────────────────────────

// ── FEATURE TOUR STEPS ───────────────────────────────────────────
const TOUR_STEPS = [
  {
    icon: '👥',
    title: 'Student Records',
    color: '#0F3460',
    desc: 'Add and manage all your students in one place. Import hundreds from Excel in seconds.',
    points: [
      'Add students with name, class, guardian contacts',
      'Import bulk students from Excel spreadsheet',
      'Enrol students into classes automatically',
      'View full student profile and history',
    ],
    screen: '📋 Students Page',
  },
  {
    icon: '✏️',
    title: 'Score Entry',
    color: '#2980B9',
    desc: 'Teachers enter class and exam scores quickly. Grades are calculated automatically.',
    points: [
      'Grid-style entry — type fast, Tab to move',
      'Grade calculated instantly as you type',
      'Assessment deadlines lock entry after closing',
      'Admin can review and override any score',
    ],
    screen: '✏️ Scores Page',
  },
  {
    icon: '📄',
    title: 'Report Cards',
    color: '#27AE60',
    desc: 'Generate professional PDF report cards for every student in one click.',
    points: [
      'Print individual or whole-class report cards',
      'School logo, crest, and colours on every report',
      'Student position, grade, and teacher remarks',
      'Works for all GES formats — Basic, JHS, SHS',
    ],
    screen: '📄 Reports Page',
  },
  {
    icon: '👨‍🏫',
    title: 'Teacher Accounts',
    color: '#8E44AD',
    desc: 'Each teacher gets their own login. They only see their assigned classes and subjects.',
    points: [
      'Create teacher accounts in seconds',
      'Assign specific classes and subjects per teacher',
      'Teachers cannot see each other\'s scores',
      'Admin sees when each teacher last logged in',
    ],
    screen: '👨‍🏫 Teachers Page',
  },
  {
    icon: '🚀',
    title: 'Promotion',
    color: '#E67E22',
    desc: 'Move students to the next class at year end. Automatic pass/fail decisions with your rules.',
    points: [
      'Set your own pass mark and core subjects',
      'Preview every student\'s decision before running',
      'Promote, hold back, or mark as conditional',
      'Full audit record saved for every promotion',
    ],
    screen: '🚀 Promotion Page',
  },
  {
    icon: '📊',
    title: 'Analytics',
    color: '#E94560',
    desc: 'See how your school is performing with visual charts — no spreadsheets needed.',
    points: [
      'Grade distribution chart per class per term',
      'Subject comparison — which subjects need help',
      'Student progress tracked across all terms',
      'Pass/fail ratio at a glance',
    ],
    screen: '📊 Analytics Page',
  },
];

// ── DEMO VIDEO MODAL ─────────────────────────────────────────────
function DemoModal({ onClose }) {
  const isPlaceholder = DEMO_VIDEO_URL.includes('YOUR_VIDEO_ID');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
              🎬 SchoolMS — How It Works
            </div>
            <div style={{ color: '#90A4AE', fontSize: '.8rem', marginTop: 2 }}>
              Watch this short demo to see exactly how SchoolMS works for your school
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              fontSize: '.85rem', fontWeight: 700,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Video or placeholder */}
        <div style={{
          width: '100%', aspectRatio: '16/9',
          background: '#0a0a0a', borderRadius: 12,
          overflow: 'hidden', position: 'relative',
          border: '1px solid rgba(255,255,255,.1)',
        }}>
          {isPlaceholder ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#fff', gap: 16,
            }}>
              <div style={{ fontSize: '3rem' }}>🎬</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Your Training Video Goes Here</div>
              <div style={{ color: '#90A4AE', fontSize: '.85rem', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                Open <code style={{ background: 'rgba(255,255,255,.1)', padding: '2px 6px', borderRadius: 4 }}>src/pages/Login.jsx</code> and set <code style={{ background: 'rgba(255,255,255,.1)', padding: '2px 6px', borderRadius: 4 }}>DEMO_VIDEO_URL</code> at the top of the file to your YouTube, Google Drive, or Vimeo embed link.
              </div>
            </div>
          ) : (
            <iframe
              src={DEMO_VIDEO_URL}
              title="SchoolMS Training Video"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        {/* Bottom CTA */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
          paddingTop: 4,
        }}>
          <Link
            to="/trial"
            onClick={onClose}
            style={{
              background: '#E94560', color: '#fff', padding: '10px 24px',
              borderRadius: 8, fontWeight: 700, fontSize: '.9rem',
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            🎁 Start Free Trial
          </Link>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              color: '#fff', padding: '10px 24px', borderRadius: 8,
              fontWeight: 600, fontSize: '.9rem', cursor: 'pointer',
            }}
          >
            Sign In Instead
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FEATURE TOUR MODAL ───────────────────────────────────────────
function TourModal({ onClose }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isLast  = step === TOUR_STEPS.length - 1;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          width: '100%', maxWidth: 560,
          overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.4)',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 4, background: '#f0f0f0' }}>
          <div style={{
            height: '100%', background: current.color,
            width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
            transition: 'width .3s ease',
          }} />
        </div>

        {/* Step counter */}
        <div style={{
          padding: '16px 24px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                  background: i === step ? current.color : i < step ? '#ccc' : '#eee',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all .25s',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '.78rem', color: '#aaa' }}>
            {step + 1} of {TOUR_STEPS.length}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 28px 28px' }}>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: current.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', flexShrink: 0,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: current.color }}>
                {current.title}
              </div>
              <div style={{ fontSize: '.75rem', color: '#999', marginTop: 2 }}>
                {current.screen}
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{
            fontSize: '.9rem', color: '#555', lineHeight: 1.65,
            marginBottom: 16, margin: '0 0 16px',
          }}>
            {current.desc}
          </p>

          {/* Bullet points */}
          <div style={{
            background: '#f8f9fa', borderRadius: 12,
            padding: '14px 16px', marginBottom: 20,
            borderLeft: `4px solid ${current.color}`,
          }}>
            {current.points.map((point, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontSize: '.84rem', color: '#444', lineHeight: 1.5,
                marginBottom: i < current.points.length - 1 ? 8 : 0,
              }}>
                <span style={{ color: current.color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
              style={{
                background: '#f5f5f5', border: 'none', borderRadius: 8,
                padding: '10px 20px', cursor: 'pointer',
                fontWeight: 600, fontSize: '.85rem', color: '#666',
              }}
            >
              {step === 0 ? '✕ Close' : '← Back'}
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              {isLast ? (
                <>
                  <button
                    onClick={onClose}
                    style={{
                      background: '#f5f5f5', border: 'none', borderRadius: 8,
                      padding: '10px 18px', cursor: 'pointer',
                      fontWeight: 600, fontSize: '.85rem', color: '#666',
                    }}
                  >
                    Sign In
                  </button>
                  <Link
                    to="/trial"
                    onClick={onClose}
                    style={{
                      background: current.color, color: '#fff',
                      padding: '10px 20px', borderRadius: 8,
                      fontWeight: 700, fontSize: '.85rem',
                      textDecoration: 'none', display: 'inline-block',
                    }}
                  >
                    🎁 Start Free Trial →
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => setStep(s => s + 1)}
                  style={{
                    background: current.color, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '.85rem',
                  }}
                >
                  Next: {TOUR_STEPS[step + 1].title} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN LOGIN PAGE ──────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form,         setForm]        = useState({ email: '', password: '' });
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(false);
  const [showPass,     setShowPass]    = useState(false);
  const [resetMode,    setResetMode]   = useState(false);
  const [resetEmail,   setResetEmail]  = useState('');
  const [resetSent,    setResetSent]   = useState(false);
  const [resetLoading, setResetLoading]= useState(false);
  const [resetError,   setResetError]  = useState('');

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
        'auth/user-not-found':        'No account found with this email.',
        'auth/wrong-password':        'Incorrect password. Please try again.',
        'auth/invalid-credential':    'Incorrect email or password.',
        'auth/too-many-requests':     'Too many attempts. Try again in a few minutes.',
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
        'auth/user-not-found':        'No account found with this email address.',
        'auth/invalid-email':         'Please enter a valid email address.',
        'auth/network-request-failed':'No internet. Check your connection.',
      };
      setResetError(msg[err.code] || 'Failed to send reset email. Try again.');
    } finally { setResetLoading(false); }
  }

  return (
    <>
      <div className="auth-page">
        {/* ══════════════════════════════════════════════════════
            LEFT PANEL
        ══════════════════════════════════════════════════════ */}
        <div className="auth-left">
          {/* Brand */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,.1)', borderRadius: 12,
            padding: '8px 16px', marginBottom: 24,
          }}>
            <span style={{ fontSize: '1.3rem' }}>🏫</span>
            <span style={{ fontSize: '.85rem', fontWeight: 700, letterSpacing: '.04em' }}>SchoolMS Ghana</span>
          </div>

          <h1>Manage Your School Records Professionally</h1>
          <p style={{ marginTop: 10, opacity: .85, lineHeight: 1.6 }}>
            Built for Ghanaian schools — score entry, report cards, promotion, analytics and more.
            Works on any phone or computer, even without internet.
          </p>

          {/* ── TRAINING BUTTON ── */}
          <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              to="/training"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#E94560', borderRadius: 10,
                padding: '12px 22px', color: '#fff',
                fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(233,69,96,.4)',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>🎓</span>
              Watch Training Videos
            </Link>
          </div>

          {/* ── FEATURE LIST ── */}
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              ['👥', 'Student records & enrolment history'],
              ['✏️', 'Score entry with auto grade calculation'],
              ['📄', 'Professional PDF report cards with logo'],
              ['🚀', 'Year-end promotion with audit trail'],
              ['📊', 'Performance analytics & charts'],
              ['📱', 'Works offline — no internet required'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.84rem', opacity: .85 }}>
                <span style={{ fontSize: '1rem', width: 26, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* ── HOW IT WORKS ── */}
          <div style={{
            marginTop: 28,
            background: 'rgba(255,255,255,.07)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontSize: '.74rem', fontWeight: 700, opacity: .5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              How to get started
            </div>
            {[
              ['1', 'Request your free 21-day trial below'],
              ['2', 'Our team approves within a few hours'],
              ['3', 'Log in and set up your school in minutes'],
            ].map(([n, text]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: '.82rem' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#E94560', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '.72rem', flexShrink: 0, marginTop: 1,
                }}>
                  {n}
                </span>
                <span style={{ opacity: .85, lineHeight: 1.45 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* ── PRICING ── */}
          <div style={{
            marginTop: 16,
            background: 'rgba(255,255,255,.08)',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '.7rem', opacity: .55, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Starting from</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                GHS 150<span style={{ fontSize: '.88rem', fontWeight: 400, opacity: .65 }}>/month</span>
              </div>
              <div style={{ fontSize: '.76rem', opacity: .55, marginTop: 2 }}>or GHS 525 per term — save every term</div>
            </div>
            <Link
              to="/pricing"
              style={{
                background: 'rgba(255,255,255,.15)',
                border: '1px solid rgba(255,255,255,.25)',
                color: '#fff', borderRadius: 8,
                padding: '8px 14px', textDecoration: 'none',
                fontSize: '.78rem', fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              View Plans →
            </Link>
          </div>

          {/* ── USER GUIDE DOWNLOAD ── */}
          <div style={{
            marginTop: 16,
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, opacity: .5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              📖 User Guide
            </div>
            <div style={{ fontSize: '.82rem', opacity: .8, marginBottom: 12, lineHeight: 1.55 }}>
              Download the full SchoolMS usage manual — covers every feature with step-by-step instructions.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href="/SchoolMS_Full_Manual.pdf"
                download="SchoolMS_Usage_Manual.pdf"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,.15)',
                  border: '1px solid rgba(255,255,255,.25)',
                  borderRadius: 8, padding: '8px 14px',
                  color: '#fff', textDecoration: 'none',
                  fontWeight: 700, fontSize: '.8rem',
                }}
              >
                <span>📄</span> Download PDF
              </a>
              <a
                href="/SchoolMS_Full_Manual.docx"
                download="SchoolMS_Usage_Manual.docx"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.15)',
                  borderRadius: 8, padding: '8px 14px',
                  color: 'rgba(255,255,255,.75)', textDecoration: 'none',
                  fontWeight: 600, fontSize: '.8rem',
                }}
              >
                <span>📝</span> Word (.docx)
              </a>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            RIGHT PANEL — LOGIN FORM
        ══════════════════════════════════════════════════════ */}
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
                <p className="sub">Enter your email and we'll send a reset link.</p>
              </div>

              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
                  <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Reset link sent!</h3>
                  <p style={{ color: 'var(--text-mid)', fontSize: '.88rem', marginBottom: 20, lineHeight: 1.6 }}>
                    Check your email at <strong>{resetEmail}</strong>.
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
                  {resetError && <div className="alert alert-danger"><span>⚠️</span> {resetError}</div>}
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

              {/* ── QUICK DEMO LINK (mobile-friendly) ── */}
              <div style={{
                marginTop: 20, padding: '14px 16px',
                background: 'linear-gradient(135deg, #0F3460, #1a4a7a)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '.85rem' }}>First time here?</div>
                  <div style={{ color: '#90CAF9', fontSize: '.78rem', marginTop: 2 }}>See how it works before signing up</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to="/training"
                    style={{
                      background: '#E94560', color: '#fff',
                      borderRadius: 8, padding: '8px 16px',
                      fontWeight: 700, fontSize: '.78rem',
                      textDecoration: 'none', display: 'inline-block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🎓 Watch Videos
                  </Link>
                </div>
              </div>

              {/* ── SIGN UP LINKS ── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' }}>
                <div style={{ fontSize: '.82rem', color: 'var(--navy)', fontWeight: 700 }}>
                  New school?{' '}
                  <Link to="/trial" style={{ color: '#E94560' }}>Start your free 21-day trial →</Link>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>
                  Have an access code?{' '}
                  <Link to="/register" style={{ color: 'var(--text-mid)' }}>Register your school</Link>
                </div>
              </div>

              {/* ── LEGAL LINKS ── */}
              <div style={{
                marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
                display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
              }}>
                {[
                  ['/legal/privacy',       'Privacy Policy'],
                  ['/legal/terms',         'Terms'],
                  ['/legal/subscription',  'Subscription'],
                  ['/legal/data-retention','Data Retention'],
                  ['/legal/data-security', 'Security'],
                ].map(([to, label]) => (
                  <Link key={to} to={to} style={{ fontSize: '.7rem', color: 'var(--text-lt)', textDecoration: 'none' }}>
                    {label}
                  </Link>
                ))}
              </div>

              {/* ── GUIDE DOWNLOAD (right panel — visible on mobile) ── */}
              <div style={{
                marginTop: 14, paddingTop: 14,
                borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '.75rem', color: 'var(--text-lt)' }}>📖 User Guide:</span>
                <a
                  href="/SchoolMS_Full_Manual.pdf"
                  download="SchoolMS_Usage_Manual.pdf"
                  style={{ fontSize: '.75rem', color: 'var(--navy)', fontWeight: 700, textDecoration: 'none' }}
                >
                  ⬇ PDF
                </a>
                <span style={{ color: '#ddd', fontSize: '.7rem' }}>|</span>
                <a
                  href="/SchoolMS_Full_Manual.docx"
                  download="SchoolMS_Usage_Manual.docx"
                  style={{ fontSize: '.75rem', color: 'var(--navy)', fontWeight: 700, textDecoration: 'none' }}
                >
                  ⬇ Word
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
