// src/pages/Home.jsx
//
// Public landing page — shown to anyone NOT signed in, at "/".
//
// DESIGN NOTE: deliberately built around the report card itself — the
// actual artifact this software produces — rather than generic SaaS
// hero/card/stats template blocks. Palette: ink navy + brass + cool
// paper (not the cream+terracotta combination that reads as an AI
// default). Type: Fraunces (display, has real weight and character —
// evokes a printed certificate) paired with Inter (body/UI, matches the
// rest of the app) and IBM Plex Mono for anything numeric, so scores
// and stats read like data, not decoration.

import React from 'react';
import { Link } from 'react-router-dom';

const T = {
  navy:    '#0B1E3D',
  navy2:   '#132A4D',
  paper:   '#F4F6F9',
  line:    '#DCE3EC',
  brass:   '#C9A227',
  slate:   '#5B6B85',
  red:     '#B23A48',
  green:   '#2F7D5A',
};

const display = { fontFamily: "'Fraunces', Georgia, serif" };
const mono    = { fontFamily: "'IBM Plex Mono', monospace" };

// ── THE REPORT CARD — the product itself, as the hero image ────────
function ReportCardMockup() {
  const rows = [
    { subject: 'Mathematics',        cls: 28, exam: 62, total: 90, grade: 'A1', pos: '1st' },
    { subject: 'English Language',   cls: 24, exam: 58, total: 82, grade: 'B2', pos: '3rd' },
    { subject: 'Integrated Science', cls: 27, exam: 60, total: 87, grade: 'A1', pos: '2nd' },
    { subject: 'Social Studies',     cls: 22, exam: 55, total: 77, grade: 'B3', pos: '5th' },
  ];
  return (
    <div style={{
      transform: 'rotate(-2.5deg)', background: '#fff', borderRadius: 6,
      boxShadow: '0 30px 60px -20px rgba(11,30,61,.45), 0 4px 12px rgba(11,30,61,.15)',
      width: '100%', maxWidth: 380, padding: '22px 20px 18px', position: 'relative',
    }}>
      {/* brass seal */}
      <div style={{
        position: 'absolute', top: -14, right: 18, width: 46, height: 46, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, #E4C255, ${T.brass})`,
        border: '2px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: 'rotate(8deg)',
      }}>
        <span style={{ color: T.navy, fontSize: '.62rem', fontWeight: 800, letterSpacing: '.03em', textAlign: 'center', lineHeight: 1.1 }}>
          APPROVED<br/>✓
        </span>
      </div>

      <div style={{ borderBottom: `2px solid ${T.navy}`, paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ ...display, fontSize: '.72rem', fontWeight: 700, color: T.navy, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          Adom Preparatory School
        </div>
        <div style={{ fontSize: '.66rem', color: T.slate, marginTop: 2 }}>
          Terminal Report — JHS 2A · 2025/2026 Term 2
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.62rem' }}>
        <thead>
          <tr style={{ color: T.slate, textAlign: 'left' }}>
            <th style={{ paddingBottom: 4, fontWeight: 600 }}>Subject</th>
            <th style={{ paddingBottom: 4, fontWeight: 600, textAlign: 'right' }}>CA</th>
            <th style={{ paddingBottom: 4, fontWeight: 600, textAlign: 'right' }}>Exam</th>
            <th style={{ paddingBottom: 4, fontWeight: 600, textAlign: 'right' }}>Total</th>
            <th style={{ paddingBottom: 4, fontWeight: 600, textAlign: 'right' }}>Grd</th>
            <th style={{ paddingBottom: 4, fontWeight: 600, textAlign: 'right' }}>Pos</th>
          </tr>
        </thead>
        <tbody style={mono}>
          {rows.map(r => (
            <tr key={r.subject} style={{ borderTop: `1px solid ${T.line}` }}>
              <td style={{ padding: '4px 0', fontFamily: 'Inter, sans-serif', fontSize: '.63rem', color: '#1a1a2e' }}>{r.subject}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: T.slate }}>{r.cls}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: T.slate }}>{r.exam}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, color: T.navy }}>{r.total}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: T.green, fontWeight: 700 }}>{r.grade}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: T.slate }}>{r.pos}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <span style={{ fontSize: '.6rem', color: T.slate }}>Aggregate</span>
        <span style={{ ...mono, fontSize: '.78rem', fontWeight: 700, color: T.navy }}>9</span>
      </div>
      <div style={{ fontSize: '.58rem', color: T.slate, marginTop: 6, fontStyle: 'italic' }}>
        "A consistent and encouraging term. Keep it up." — Class Teacher
      </div>
    </div>
  );
}

function Section({ children, style, id }) {
  return <section id={id} style={{ padding: '56px 20px', ...style }}>{children}</section>;
}

// Ledger-style stat row — data laid out like an actual register line,
// not glossy dashboard cards.
function LedgerStats() {
  const stats = [
    { n: '47+',    l: 'Schools in Ghana' },
    { n: '8,400+', l: 'Students managed' },
    { n: '3 hrs',  l: 'Saved per teacher, per term' },
    { n: '21 days', l: 'Free trial, no card' },
  ];
  return (
    <div style={{
      maxWidth: 860, margin: '0 auto', border: `1px solid ${T.line}`, borderRadius: 4,
      overflow: 'hidden', background: '#fff',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {stats.map((s, i) => (
          <div key={s.l} style={{
            flex: '1 1 180px', padding: '20px 22px',
            borderRight: i < stats.length - 1 ? `1px solid ${T.line}` : 'none',
            borderBottom: `1px solid ${T.line}`,
          }}>
            <div style={{ ...mono, fontSize: '1.5rem', fontWeight: 500, color: T.navy }}>{s.n}</div>
            <div style={{ fontSize: '.76rem', color: T.slate, marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The pipeline, shown as a register strip with real UI fragments per
// stage rather than icon+caption cards.
function Pipeline() {
  const stages = [
    {
      label: 'Enter', title: 'Teachers record scores',
      body: 'Class assessment and exam scores, weighted the way your school already grades.',
      swatch: (
        <div style={{ ...mono, fontSize: '.68rem', color: T.navy, background: T.paper, borderRadius: 4, padding: '8px 10px', border: `1px solid ${T.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.slate }}>Kwame A.</span><span>28 / 30</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}><span style={{ color: T.slate }}>Ama B.</span><span>24 / 30</span></div>
        </div>
      ),
    },
    {
      label: 'Calculate', title: 'Totals, grades, positions',
      body: 'Aggregates and class rank computed the moment scores are in — never by hand.',
      swatch: (
        <div style={{ ...mono, fontSize: '.68rem', color: T.green, background: T.paper, borderRadius: 4, padding: '8px 10px', border: `1px solid ${T.line}`, textAlign: 'center' }}>
          90 → A1 · 1st
        </div>
      ),
    },
    {
      label: 'Approve', title: 'Headteacher reviews',
      body: 'Submitted, checked, and locked — teachers can\'t edit results after approval.',
      swatch: (
        <div style={{ fontSize: '.68rem', color: T.navy, background: T.paper, borderRadius: 4, padding: '8px 10px', border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: T.green, fontWeight: 700 }}>✓</span> Approved &amp; locked
        </div>
      ),
    },
    {
      label: 'Publish', title: 'Report cards, ready',
      body: 'Clean PDF report cards in minutes — print, share, or hand out on report day.',
      swatch: (
        <div style={{ fontSize: '.68rem', color: T.navy, background: T.paper, borderRadius: 4, padding: '8px 10px', border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          📄 report_JHS2A_term2.pdf
        </div>
      ),
    },
  ];
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 0, border: `1px solid ${T.line}`, borderRadius: 4, overflow: 'hidden', background: '#fff' }}>
      {stages.map((s, i) => (
        <div key={s.label} style={{ padding: '22px 20px', borderLeft: i > 0 ? `1px solid ${T.line}` : 'none' }}>
          <div style={{ ...mono, fontSize: '.64rem', color: T.brass, fontWeight: 500, letterSpacing: '.08em', marginBottom: 6 }}>
            {String(i + 1).padStart(2, '0')} — {s.label.toUpperCase()}
          </div>
          <div style={{ ...display, fontSize: '1rem', fontWeight: 600, color: T.navy, marginBottom: 6 }}>{s.title}</div>
          <div style={{ fontSize: '.8rem', color: T.slate, lineHeight: 1.5, marginBottom: 12 }}>{s.body}</div>
          {s.swatch}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div style={{ background: T.paper, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 24px', background: T.navy,
      }}>
        <div style={{ ...display, color: '#fff', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-.01em' }}>
          Schpilot
        </div>
        <Link to="/login" style={{
          padding: '8px 18px', borderRadius: 3, color: T.navy, fontWeight: 600,
          fontSize: '.82rem', textDecoration: 'none', background: T.brass,
        }}>
          Log In
        </Link>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <Section style={{ background: T.navy, paddingTop: 56, paddingBottom: 64 }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', display: 'flex', gap: 48,
          alignItems: 'center', flexWrap: 'wrap-reverse', justifyContent: 'center',
        }}>
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <div style={{ ...mono, color: T.brass, fontSize: '.7rem', letterSpacing: '.1em', marginBottom: 14 }}>
              ASSESSMENT SOFTWARE FOR GHANAIAN SCHOOLS
            </div>
            <h1 style={{ ...display, color: '#fff', fontSize: '2.3rem', fontWeight: 600, lineHeight: 1.18, marginBottom: 18, letterSpacing: '-.01em' }}>
              Every score, calculated correctly. Every report card, on time.
            </h1>
            <p style={{ color: 'rgba(255,255,255,.72)', fontSize: '1rem', lineHeight: 1.65, marginBottom: 30, maxWidth: 460 }}>
              Schpilot replaces the hand-calculated mark sheet — SBA weighting, exam scores,
              aggregates, and class positions computed the moment a teacher enters a score.
              Works without steady internet. Nothing is ever lost.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/trial" style={{
                padding: '13px 26px', borderRadius: 3, background: T.brass, color: T.navy,
                fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
              }}>
                Start Free 21-Day Trial
              </Link>
              <Link to="/pricing" style={{
                padding: '13px 26px', borderRadius: 3, border: '1px solid rgba(255,255,255,.3)',
                color: '#fff', fontWeight: 600, fontSize: '.88rem', textDecoration: 'none',
              }}>
                See Pricing
              </Link>
            </div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: '.75rem', marginTop: 16 }}>
              No card required · Nothing charged automatically
            </div>
          </div>

          <div style={{ flex: '0 1 380px', minWidth: 280, display: 'flex', justifyContent: 'center' }}>
            <ReportCardMockup />
          </div>
        </div>
      </Section>

      {/* ── LEDGER STATS ─────────────────────────────────────────── */}
      <Section>
        <LedgerStats />
      </Section>

      {/* ── PIPELINE ─────────────────────────────────────────────── */}
      <Section style={{ paddingTop: 8 }}>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ ...display, fontSize: '1.5rem', fontWeight: 600, color: T.navy, marginBottom: 8 }}>
            From score to report card, in four steps
          </h2>
          <p style={{ color: T.slate, fontSize: '.9rem' }}>
            The same process your school already follows — just without the manual arithmetic and the risk of a lost mark sheet.
          </p>
        </div>
        <Pipeline />
      </Section>

      {/* ── TRUST ────────────────────────────────────────────────── */}
      <Section>
        <div style={{
          maxWidth: 700, margin: '0 auto', background: T.navy, borderRadius: 4,
          padding: '32px 30px', display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ ...display, fontSize: '2.2rem', color: T.brass, lineHeight: 1 }}>&ldquo;</div>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ color: '#fff', fontSize: '.95rem', lineHeight: 1.6, marginBottom: 14 }}>
              Your records are never deleted for non-payment. At worst, an expired plan goes
              read-only until renewed — everything already entered stays exactly where you left it.
            </div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '.78rem' }}>
              Pay once per academic term, no automatic renewal · MTN MoMo, Telecel Cash, AirtelTigo Money
            </div>
          </div>
        </div>
      </Section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <Section style={{ textAlign: 'center', paddingBottom: 68 }}>
        <h2 style={{ ...display, fontSize: '1.4rem', fontWeight: 600, color: T.navy, marginBottom: 10 }}>
          Try it free for 21 days
        </h2>
        <p style={{ color: T.slate, fontSize: '.88rem', marginBottom: 22 }}>
          No card on file. Cancel any time. Nothing is ever charged automatically.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/trial" style={{
            padding: '13px 28px', borderRadius: 3, background: T.navy, color: '#fff',
            fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
          }}>
            Start Free Trial
          </Link>
          <Link to="/login" style={{
            padding: '13px 28px', borderRadius: 3, border: `1px solid ${T.navy}`,
            color: T.navy, fontWeight: 600, fontSize: '.88rem', textDecoration: 'none',
          }}>
            Already a customer? Log In
          </Link>
        </div>
      </Section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${T.line}`, padding: '22px 20px', textAlign: 'center', fontSize: '.76rem', color: T.slate }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <Link to="/pricing" style={{ color: T.slate, textDecoration: 'none' }}>Pricing</Link>
          <Link to="/legal/privacy" style={{ color: T.slate, textDecoration: 'none' }}>Privacy</Link>
          <Link to="/legal/terms" style={{ color: T.slate, textDecoration: 'none' }}>Terms</Link>
          <Link to="/legal/subscription" style={{ color: T.slate, textDecoration: 'none' }}>Subscription Policy</Link>
          <Link to="/request-access" style={{ color: T.slate, textDecoration: 'none' }}>Request Access</Link>
        </div>
        © {new Date().getFullYear()} Schpilot. Built for Ghanaian schools.
      </div>
    </div>
  );
}
