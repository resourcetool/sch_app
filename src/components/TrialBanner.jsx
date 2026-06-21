// src/components/TrialBanner.jsx
//
// New component — shown to admins while on an active trial.
// Purpose: complete transparency about how the trial works, so there is
// never a surprise. Explains all three ending conditions plainly, shows
// real countdown progress, and reassures about no auto-charge / no data
// loss. This is meant to build trust, not create false urgency.

import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { daysRemaining } from '../services/subscriptionService';

export default function TrialBanner() {
  const { subscription, status } = useSubscription();

  if (!subscription || subscription.plan !== 'trial') return null;
  if (status !== 'active' && status !== 'trial_ending') return null;

  const daysLeft = daysRemaining(subscription);
  const urgent   = status === 'trial_ending'; // <3 days left on the 21-day bound

  return (
    <div style={{
      background: urgent ? '#fff3e0' : '#e3f2fd',
      border: `1px solid ${urgent ? '#ffb74d' : '#90caf9'}`,
      borderRadius: 10, padding: '10px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
        <span style={{ fontSize: '1.3rem' }}>{urgent ? '⏳' : '🎁'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.85rem', color: urgent ? '#e65100' : '#0d47a1' }}>
            Free Trial — {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining
          </div>
          <div style={{ fontSize: '.76rem', color: urgent ? '#bf6000' : '#1565c0', lineHeight: 1.5 }}>
            Your trial ends when you generate your first report, finalise a full class
            assessment, or after 21 days — whichever happens first. No card on file,
            nothing is ever auto-charged.
          </div>
        </div>
      </div>
      <a
        href="https://wa.me/233549548274?text=Hello, I'd like to learn more about subscribing to SchoolMS."
        target="_blank" rel="noreferrer"
        style={{
          background: '#25D366', color: '#fff', padding: '7px 14px', borderRadius: 8,
          fontWeight: 700, fontSize: '.78rem', textDecoration: 'none', whiteSpace: 'nowrap',
        }}
      >
        📱 Ask about plans
      </a>
    </div>
  );
}
