// src/components/ExpiryNotification.jsx
//
// In-app notification system for:
// - Trial expiry warnings (7 days, 3 days, 1 day before)
// - Paid plan expiry warnings (7 days, 3 days, 1 day before)
// - Trust message: no hidden charges, data always safe
// - Dismissable per session (stored in sessionStorage, not localStorage)

import React, { useState, useEffect } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth }         from '../contexts/AuthContext';
import { daysRemaining }   from '../services/subscriptionService';

const SUPPORT_PHONE_INTL = '233549548274';

export default function ExpiryNotification() {
  const { subscription, status, plan } = useSubscription();
  const { userProfile }                = useAuth();
  const [dismissed, setDismissed]      = useState(false);

  const days    = daysRemaining(subscription);
  const isTrial = subscription?.plan === 'trial';
  const isAdmin = userProfile?.role === 'admin';

  // Only show to admins (teachers don't pay)
  if (!isAdmin) return null;
  if (dismissed) return null;
  if (!subscription) return null;

  // Determine notification level
  // Show at 7, 3, and 1 days before expiry for both trial and paid
  const shouldShow =
    (status === 'active' || status === 'trial_ending' || status === 'expiring') &&
    days <= 7 && days >= 0;

  if (!shouldShow) return null;

  const urgency = days <= 1 ? 'critical' : days <= 3 ? 'high' : 'medium';
  const bg      = urgency === 'critical' ? '#ffebee' : urgency === 'high' ? '#fff3e0' : '#e3f2fd';
  const border  = urgency === 'critical' ? '#ef5350'  : urgency === 'high' ? '#ff9800'  : '#2196F3';
  const icon    = urgency === 'critical' ? '🚨'        : urgency === 'high' ? '⚠️'        : 'ℹ️';

  const dayLabel = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

  const message = isTrial
    ? `Your free trial ends ${dayLabel}.`
    : `Your ${plan?.name || ''} subscription expires ${dayLabel}.`;

  const waLink = `https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, I'd like to ${isTrial ? 'subscribe to' : 'renew my'} SchoolMS plan.`;

  // Dismiss key is per-day so it re-shows the next day if not acted on
  const dismissKey = `expiry_dismissed_${subscription?.id}_${days}`;

  useEffect(() => {
    if (sessionStorage.getItem(dismissKey)) setDismissed(true);
  }, [dismissKey]);

  function dismiss() {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  }

  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 10, padding: '12px 16px',
      marginBottom: 14,
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#1a1a2e', marginBottom: 3 }}>
            {message}
          </div>
          <div style={{ fontSize: '.8rem', color: '#555', lineHeight: 1.5 }}>
            {isTrial
              ? 'To continue using SchoolMS after your trial, choose a subscription plan. Your data is always safe — nothing is deleted if you don\'t subscribe.'
              : 'Renew now to avoid read-only mode. Your data is always safe — it is never deleted due to non-payment.'
            }
          </div>

          {/* Trust message */}
          <div style={{
            marginTop: 8, fontSize: '.75rem', color: '#388e3c',
            background: '#e8f5e9', borderRadius: 6, padding: '5px 10px',
            display: 'inline-block',
          }}>
            ✓ No hidden charges · No auto-billing · Data preserved after expiry
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={waLink}
              target="_blank" rel="noreferrer"
              style={{
                background: '#25D366', color: '#fff', padding: '6px 14px',
                borderRadius: 8, fontWeight: 700, fontSize: '.8rem',
                textDecoration: 'none',
              }}
            >
              📱 {isTrial ? 'Subscribe' : 'Renew'} — WhatsApp
            </a>
            <a
              href="/legal/subscription"
              style={{
                background: 'none', color: border, padding: '6px 14px',
                borderRadius: 8, fontWeight: 600, fontSize: '.8rem',
                textDecoration: 'none', border: `1px solid ${border}`,
              }}
            >
              View Plans
            </a>
          </div>
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#999', fontSize: '1.1rem', padding: 0, flexShrink: 0,
        }}
        title="Dismiss (shows again tomorrow)"
      >
        ✕
      </button>
    </div>
  );
}
