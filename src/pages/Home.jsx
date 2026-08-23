// src/pages/Home.jsx
//
// Public landing page — shown to anyone NOT signed in, at "/". Previously
// there was no dedicated home page at all: every unmatched route (and
// even "/" itself) redirected straight to the login form, meaning a
// prospective school never saw what Schpilot actually does or why they'd
// want it before being asked to log in. This is that missing page.

import React from 'react';
import { Link } from 'react-router-dom';
import { CountUp, SITE_STATS } from '../components/common/PricingCalculator';

function Section({ children, style }) {
  return <section style={{ padding: '48px 20px', ...style }}>{children}</section>;
}

export default function Home() {
  return (
    <div style={{ background: '#f7f9fc', minHeight: '100vh' }}>

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: '#0F3460',
      }}>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.15rem' }}>Schpilot</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/login" style={{
            padding: '8px 16px', borderRadius: 8, color: '#fff', fontWeight: 700,
            fontSize: '.85rem', textDecoration: 'none', border: '1.5px solid rgba(255,255,255,.3)',
          }}>
            Log In
          </Link>
        </div>
      </div>

      {/* ── HERO — THE PROBLEM ──────────────────────────────────── */}
      <Section style={{ background: '#0F3460', paddingTop: 40, paddingBottom: 56, textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', background: 'rgba(255,255,255,.1)', color: '#ffd54f',
            padding: '6px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700, marginBottom: 18,
          }}>
            Built for Ghanaian schools
          </div>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, lineHeight: 1.25, marginBottom: 16 }}>
            Report cards shouldn't take your teachers a whole weekend.
          </h1>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '1rem', lineHeight: 1.6, marginBottom: 28 }}>
            Most schools still calculate scores, positions, and aggregates by hand — hours of work
            every term, with room for mistakes that end up on a parent's report card. Schpilot does
            all of it automatically, works without steady internet, and never loses a record.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/trial" style={{
              padding: '14px 28px', borderRadius: 12, background: '#E94560', color: '#fff',
              fontWeight: 800, fontSize: '.95rem', textDecoration: 'none',
            }}>
              Start Free 21-Day Trial →
            </Link>
            <Link to="/pricing" style={{
              padding: '14px 28px', borderRadius: 12, border: '2px solid rgba(255,255,255,.35)',
              color: '#fff', fontWeight: 700, fontSize: '.95rem', textDecoration: 'none',
            }}>
              See Pricing
            </Link>
          </div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '.78rem', marginTop: 14 }}>
            No card required · No obligation to continue
          </div>
        </div>
      </Section>

      {/* ── STATS ────────────────────────────────────────────────── */}
      <div style={{ background: '#0a2647', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {SITE_STATS.map(({ target, suffix, label }, i) => (
          <div key={label} style={{
            flex: '1 1 140px', textAlign: 'center', padding: '18px 12px',
            borderRight: i < SITE_STATS.length - 1 ? '1px solid rgba(255,255,255,.1)' : 'none',
          }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
              <CountUp target={target} suffix={suffix} />
            </div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── THE OLD WAY vs SCHPILOT ─────────────────────────────── */}
      <Section>
        <h2 style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 900, color: '#0F3460', marginBottom: 8 }}>
          What changes for your school
        </h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: '.9rem', marginBottom: 32 }}>
          Same assessment process your school already knows — just without the manual work and the risk.
        </p>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ flex: '1 1 300px', background: '#fff', border: '1.5px solid #fce4e4', borderRadius: 16, padding: '22px 20px' }}>
            <div style={{ fontWeight: 800, color: '#c62828', marginBottom: 12, fontSize: '.9rem' }}>😩 Without Schpilot</div>
            {[
              'Teachers calculate totals, grades, and positions by hand',
              'One typo in a spreadsheet formula throws off a whole class',
              'Report cards take a weekend to prepare, every single term',
              'A lost or damaged exercise book means lost records',
              'Headteachers only find out about problems after report day',
            ].map(t => (
              <div key={t} style={{ display: 'flex', gap: 8, fontSize: '.84rem', color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
                <span>✗</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: '1 1 300px', background: '#fff', border: '1.5px solid #d4edda', borderRadius: 16, padding: '22px 20px' }}>
            <div style={{ fontWeight: 800, color: '#2e7d32', marginBottom: 12, fontSize: '.9rem' }}>✅ With Schpilot</div>
            {[
              'Totals, grades, positions, and aggregates calculated instantly',
              'Automatic calculations — no formula errors, no manual re-checking',
              'Clean PDF report cards generated in minutes, not days',
              'Records stored safely — never lost to a damaged book or a bad term',
              'Works offline, syncs when you\'re back online — no fighting bad network',
            ].map(t => (
              <div key={t} style={{ display: 'flex', gap: 8, fontSize: '.84rem', color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
                <span>✓</span><span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── WHAT IT'S FOR ────────────────────────────────────────── */}
      <Section style={{ background: '#fff' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 900, color: '#0F3460', marginBottom: 32 }}>
          One system, from score entry to report card
        </h2>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {[
            { icon: '👥', title: 'Students & Classes',   text: 'Manage your whole roster, classes, and subjects in one place.' },
            { icon: '✏️', title: 'Score Entry',          text: 'Teachers enter scores per subject — SBA/class assessment and exam weighting handled automatically.' },
            { icon: '📊', title: 'Automatic Calculations', text: 'Totals, grades, aggregates, and class positions computed correctly, every time.' },
            { icon: '📄', title: 'Report Cards',          text: 'Professional PDF report cards ready to print or share, in minutes.' },
            { icon: '🚀', title: 'Promotion',             text: 'End-of-year promotion handled with a guided wizard, not a spreadsheet.' },
            { icon: '📴', title: 'Works Offline',         text: 'Keep working through unreliable network — everything syncs once you\'re back online.' },
          ].map(f => (
            <div key={f.title} style={{ textAlign: 'center', padding: '18px 14px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, color: '#0F3460', fontSize: '.92rem', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: '.8rem', color: '#777', lineHeight: 1.5 }}>{f.text}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── TRUST ────────────────────────────────────────────────── */}
      <Section>
        <div style={{
          maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 16,
          border: '1.5px solid #e8ecf0', padding: '28px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>🔒</div>
          <div style={{ fontWeight: 800, color: '#0F3460', fontSize: '1rem', marginBottom: 8 }}>
            Your records are always safe
          </div>
          <p style={{ fontSize: '.86rem', color: '#666', lineHeight: 1.6, marginBottom: 0 }}>
            Data is never deleted for non-payment — at worst, an expired plan goes read-only until
            renewed. Pay once per academic term, with no automatic renewal, and pay by MTN MoMo,
            Telecel Cash, or AirtelTigo Money — no card required.
          </p>
        </div>
      </Section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <Section style={{ textAlign: 'center', paddingBottom: 60 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F3460', marginBottom: 10 }}>
          Try it free for 21 days
        </h2>
        <p style={{ color: '#777', fontSize: '.88rem', marginBottom: 20 }}>
          No card on file. Cancel any time. Nothing is ever charged automatically.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/trial" style={{
            padding: '14px 28px', borderRadius: 12, background: '#0F3460', color: '#fff',
            fontWeight: 800, fontSize: '.95rem', textDecoration: 'none',
          }}>
            Start Free Trial →
          </Link>
          <Link to="/login" style={{
            padding: '14px 28px', borderRadius: 12, border: '2px solid #0F3460',
            color: '#0F3460', fontWeight: 700, fontSize: '.95rem', textDecoration: 'none',
          }}>
            Already a customer? Log In
          </Link>
        </div>
      </Section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #e8ecf0', padding: '20px', textAlign: 'center', fontSize: '.76rem', color: '#999' }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <Link to="/pricing" style={{ color: '#999', textDecoration: 'none' }}>Pricing</Link>
          <Link to="/legal/privacy" style={{ color: '#999', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/legal/terms" style={{ color: '#999', textDecoration: 'none' }}>Terms</Link>
          <Link to="/legal/subscription" style={{ color: '#999', textDecoration: 'none' }}>Subscription Policy</Link>
          <Link to="/request-access" style={{ color: '#999', textDecoration: 'none' }}>Request Access</Link>
        </div>
        © {new Date().getFullYear()} Schpilot. Built for Ghanaian schools.
      </div>
    </div>
  );
}
