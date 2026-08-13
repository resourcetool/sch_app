// src/components/common/PricingCalculator.jsx
//
// Shared between src/pages/Pricing.jsx and src/pages/legal/SubscriptionPolicy.jsx
// so both surfaces always show the same numbers. Previously Pricing.jsx had its
// own private ROICalculator with a HARDCODED "GHS 625" Pro-termly price baked
// in — if the plan price ever changed in subscriptionService.js, that number
// would silently go stale here while the rest of the app updated. Pulling it
// from getPlanPrice() instead means every consumer updates automatically the
// moment the real config changes.

import React, { useState } from 'react';
import { PLANS, BILLING_CYCLES, getPlanPrice, getTermlySaving } from '../../services/subscriptionService';

// ── BILLING CYCLE TOGGLE (radio-button style) ───────────────────────
// Renders one button per entry in BILLING_CYCLES — currently Monthly,
// Per Term, Annual. Because it loops over the config object instead of a
// hardcoded array, adding/removing a cycle in subscriptionService.js is
// automatically reflected here with no further code changes needed.
export function BillingCycleToggle({ cycle, setCycle }) {
  const subLabel = {
    monthly: 'Pay every month',
    termly:  '💰 Save every term',
    annual:  '💰💰 Biggest saving',
  };
  return (
    <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 50, padding: 4, boxShadow: '0 2px 12px rgba(0,0,0,.08)', border: '1.5px solid #e8ecf0', flexWrap: 'wrap', justifyContent: 'center' }}>
      {Object.values(BILLING_CYCLES).map(c => (
        <button
          key={c.id} type="button" onClick={() => setCycle(c.id)}
          style={{
            padding: '10px 22px', borderRadius: 46, border: 'none',
            background: cycle === c.id ? '#0F3460' : 'transparent',
            color: cycle === c.id ? '#fff' : '#888',
            cursor: 'pointer', transition: 'all .2s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
        >
          <span style={{ fontWeight: 800, fontSize: '.86rem' }}>{c.label}</span>
          <span style={{ fontSize: '.68rem', opacity: cycle === c.id ? .8 : .6 }}>
            {subLabel[c.id] || c.saving || ''}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── LIVE PLAN PRICE TABLE ───────────────────────────────────────────
// Compact table that recalculates instantly as the cycle toggle changes.
// Used on the Subscription Policy page so admins can compare costs
// without leaving the legal page to hunt through the marketing Pricing page.
export function LivePlanPriceTable({ cycle }) {
  const periodLabel = { monthly: '/month', termly: '/term', annual: '/year' }[cycle] || '';
  const paidPlans = ['starter', 'pro', 'premium'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
        <thead>
          <tr style={{ background: '#0f3460', color: '#fff' }}>
            {['Plan', `Price${periodLabel}`, 'Students', 'Analytics', 'Backup'].map(h => (
              <th key={h} style={{ padding: '9px 12px', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paidPlans.map((planId, i) => {
            const plan  = PLANS[planId];
            const price = getPlanPrice(planId, cycle);
            const saving = cycle !== 'monthly' ? getTermlySaving(planId) : 0;
            return (
              <tr key={planId} style={{ background: i % 2 === 0 ? '#f8f9ff' : '#fff' }}>
                <td style={{ padding: '9px 12px', fontWeight: 700 }}>{plan.name}</td>
                <td style={{ padding: '9px 12px' }}>
                  GHS {price.toLocaleString()}
                  {cycle === 'termly' && saving > 0 && (
                    <span style={{ color: '#27AE60', fontSize: '.76rem', marginLeft: 6 }}>
                      (save GHS {saving})
                    </span>
                  )}
                </td>
                <td style={{ padding: '9px 12px' }}>{plan.maxStudents >= 99999 ? 'Unlimited' : `Up to ${plan.maxStudents}`}</td>
                <td style={{ padding: '9px 12px' }}>{plan.features.analytics ? '✓' : '✕'}</td>
                <td style={{ padding: '9px 12px' }}>{plan.features.backup ? '✓' : '✕'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ROI CALCULATOR ───────────────────────────────────────────────
// TECHNIQUE: Effort Justification — they calculate it themselves.
// Compares Pro termly pricing (the recommended default) against the
// estimated manual cost of teacher time + paper/ink. Pulls the Pro
// termly price from the live plan config rather than a hardcoded number.
export function ROICalculator() {
  const [students,      setStudents]  = useState(120);
  const [teachers,      setTeachers]  = useState(8);
  const [hrsPerTeacher, setHrs]       = useState(4);
  const [hourlyWage,    setWage]      = useState(15);

  const teacherCostPerTerm = teachers * hrsPerTeacher * 3 * hourlyWage; // 3 terms/year × hrs × wage
  const paperCostPerTerm   = Math.round(students * 1.5);  // ~GHS 1.50 per student for report paper/ink
  const totalWastedPerTerm = teacherCostPerTerm + paperCostPerTerm;
  const schoolmsProTermly  = getPlanPrice('pro', 'termly'); // always in sync with the real plan price
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
            <span style={{ fontWeight: 700 }}>SchoolPilot Pro (per term)</span>
            <span style={{ fontWeight: 900, color: '#27AE60', fontSize: '1rem' }}>GHS {schoolmsProTermly.toLocaleString()}</span>
          </div>
          <div style={{ height: 1, background: '#e0e0e0' }} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 10,
            background: netSavingPerTerm > 0 ? '#e8f5e9' : '#fce4ec',
          }}>
            <span style={{ fontWeight: 800, color: netSavingPerTerm > 0 ? '#2e7d32' : '#c62828' }}>
              {netSavingPerTerm > 0 ? 'You save per term' : 'Extra cost per term'}
            </span>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: netSavingPerTerm > 0 ? '#2e7d32' : '#c62828' }}>
              GHS {Math.abs(netSavingPerTerm).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
