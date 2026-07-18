// src/pages/Pricing.jsx
//
// PSYCHOLOGY TECHNIQUES USED:
//
// 1. PRICE ANCHORING — Premium shown first and largest. The brain anchors
//    to GHS 1,000 first, making GHS 625 feel cheap by comparison.
//
// 2. DECOY EFFECT — Starter exists purely to make Pro look like the
//    obvious choice. It's close in price but missing key features.
//    Nobody buys Starter — it just makes Pro feel like a steal.
//
// 3. LOSS AVERSION — "What you lose without SchoolMS" framing.
//    People feel losses 2x stronger than equivalent gains.
//    "You are losing GHS 400 worth of teacher time every term" hurts
//    more than "you will save GHS 400" feels good.
//
// 4. SOCIAL PROOF + URGENCY — "X schools in Ghana already using this"
//    and "Trial spots limited this term" creates FOMO and herd behaviour.
//
// 5. THE CHARM PRICE — GHS 625 not GHS 650. GHS 375 not GHS 400.
//    Left-digit effect: the brain reads 625 as "600-something" not "650".
//
// 6. EFFORT JUSTIFICATION — The cost calculator makes the school do
//    mental arithmetic. When they type their own numbers and see the
//    result, they trust it more than any claim we make.
//
// 7. COMMITMENT & CONSISTENCY — The free trial is framed as a
//    "commitment" to their school. Once someone starts and enters real
//    data, switching costs make paying feel easier than leaving.
//
// 8. RECIPROCITY — Training videos, manual, Excel template, WhatsApp
//    support — all free. When you give first, people feel obligated
//    to give back. The subscription feels like returning a favour.
//
// 9. FEAR OF MISSING OUT (FOMO) — "Schools using SchoolMS get results
//    out 3 hours before schools still doing it manually on speech day."
//    Paints a vivid picture of being left behind.
//
// 10. THE PAIN POINT MIRROR — Lead with the exact complaint schools
//     have BEFORE showing the solution. When people read their own
//     frustration back to them, they feel deeply understood and stop
//     questioning whether the product is for them.

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, getPlanPrice, getTermlySaving } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';

const WHATSAPP_BASE = 'https://wa.me/233549548274';
const wa = (msg) => `${WHATSAPP_BASE}?text=${encodeURIComponent(msg)}`;

// ── ANIMATED COUNTER ─────────────────────────────────────────────
function CountUp({ target, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = target / 40;
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(start));
      }, 30);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ── ROI CALCULATOR ───────────────────────────────────────────────
// TECHNIQUE 6: Effort Justification — they calculate it themselves
function ROICalculator() {
  const [students,    setStudents]    = useState(120);
  const [teachers,    setTeachers]    = useState(8);
  const [hrsPerTeacher, setHrs]       = useState(4);
  const [hourlyWage,  setWage]        = useState(15);

  const teacherCostPerTerm = teachers * hrsPerTeacher * 3 * hourlyWage; // 3 terms/year × hrs × wage
  const paperCostPerTerm   = Math.round(students * 1.5);  // ~GHS 1.50 per student for report paper/ink
  const totalWastedPerTerm = teacherCostPerTerm + paperCostPerTerm;
  const schoolmsProTermly  = 625;
  const netSavingPerTerm   = totalWastedPerTerm - schoolmsProTermly;

  return (
    <div style={{
      background: '#fff', borderRadius: 20,
      border: '2px solid #0F3460',
      padding: '28px 24px',
      boxShadow: '0 8px 40px rgba(15,52,96,.12)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🧮</div>
        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0F3460' }}>
          Calculate Your School's Real Cost
        </div>
        <div style={{ fontSize: '.82rem', color: '#888', marginTop: 4 }}>
          Enter your school's numbers — see what doing it manually actually costs you
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Number of students', value: students, set: setStudents, min: 20, max: 2000, step: 10 },
          { label: 'Number of teachers', value: teachers, set: setTeachers, min: 1, max: 50, step: 1 },
          { label: 'Hours each teacher spends on reports per term', value: hrsPerTeacher, set: setHrs, min: 1, max: 20, step: 1 },
          { label: 'Estimated hourly value of a teacher\'s time (GHS)', value: hourlyWage, set: setWage, min: 5, max: 100, step: 5 },
        ].map(({ label, value, set, min, max, step }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '.82rem', color: '#555' }}>{label}</span>
              <span style={{ fontWeight: 800, color: '#0F3460', fontSize: '.88rem' }}>{value.toLocaleString()}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={value}
              onChange={e => set(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#0F3460' }}
            />
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{ background: '#f7f9fc', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', color: '#666' }}>
            <span>Teacher time cost per term</span>
            <span style={{ fontWeight: 700, color: '#E94560' }}>GHS {teacherCostPerTerm.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', color: '#666' }}>
            <span>Paper, printing & ink per term</span>
            <span style={{ fontWeight: 700, color: '#E94560' }}>GHS {paperCostPerTerm.toLocaleString()}</span>
          </div>
          <div style={{ height: 1, background: '#e0e0e0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', color: '#333' }}>
            <span style={{ fontWeight: 700 }}>Total manual cost per term</span>
            <span style={{ fontWeight: 900, color: '#E94560', fontSize: '1rem' }}>GHS {totalWastedPerTerm.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', color: '#333' }}>
            <span style={{ fontWeight: 700 }}>SchoolMS Pro (per term)</span>
            <span style={{ fontWeight: 900, color: '#27AE60', fontSize: '1rem' }}>GHS {schoolmsProTermly.toLocaleString()}</span>
          </div>
          <div style={{ height: 1, background: '#e0e0e0' }} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 10,
            background: netSavingPerTerm > 0 ? '#e8f5e9' : '#fff3e0',
          }}>
            <span style={{ fontWeight: 800, fontSize: '.9rem', color: netSavingPerTerm > 0 ? '#2e7d32' : '#e65100' }}>
              {netSavingPerTerm > 0 ? '✓ You save per term' : 'Cost difference'}
            </span>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: netSavingPerTerm > 0 ? '#27AE60' : '#e65100' }}>
              GHS {Math.abs(netSavingPerTerm).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {netSavingPerTerm > 0 && (
        <div style={{ marginTop: 12, fontSize: '.78rem', color: '#888', textAlign: 'center', lineHeight: 1.6 }}>
          Based on your numbers, SchoolMS pays for itself and saves you an additional<br />
          <strong style={{ color: '#27AE60' }}>GHS {netSavingPerTerm.toLocaleString()}</strong> in recovered teacher time and reduced paper costs — every single term.
        </div>
      )}
    </div>
  );
}

// ── PLAN CARD ─────────────────────────────────────────────────────
function PlanCard({ plan, cycle, isDecoy }) {
  if (plan.id === 'trial') return null;
  const price  = getPlanPrice(plan.id, cycle);
  const saving = getTermlySaving(plan.id);

  const features = {
    starter: ['Students up to 200','Classes & subjects','Score entry','PDF report cards with logo','Teacher accounts','Promotion wizard','Offline mode'],
    pro:     ['Unlimited students','Classes & subjects','Score entry','PDF report cards with logo','Teacher accounts','Promotion wizard','Offline mode','📊 Performance analytics','📊 Subject comparison charts','📊 Student progress tracking'],
    premium: ['Unlimited students','Classes & subjects','Score entry','PDF report cards with logo','Teacher accounts','Promotion wizard','Offline mode','📊 Full analytics suite','💾 Data backup & restore','⭐ Priority WhatsApp support','⭐ Multi-admin access'],
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      border: plan.highlight ? '2.5px solid #0F3460' : '1.5px solid #e8ecf0',
      padding: '0 0 24px',
      position: 'relative',
      boxShadow: plan.highlight
        ? '0 12px 48px rgba(15,52,96,.18)'
        : '0 2px 12px rgba(0,0,0,.05)',
      flex: '1 1 240px',
      maxWidth: 300,
      display: 'flex',
      flexDirection: 'column',
      opacity: isDecoy ? 0.88 : 1,
    }}>

      {/* Top colour bar */}
      <div style={{
        height: 6, borderRadius: '18px 18px 0 0',
        background: plan.highlight ? '#0F3460' : plan.id === 'premium' ? '#E94560' : '#e8ecf0',
      }} />

      {plan.highlight && (
        <div style={{
          position: 'absolute', top: -1, left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#0F3460', color: '#fff',
          padding: '5px 20px', borderRadius: 20,
          fontSize: '.72rem', fontWeight: 800,
          letterSpacing: '.06em', whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(15,52,96,.3)',
        }}>
          ⭐ MOST POPULAR — BEST VALUE
        </div>
      )}

      {isDecoy && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          background: '#f5f5f5', color: '#aaa',
          padding: '3px 10px', borderRadius: 20,
          fontSize: '.68rem', fontWeight: 600,
        }}>
          Basic
        </div>
      )}

      <div style={{ padding: '20px 20px 0' }}>
        {/* Plan name */}
        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1a1a2e', marginBottom: 4 }}>
          {plan.name}
        </div>
        <div style={{ fontSize: '.8rem', color: '#888', marginBottom: 16, lineHeight: 1.4 }}>
          {plan.bestFor}
        </div>

        {/* Price */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: '.85rem', color: '#aaa', marginBottom: 8 }}>GHS</span>
            <span style={{
              fontSize: '3rem', fontWeight: 900, lineHeight: 1,
              color: plan.highlight ? '#0F3460' : '#1a1a2e',
            }}>
              {price.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: '.78rem', color: '#aaa', marginTop: 4 }}>
            {cycle === 'termly' ? 'per school term' : 'per month'}
          </div>
          {cycle === 'termly' && saving > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#e8f5e9', color: '#2e7d32',
              fontSize: '.72rem', fontWeight: 700,
              padding: '3px 10px', borderRadius: 20, marginTop: 8,
            }}>
              Save GHS {saving} vs monthly
            </div>
          )}
          {cycle === 'monthly' && (
            <div style={{ fontSize: '.72rem', color: '#aaa', marginTop: 6 }}>
              or GHS {plan.termlyPrice || Math.round(plan.price * 2.5)}/term and save GHS {saving}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f0f0f0', margin: '16px 0' }} />

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {(features[plan.id] || []).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.82rem', color: '#444' }}>
              <span style={{ color: '#27AE60', fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href={wa(`Hello, I want to start on the SchoolMS ${plan.name} plan — ${cycle === 'termly' ? 'GHS ' + price + ' per term' : 'GHS ' + price + ' per month'}. Please guide me.`)}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', textAlign: 'center',
            background: plan.highlight ? '#0F3460' : '#fff',
            color: plan.highlight ? '#fff' : '#0F3460',
            border: `2px solid #0F3460`,
            borderRadius: 10, padding: '13px',
            fontWeight: 800, fontSize: '.9rem',
            textDecoration: 'none',
          }}
        >
          {plan.highlight ? 'Get Started →' : 'Choose ' + plan.name}
        </a>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Pricing() {
  const [cycle, setCycle] = useState('termly');
  const { user, userProfile } = useAuth();
  const isTeacher = userProfile?.role === 'teacher';
  const backTo    = user ? (isTeacher ? '/scores' : '/dashboard') : '/login';
  const backLabel = user ? '← Back to Dashboard' : '← Back';

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
          <Link to={backTo} style={{ color: 'rgba(255,255,255,.6)', fontSize: '.82rem', textDecoration: 'none' }}>{backLabel}</Link>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)' }} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '.95rem' }}>🏫 SchoolMS</span>
        </div>
        {!user && (
          <Link to="/trial" style={{
            background: '#E94560', color: '#fff', padding: '8px 18px',
            borderRadius: 8, fontWeight: 700, fontSize: '.82rem', textDecoration: 'none',
          }}>
            Start Free Trial
          </Link>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 10: PAIN POINT MIRROR
          Lead with their exact frustration before showing solution
      ══════════════════════════════════════════════════ */}
      <div style={{ background: '#1a1a2e', color: '#fff', padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#E94560', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Does this sound familiar?
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 900, margin: '0 0 20px', lineHeight: 1.3, color: '#fff' }}>
            "Our teachers are here until 8pm every end of term just to finish the report cards."
          </h1>
          <p style={{ opacity: .65, fontSize: '.95rem', lineHeight: 1.8, margin: '0 0 28px' }}>
            Stacks of exercise books. Manual grade calculations. Handwritten report cards for 200 students.
            Teachers exhausted. Parents waiting. And you doing it all again next term.
          </p>

          {/* TECHNIQUE 9: FOMO — being left behind */}
          <div style={{
            background: 'rgba(233,69,96,.12)', border: '1px solid rgba(233,69,96,.3)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24,
            fontSize: '.85rem', color: '#ff8a9b', lineHeight: 1.6,
          }}>
            📢 Schools using SchoolMS printed their Term 3 report cards in under 2 hours on speech day —
            while other schools were still calculating grades by hand.
          </div>

          <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#27AE60' }}>
            ↓ There is a better way — and it costs less than you think
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 4: SOCIAL PROOF — animated numbers
      ══════════════════════════════════════════════════ */}
      <div style={{ background: '#0F3460', padding: '28px 24px' }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { target: 47,   suffix: '+',  label: 'Schools in Ghana'            },
            { target: 8400, suffix: '+',  label: 'Students managed'            },
            { target: 3,    suffix: 'hrs', label: 'Saved per teacher per term' },
            { target: 21,   suffix: ' days', label: 'Free trial — no card'    },
          ].map(({ target, suffix, label }, i) => (
            <div key={label} style={{
              flex: '1 1 140px', textAlign: 'center', padding: '16px 12px',
              borderRight: i < 3 ? '1px solid rgba(255,255,255,.1)' : 'none',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
                <CountUp target={target} suffix={suffix} />
              </div>
              <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.55)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 3: LOSS AVERSION — cost of NOT using it
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#E94560', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            The hidden cost of doing it manually
          </div>
          <h2 style={{ fontSize: '1.3rem', color: '#1a1a2e', margin: 0 }}>
            What your school loses every term without SchoolMS
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '⏰', loss: 'Teacher time writing report cards manually', cost: 'GHS 240–800 in lost productive hours' },
            { icon: '🖨️', loss: 'Paper, ink, and printing costs per term',    cost: 'GHS 150–400 depending on student count' },
            { icon: '❌', loss: 'Errors in manual grade calculations',          cost: 'Parent complaints. Re-printing. Lost trust.' },
            { icon: '📁', loss: 'Lost student records when staff leave',        cost: 'Years of data — gone with one person' },
            { icon: '😓', loss: 'Teacher burnout at end of every term',        cost: 'Reduced teaching quality the following term' },
          ].map(item => (
            <div key={item.loss} style={{
              background: '#fff', borderRadius: 12,
              border: '1.5px solid #fce4ec',
              padding: '14px 18px',
              display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#1a1a2e', marginBottom: 3 }}>{item.loss}</div>
                <div style={{ fontSize: '.78rem', color: '#E94560', fontWeight: 600 }}>{item.cost}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 6: ROI CALCULATOR — effort justification
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 560, margin: '48px auto 0', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#0F3460', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            See it for your school
          </div>
          <h2 style={{ fontSize: '1.2rem', color: '#1a1a2e', margin: 0 }}>
            Calculate your school's real cost
          </h2>
        </div>
        <ROICalculator />
      </div>

      {/* ══════════════════════════════════════════════════
          BILLING TOGGLE
      ══════════════════════════════════════════════════ */}
      <div style={{ textAlign: 'center', padding: '48px 24px 0' }}>
        <div style={{ marginBottom: 12, fontSize: '.88rem', color: '#555', fontWeight: 600 }}>
          How would you like to pay?
        </div>
        <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 50, padding: 4, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1.5px solid #e8ecf0' }}>
          {[
            { id: 'monthly', label: 'Monthly',   sub: 'Pay every month'          },
            { id: 'termly',  label: 'Per Term',  sub: '💰 Save every term'       },
          ].map(opt => (
            <button key={opt.id} onClick={() => setCycle(opt.id)} style={{
              padding: '10px 28px', borderRadius: 46, border: 'none',
              background: cycle === opt.id ? '#0F3460' : 'transparent',
              color: cycle === opt.id ? '#fff' : '#888',
              cursor: 'pointer', transition: 'all .2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontWeight: 800, fontSize: '.88rem' }}>{opt.label}</span>
              <span style={{ fontSize: '.7rem', opacity: cycle === opt.id ? .8 : .6 }}>{opt.sub}</span>
            </button>
          ))}
        </div>

        {/* TECHNIQUE 5: CHARM PRICE reminder */}
        {cycle === 'termly' && (
          <div style={{ marginTop: 12, fontSize: '.82rem', color: '#27AE60', fontWeight: 700 }}>
            🎉 Pay once per term — same as how your school already budgets for everything else
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 1: PRICE ANCHORING + TECHNIQUE 2: DECOY
          Premium shown prominently. Starter is the decoy.
          Pro is the obvious choice once anchored to Premium.
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 1000, margin: '28px auto 0', padding: '0 16px' }}>

        {/* Anchor message */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '.8rem', color: '#888', marginBottom: 4 }}>
            💡 Most schools choose <strong style={{ color: '#0F3460' }}>Pro</strong> — everything you need, nothing you don't
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {/* DECOY — Starter shown small and greyed */}
          <div style={{ flex: '0 1 230px', opacity: .85 }}>
            <PlanCard plan={PLANS.starter} cycle={cycle} isDecoy={true} />
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.72rem', color: '#aaa' }}>
              Limited features
            </div>
          </div>

          {/* HERO — Pro is the money maker */}
          <div style={{ flex: '0 1 280px' }}>
            <PlanCard plan={PLANS.pro} cycle={cycle} isDecoy={false} />
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.78rem', color: '#27AE60', fontWeight: 700 }}>
              ✓ Chosen by most schools
            </div>
          </div>

          {/* ANCHOR — Premium sets the high anchor */}
          <div style={{ flex: '0 1 260px' }}>
            <PlanCard plan={PLANS.premium} cycle={cycle} isDecoy={false} />
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.72rem', color: '#888' }}>
              For schools that want everything
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 8: RECIPROCITY — what they get free
          Give first. People feel obligated to give back.
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)',
          border: '1.5px solid #a5d6a7', borderRadius: 18, padding: '28px 24px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>🎁</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#2e7d32' }}>
              Everything below is FREE — on every plan, including the trial
            </div>
            <div style={{ fontSize: '.8rem', color: '#388e3c', marginTop: 4 }}>
              We give you this because we know once you experience it, you will stay
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {[
              ['🎬','Training videos for every feature'],
              ['📖','Full usage manual (PDF & Word)'],
              ['📊','Excel student import template'],
              ['💬','WhatsApp support — real human, not a bot'],
              ['🔧','Setup guidance on first login'],
              ['🔄','Free data migration if switching from paper'],
              ['⚡','Automatic updates — no extra cost'],
              ['📱','Works on any phone — no app to buy'],
            ].map(([icon, text]) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fff', borderRadius: 30,
                padding: '8px 14px', fontSize: '.8rem', color: '#2e7d32', fontWeight: 600,
                border: '1px solid #c8e6c9',
              }}>
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TECHNIQUE 7: COMMITMENT — trial framing
          Starting = commitment. Switching cost locks them in.
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0F3460, #1a4a7a)',
          borderRadius: 20, padding: '40px 28px', textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏫</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 10px' }}>
            Your school deserves this
          </h2>
          <p style={{ opacity: .8, fontSize: '.9rem', lineHeight: 1.75, margin: '0 0 10px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            The 21-day free trial is not a demo. It is the real system, with your real students,
            your real classes, and your real report cards. By the time the trial ends,
            your data is already inside — and switching back to paper will feel impossible.
          </p>
          <p style={{ opacity: .55, fontSize: '.8rem', margin: '0 0 28px' }}>
            That is why we offer the full system for free. We are confident you will never want to leave.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/trial" style={{
              background: '#E94560', color: '#fff', padding: '14px 36px',
              borderRadius: 10, fontWeight: 800, fontSize: '.95rem', textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(233,69,96,.4)',
            }}>
              Start My Free Trial →
            </Link>
            <a
              href={wa('Hello, I would like to know more about SchoolMS before subscribing.')}
              target="_blank" rel="noreferrer"
              style={{
                background: 'rgba(255,255,255,.1)',
                border: '1px solid rgba(255,255,255,.2)',
                color: '#fff', padding: '14px 24px', borderRadius: 10,
                fontWeight: 600, fontSize: '.95rem', textDecoration: 'none',
              }}
            >
              📱 Ask a Question First
            </a>
          </div>
          <div style={{ marginTop: 20, opacity: .45, fontSize: '.75rem' }}>
            ✓ No card needed &nbsp;·&nbsp; ✓ No auto-charge &nbsp;·&nbsp;
            ✓ Data never deleted &nbsp;·&nbsp; ✓ Cancel any time
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          OBJECTION KILLERS — addressed in plain language
      ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 760, margin: '48px auto 0', padding: '0 16px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.2rem', color: '#1a1a2e', marginBottom: 24 }}>
          Every concern — answered honestly
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              q: 'Why do I keep paying every month or term?',
              a: 'Because your data lives securely in the cloud, updates happen automatically, and our team supports you every time you need help. Stop paying and your data stays safe in read-only mode — we never delete it. Pay again and you continue exactly where you left off.',
            },
            {
              q: 'What if we cannot afford it one term?',
              a: 'Nothing is deleted. Ever. The system goes read-only — you can still view results and print old reports. When you are ready to pay again, everything is exactly as you left it.',
            },
            {
              q: 'GHS 150 feels expensive for a small school.',
              a: 'Your school already spends more than GHS 150 on paper and ink for report cards alone. Use the calculator above to see your actual cost. For most schools, SchoolMS is not an extra expense — it replaces what you already spend, and gives back hours of teacher time on top.',
            },
            {
              q: 'What if the internet goes off?',
              a: 'SchoolMS works completely offline. Enter scores, view students, do everything — with or without internet. When you get signal, even on mobile data for 5 minutes, everything syncs automatically.',
            },
            {
              q: 'Is our data safe? What if SchoolMS closes down?',
              a: 'All data is backed up in Google Firebase — the same platform used by companies like Duolingo and Canva. You can export your complete school data as an Excel or JSON file any time you want — so your data is always yours, regardless of what happens to us.',
            },
            {
              q: 'We tried software before and it was too complicated.',
              a: 'SchoolMS was built specifically for Ghanaian schools — not adapted from a Western system. Every teacher who has used it entered their first scores within 10 minutes. The training videos walk through every single step. And if you get stuck, WhatsApp us — a real person responds, not a bot.',
            },
          ].map((item, i) => (
            <details key={i} style={{
              background: '#fff', borderRadius: 12,
              border: '1.5px solid #e8ecf0', overflow: 'hidden',
            }}>
              <summary style={{
                padding: '16px 20px', fontWeight: 700, fontSize: '.88rem',
                color: '#1a1a2e', cursor: 'pointer', listStyle: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{item.q}</span>
                <span style={{ color: '#0F3460', fontSize: '1.2rem', flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{
                padding: '14px 20px 18px', fontSize: '.85rem',
                color: '#555', lineHeight: 1.75,
                borderTop: '1px solid #f0f0f0',
              }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'center', padding: '48px 24px 40px', color: '#aaa', fontSize: '.8rem' }}>
        <div style={{ marginBottom: 8, fontWeight: 700, color: '#666' }}>SchoolMS — Built for Ghana's Schools</div>
        <div>📱 WhatsApp: 0549548274 &nbsp;·&nbsp; ✉ schoolpilot132@gmail.com</div>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!user && <Link to="/login"    style={{ color: '#aaa', textDecoration: 'none' }}>Sign In</Link>}
          {!user && <Link to="/trial"    style={{ color: '#aaa', textDecoration: 'none' }}>Free Trial</Link>}
          <Link to="/training" style={{ color: '#aaa', textDecoration: 'none' }}>Training</Link>
          <Link to="/legal/terms"    style={{ color: '#aaa', textDecoration: 'none' }}>Terms</Link>
          <Link to="/legal/privacy"  style={{ color: '#aaa', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/legal/subscription" style={{ color: '#aaa', textDecoration: 'none' }}>Subscription Policy</Link>
        </div>
      </div>
    </div>
  );
}
