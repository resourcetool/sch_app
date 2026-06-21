// src/pages/SubscriptionExpired.jsx
//
// Changes:
// - Added a dedicated TRIAL-ENDED state, separate from paid-plan expiry.
//   Trial ending is framed as "you reached real usage" rather than
//   "your time ran out" — this is the moment to convert, not alarm.
// - Explains WHICH milestone ended the trial (first report generated,
//   first class finalized, or the 21-day limit) so it's never a mystery.
// - "Your data is safe" notice is shown for trial-ended too, not just
//   paid-plan expiry — data is NEVER removed for trial users, full stop.
// - Fixed support contact details to match the real numbers used
//   elsewhere in the app (0549548274 / schoolpilot132@gmail.com).
// - Explicit "no auto-charge" trust statement: MoMo has no stored-card
//   billing, so nothing is ever charged automatically — the school
//   always actively chooses when (and whether) to pay.

import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { PLANS, daysUntilDelete } from '../services/subscriptionService';

const SUPPORT_PHONE      = '0549548274';
const SUPPORT_PHONE_INTL = '233549548274';
const SUPPORT_EMAIL      = 'schoolpilot132@gmail.com';

const MILESTONE_LABELS = {
  first_report:                'You generated your first academic report',
  first_assessment_finalized:  'You completed a full class assessment',
  time_limit:                  'Your 21-day trial period has ended',
};

export default function SubscriptionExpired() {
  const { subscription, status, plan } = useSubscription();
  const { logout, userProfile } = useAuth();
  const deleteIn = daysUntilDelete(subscription);

  const isSuspended  = status === 'suspended';
  const isTrialEnded = status === 'trial_ended';

  const waLink  = `https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, I'd like to subscribe to SchoolMS.`;
  const telLink = `tel:+${SUPPORT_PHONE_INTL}`;

  const milestoneLabel = isTrialEnded
    ? MILESTONE_LABELS[subscription?.trialEndReason] || MILESTONE_LABELS.time_limit
    : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--navy-mid) 0%, var(--navy) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>
          {isSuspended ? '⛔' : isTrialEnded ? '🎉' : '🔒'}
        </div>

        <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.3rem' }}>
          {isSuspended ? 'Account Suspended' : isTrialEnded ? 'Your Free Trial Is Complete!' : 'Subscription Expired'}
        </h2>

        {/* ── TRIAL-ENDED: framed as a milestone reached, not a punishment ── */}
        {isTrialEnded && (
          <>
            <p style={{ color: 'var(--text-mid)', marginBottom: 18, lineHeight: 1.7, fontSize: '.88rem' }}>
              {milestoneLabel} — that's exactly what SchoolMS is built for, and you got
              to try the real thing, not a watered-down demo.
            </p>

            <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 18px', marginBottom: 16, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6, fontSize: '.85rem' }}>✓ Your data is completely safe</div>
              <div style={{ fontSize: '.8rem', color: '#2e7d32', lineHeight: 1.6 }}>
                Every student, score, and report you created during your trial is kept exactly
                as it is. Nothing is deleted. Subscribe any time to pick up right where you left off.
              </div>
            </div>

            <div style={{ background: '#fff3e0', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 6, fontSize: '.85rem' }}>🔐 No surprise charges, ever</div>
              <div style={{ fontSize: '.8rem', color: '#bf6000', lineHeight: 1.6 }}>
                We don't store card details or auto-charge your Mobile Money. You decide if and
                when to pay — nothing happens automatically. Until you subscribe, your account is
                simply read-only: you can view everything, but can't add new data.
              </div>
            </div>
          </>
        )}

        {/* ── PAID PLAN EXPIRED (unchanged tone) ── */}
        {!isTrialEnded && !isSuspended && (
          <p style={{ color: 'var(--text-mid)', marginBottom: 24, lineHeight: 1.7, fontSize: '.88rem' }}>
            Your {plan?.name || ''} subscription has expired. Your data is safe — renew to restore full access.
          </p>
        )}

        {isSuspended && (
          <p style={{ color: 'var(--text-mid)', marginBottom: 24, lineHeight: 1.7, fontSize: '.88rem' }}>
            Your account has been suspended. Please contact us to resolve this issue.
          </p>
        )}

        {/* Data safety notice for paid-plan expiry (trial has its own above) */}
        {!isSuspended && !isTrialEnded && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6, fontSize: '.85rem' }}>✓ Your data is safe</div>
            <div style={{ fontSize: '.8rem', color: '#2e7d32', lineHeight: 1.6 }}>
              All student records, results, and history are preserved.
              {deleteIn > 0 && ` Account will be archived in ${deleteIn} days if not renewed.`}
            </div>
          </div>
        )}

        {/* Plans — shown for both trial-ended and paid-expired */}
        {!isSuspended && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              {isTrialEnded ? 'Choose a plan to continue — from GHS 150/month' : 'Renew from GHS 150/month'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['starter', 'pro', 'premium'].map(planId => {
                const p = PLANS[planId];
                return (
                  <div key={planId} style={{
                    border: `2px solid ${planId === 'pro' ? 'var(--navy)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: planId === 'pro' ? '#e3f2fd' : ''
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{p.name}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>
                        {planId === 'starter' ? 'Up to 200 students' : planId === 'pro' ? 'Unlimited + Analytics' : 'Unlimited + Backup'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--navy)' }}>GHS {p.price}<span style={{ fontWeight: 400, fontSize: '.75rem' }}>/mo</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contact buttons */}
        {!isSuspended && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block', background: '#25D366', color: '#fff',
                padding: '12px 20px', borderRadius: 10, fontWeight: 700,
                textDecoration: 'none', fontSize: '.9rem'
              }}
            >
              📱 WhatsApp to Subscribe — {SUPPORT_PHONE}
            </a>
            <a
              href={telLink}
              style={{
                display: 'block', background: 'var(--navy)', color: '#fff',
                padding: '12px 20px', borderRadius: 10, fontWeight: 700,
                textDecoration: 'none', fontSize: '.9rem'
              }}
            >
              📞 Call — {SUPPORT_PHONE}
            </a>
          </div>
        )}

        {isSuspended && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{
                display: 'block', background: 'var(--navy)', color: '#fff',
                padding: '12px 20px', borderRadius: 10, fontWeight: 700,
                textDecoration: 'none', fontSize: '.9rem'
              }}
            >
              ✉️ Contact Support — {SUPPORT_EMAIL}
            </a>
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: '.78rem', color: 'var(--text-lt)' }}>
          Logged in as {userProfile?.email}
        </div>
        <button
          onClick={logout}
          style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-lt)', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
