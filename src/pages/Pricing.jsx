// src/pages/Pricing.jsx
//
// Standalone pricing page — accessible without login at /pricing.
// Addresses school concerns about cost, explains value clearly,
// and offers both monthly and termly billing options.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, getPlanPrice, getTermlySaving, BACKUP_ADDON_PRICE, BACKUP_ADDON_TERMLY_PRICE } from '../services/subscriptionService';

const WHATSAPP = 'https://wa.me/233549548274';

// ── WHAT EACH PLAN INCLUDES — human-readable feature rows ─────────
const FEATURE_ROWS = [
  { label: 'Student records',              starter: true,  pro: true,  premium: true  },
  { label: 'Classes & subjects',           starter: true,  pro: true,  premium: true  },
  { label: 'Score entry (admin + teacher)',starter: true,  pro: true,  premium: true  },
  { label: 'Professional PDF report cards',starter: true,  pro: true,  premium: true  },
  { label: 'School logo on reports',       starter: true,  pro: true,  premium: true  },
  { label: 'Teacher login accounts',       starter: true,  pro: true,  premium: true  },
  { label: 'End-of-year promotion wizard', starter: true,  pro: true,  premium: true  },
  { label: 'Works offline (no internet)',  starter: true,  pro: true,  premium: true  },
  { label: 'Assessment deadlines',         starter: true,  pro: true,  premium: true  },
  { label: 'Import students from Excel',   starter: true,  pro: true,  premium: true  },
  { label: 'Number of students',           starter: 'Up to 200', pro: 'Unlimited', premium: 'Unlimited' },
  { label: 'Performance analytics & charts', starter: false, pro: true, premium: true },
  { label: 'Data backup & restore',        starter: false, pro: 'Add-on', premium: '✓ Included' },
  { label: 'Priority WhatsApp support',    starter: false, pro: false, premium: true  },
];

function Check({ val }) {
  if (val === true)   return <span style={{ color: '#27AE60', fontWeight: 800, fontSize: '1rem' }}>✓</span>;
  if (val === false)  return <span style={{ color: '#ddd', fontSize: '1rem' }}>—</span>;
  return <span style={{ fontSize: '.78rem', color: '#555', fontWeight: 600 }}>{val}</span>;
}

// ── PLAN CARD ─────────────────────────────────────────────────────
function PlanCard({ plan, cycle }) {
  if (plan.id === 'trial') return null;
  const price      = getPlanPrice(plan.id, cycle);
  const saving     = getTermlySaving(plan.id);
  const cycleLabel = cycle === 'termly' ? 'per term' : 'per month';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      border: plan.highlight ? `2.5px solid ${plan.color}` : '1.5px solid #e8ecf0',
      padding: '28px 24px',
      position: 'relative',
      boxShadow: plan.highlight
        ? `0 8px 40px ${plan.color}25`
        : '0 2px 12px rgba(0,0,0,.06)',
      flex: '1 1 240px',
      maxWidth: 300,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {plan.highlight && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          background: plan.color, color: '#fff',
          padding: '4px 18px', borderRadius: 20,
          fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em',
          whiteSpace: 'nowrap',
        }}>
          ⭐ MOST POPULAR
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'inline-block', background: `${plan.color}15`,
          color: plan.color, fontWeight: 800, fontSize: '.78rem',
          padding: '4px 12px', borderRadius: 20, marginBottom: 10,
          letterSpacing: '.04em',
        }}>
          {plan.badge}
        </div>
        <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#1a1a2e', marginBottom: 4 }}>
          {plan.name}
        </div>
        <div style={{ fontSize: '.8rem', color: '#888', lineHeight: 1.5 }}>
          {plan.bestFor}
        </div>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: '.9rem', fontWeight: 700, color: '#888', marginBottom: 6 }}>GHS</span>
          <span style={{ fontSize: '2.6rem', fontWeight: 900, color: plan.color, lineHeight: 1 }}>
            {price.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: '.78rem', color: '#aaa', marginTop: 4 }}>
          {cycleLabel}
          {cycle === 'monthly' && (
            <span style={{ color: '#888' }}> · billed monthly</span>
          )}
        </div>
        {cycle === 'termly' && saving > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#e8f5e9', color: '#2e7d32',
            fontSize: '.74rem', fontWeight: 700,
            padding: '3px 10px', borderRadius: 20, marginTop: 8,
          }}>
            🎉 Save GHS {saving} vs monthly
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{ flex: 1, margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {FEATURE_ROWS.map(row => {
          const val = row[plan.id];
          if (val === false) return null;
          return (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.82rem', color: '#444' }}>
              <Check val={val} />
              <span>{row.label}</span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <a
        href={`${WHATSAPP}?text=${encodeURIComponent(`Hello, I am interested in the SchoolMS ${plan.name} plan (${cycle === 'termly' ? 'GHS ' + price + ' per term' : 'GHS ' + price + '/month'}). Please guide me on how to get started.`)}`}
        target="_blank" rel="noreferrer"
        style={{
          display: 'block', textAlign: 'center',
          background: plan.highlight ? plan.color : '#fff',
          color: plan.highlight ? '#fff' : plan.color,
          border: `2px solid ${plan.color}`,
          borderRadius: 10, padding: '12px',
          fontWeight: 800, fontSize: '.88rem',
          textDecoration: 'none', marginTop: 8,
          transition: 'all .15s',
        }}
      >
        Get Started →
      </a>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Pricing() {
  const [cycle, setCycle] = useState('termly'); // default to termly — most schools prefer it

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fc', fontFamily: 'Arial, sans-serif' }}>

      {/* ── NAVBAR ── */}
      <div style={{
        background: '#0F3460', padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,.6)', fontSize: '.82rem', textDecoration: 'none' }}>← Back</Link>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)' }} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '.95rem' }}>🏫 SchoolMS Pricing</span>
        </div>
        <Link to="/trial" style={{ background: '#E94560', color: '#fff', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: '.82rem', textDecoration: 'none' }}>
          Start Free Trial
        </Link>
      </div>

      {/* ── HERO ── */}
      <div style={{ background: 'linear-gradient(135deg, #0F3460, #1a4a7a)', color: '#fff', padding: '52px 24px 60px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#90CAF9', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Simple, Honest Pricing
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.2 }}>
            Less than the cost of one ream of paper — every month
          </h1>
          <p style={{ opacity: .8, fontSize: '.95rem', lineHeight: 1.8, margin: '0 0 10px' }}>
            Think about what your school spends on printed report cards, registers, and stationery every term.
            SchoolMS costs less — and saves your teachers hours of manual work every single week.
          </p>
          <p style={{ opacity: .65, fontSize: '.85rem', lineHeight: 1.6 }}>
            No hidden fees. No setup costs. No long contracts. Cancel any time.
          </p>
        </div>
      </div>

      {/* ── BILLING TOGGLE ── */}
      <div style={{ textAlign: 'center', padding: '32px 24px 0' }}>
        <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 50, padding: 4, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1.5px solid #e8ecf0' }}>
          {[
            { id: 'monthly', label: 'Pay Monthly', sub: 'Flexible' },
            { id: 'termly',  label: 'Pay Per Term', sub: 'Save every term 🎉' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setCycle(opt.id)}
              style={{
                padding: '10px 28px', borderRadius: 46, border: 'none',
                background: cycle === opt.id ? '#0F3460' : 'transparent',
                color: cycle === opt.id ? '#fff' : '#888',
                cursor: 'pointer', transition: 'all .2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '.88rem' }}>{opt.label}</span>
              <span style={{ fontSize: '.7rem', opacity: cycle === opt.id ? .8 : .6 }}>{opt.sub}</span>
            </button>
          ))}
        </div>

        {cycle === 'termly' && (
          <div style={{ marginTop: 12, fontSize: '.82rem', color: '#27AE60', fontWeight: 700 }}>
            🎉 Termly pricing = 3.5 months for the price of 4 — you save every term automatically
          </div>
        )}
        {cycle === 'monthly' && (
          <div style={{ marginTop: 12, fontSize: '.82rem', color: '#888' }}>
            Switch to Per Term to save money — most schools choose termly
          </div>
        )}
      </div>

      {/* ── PLAN CARDS ── */}
      <div style={{ maxWidth: 1040, margin: '32px auto 0', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.values(PLANS).map(plan => (
            <PlanCard key={plan.id} plan={plan} cycle={cycle} />
          ))}
        </div>
      </div>

      {/* ── TERMLY SAVING CALLOUT ── */}
      {cycle === 'termly' && (
        <div style={{ maxWidth: 760, margin: '28px auto 0', padding: '0 16px' }}>
          <div style={{
            background: '#e8f5e9', border: '1.5px solid #a5d6a7',
            borderRadius: 14, padding: '18px 22px',
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🎓</span>
            <div>
              <div style={{ fontWeight: 800, color: '#2e7d32', marginBottom: 4 }}>
                Why termly makes more sense for schools
              </div>
              <div style={{ fontSize: '.85rem', color: '#388e3c', lineHeight: 1.7 }}>
                Schools in Ghana operate on a <strong>termly budget</strong> — not a monthly salary cycle. 
                Your PTA meetings, feeding fees, and staff allowances all come in term by term. 
                Paying for SchoolMS once per term means one payment, one budget line, no monthly hassle. 
                And you save money doing it.
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                {['starter','pro','premium'].map(id => {
                  const plan = PLANS[id];
                  const saving = getTermlySaving(id);
                  return (
                    <div key={id} style={{ fontSize: '.8rem', color: '#2e7d32' }}>
                      <strong>{plan.name}:</strong> Save <strong>GHS {saving}</strong> per term
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VALUE COMPARISON ── */}
      <div style={{ maxWidth: 760, margin: '40px auto 0', padding: '0 16px' }}>
        <h2 style={{ textAlign: 'center', color: '#1a1a2e', marginBottom: 6, fontSize: '1.3rem' }}>
          What does GHS 150/month actually mean?
        </h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: '.88rem', marginBottom: 24 }}>
          Let us put the cost in perspective for your school
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: '📄', label: 'Printing 200 report cards', cost: 'GHS 200–400', schoolms: 'GHS 150', better: true },
            { icon: '📒', label: 'A set of school registers', cost: 'GHS 80–150', schoolms: 'Included', better: true },
            { icon: '☕', label: '1 cup of tea per day for a month', cost: 'GHS 90–150', schoolms: 'Same price', better: false },
            { icon: '✏️', label: 'Teacher marking time saved', cost: 'Hours/week', schoolms: 'Free with SchoolMS', better: true },
          ].map(item => (
            <div key={item.label} style={{
              background: '#fff', borderRadius: 14,
              border: '1.5px solid #e8ecf0',
              padding: '18px 18px', flex: '1 1 160px', maxWidth: 200,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: '.78rem', color: '#555', marginBottom: 8, lineHeight: 1.4 }}>{item.label}</div>
              <div style={{ fontSize: '.72rem', color: '#aaa', marginBottom: 4 }}>Typical cost: {item.cost}</div>
              <div style={{
                fontSize: '.78rem', fontWeight: 700,
                color: item.better ? '#27AE60' : '#0F3460',
                background: item.better ? '#e8f5e9' : '#e3f2fd',
                padding: '4px 10px', borderRadius: 20, display: 'inline-block',
              }}>
                SchoolMS: {item.schoolms}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONCERNS ADDRESSED ── */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <h2 style={{ textAlign: 'center', color: '#1a1a2e', marginBottom: 6, fontSize: '1.3rem' }}>
          Questions schools ask before subscribing
        </h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: '.88rem', marginBottom: 28 }}>
          Honest answers — no sales talk
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              q: 'Why do I have to keep paying? I thought software is a one-time purchase.',
              a: 'SchoolMS stores all your data securely in the cloud, sends you updates automatically, and our team is available to support you every time you need help. That ongoing service is what the subscription covers. The moment you stop paying, your data stays safe — it is never deleted. You just cannot add new records until you renew.',
            },
            {
              q: 'What if we cannot pay for one term? Do we lose everything?',
              a: 'No. Your data is always safe. If your subscription lapses, the system moves to read-only — you can still view all results, print old report cards, and see student records. Nothing is deleted. When you renew, everything continues exactly where you left off.',
            },
            {
              q: 'Is it really worth it for a small school?',
              a: 'Ask yourself: how many hours does your staff spend manually calculating grades, writing report cards, and maintaining registers every term? SchoolMS turns that into minutes. For a school with 100 students, that alone saves 10–20 hours of teacher time per term — time that goes back to actual teaching.',
            },
            {
              q: 'What if we do not have internet every day?',
              a: 'SchoolMS works offline. You can enter scores, view students, and use all features without internet. When you go online — even briefly on mobile data — everything syncs automatically. No data is ever lost.',
            },
            {
              q: 'Can we start with the cheapest plan and upgrade later?',
              a: 'Yes. Many schools start on Starter and upgrade to Pro when they want analytics. You never lose data when you upgrade. Contact us on WhatsApp and we handle the change immediately.',
            },
            {
              q: 'Do you charge extra for training or setup?',
              a: 'Never. Training videos, the user guide, WhatsApp support, and setup help are all included in every plan at no extra cost. You also get a free 21-day trial to learn the system before spending a single pesewa.',
            },
          ].map((item, i) => (
            <details key={i} style={{
              background: '#fff', borderRadius: 12,
              border: '1.5px solid #e8ecf0',
              overflow: 'hidden',
            }}>
              <summary style={{
                padding: '16px 20px', fontWeight: 700, fontSize: '.88rem',
                color: '#1a1a2e', cursor: 'pointer', listStyle: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{item.q}</span>
                <span style={{ color: '#0F3460', fontSize: '1.1rem', flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{
                padding: '0 20px 18px', fontSize: '.85rem',
                color: '#555', lineHeight: 1.75,
                borderTop: '1px solid #f0f0f0', paddingTop: 14,
              }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── FREE TRIAL BANNER ── */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0F3460, #1a4a7a)',
          borderRadius: 20, padding: '36px 28px', textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎁</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 10px' }}>
            Start completely free — no card needed
          </h2>
          <p style={{ opacity: .8, fontSize: '.9rem', lineHeight: 1.7, margin: '0 0 24px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Your free 21-day trial gives full access to everything. Set up your classes, enter real scores,
            print real report cards — before you pay anything. If you love it, choose a plan. If not, walk away with no charge.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/trial" style={{ background: '#E94560', color: '#fff', padding: '14px 32px', borderRadius: 10, fontWeight: 800, fontSize: '.95rem', textDecoration: 'none' }}>
              Start Free Trial →
            </Link>
            <a
              href={`${WHATSAPP}?text=${encodeURIComponent('Hello, I have a question about SchoolMS pricing.')}`}
              target="_blank" rel="noreferrer"
              style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '14px 24px', borderRadius: 10, fontWeight: 600, fontSize: '.95rem', textDecoration: 'none' }}
            >
              📱 Ask on WhatsApp
            </a>
          </div>
          <div style={{ marginTop: 20, opacity: .55, fontSize: '.78rem' }}>
            ✓ No credit card &nbsp;·&nbsp; ✓ No auto-charge &nbsp;·&nbsp; ✓ Data never deleted &nbsp;·&nbsp; ✓ Cancel any time
          </div>
        </div>
      </div>

      {/* ── COMPARISON TABLE ── */}
      <div style={{ maxWidth: 900, margin: '48px auto 0', padding: '0 16px' }}>
        <h2 style={{ textAlign: 'center', color: '#1a1a2e', marginBottom: 24, fontSize: '1.3rem' }}>
          Full feature comparison
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <thead>
              <tr style={{ background: '#0F3460' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#fff', fontSize: '.82rem', fontWeight: 700, width: '40%' }}>Feature</th>
                {['starter','pro','premium'].map(id => (
                  <th key={id} style={{ padding: '14px 10px', textAlign: 'center', color: '#fff', fontSize: '.82rem', fontWeight: 700 }}>
                    <div>{PLANS[id].name}</div>
                    <div style={{ fontWeight: 400, opacity: .7, fontSize: '.72rem', marginTop: 2 }}>
                      GHS {cycle === 'termly' ? PLANS[id].termlyPrice + '/term' : PLANS[id].price + '/mo'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.label} style={{ background: i % 2 === 0 ? '#f8f9fb' : '#fff' }}>
                  <td style={{ padding: '11px 16px', fontSize: '.82rem', color: '#444' }}>{row.label}</td>
                  {['starter','pro','premium'].map(id => (
                    <td key={id} style={{ padding: '11px 10px', textAlign: 'center' }}>
                      <Check val={row[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', padding: '48px 24px 40px', color: '#aaa', fontSize: '.8rem' }}>
        <div style={{ marginBottom: 8, fontWeight: 700, color: '#666' }}>SchoolMS — Built for Ghana's Schools</div>
        <div>📱 WhatsApp: 0549548274 &nbsp;·&nbsp; ✉ schoolpilot132@gmail.com</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" style={{ color: '#aaa', textDecoration: 'none' }}>Sign In</Link>
          <Link to="/trial" style={{ color: '#aaa', textDecoration: 'none' }}>Free Trial</Link>
          <Link to="/training" style={{ color: '#aaa', textDecoration: 'none' }}>Training Videos</Link>
          <Link to="/legal/terms" style={{ color: '#aaa', textDecoration: 'none' }}>Terms</Link>
          <Link to="/legal/privacy" style={{ color: '#aaa', textDecoration: 'none' }}>Privacy</Link>
        </div>
      </div>
    </div>
  );
}
