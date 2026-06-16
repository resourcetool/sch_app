// src/components/common/FeatureGate.jsx
import React from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';

// Wraps any feature that requires a specific plan/feature flag
export default function FeatureGate({ feature, children, fallback }) {
  const { can, subscription, plan } = useSubscription();

  if (can(feature)) return children;

  if (fallback) return fallback;

  const featureNames = {
    backup: 'Backup & Export',
    analytics: 'Analytics Dashboard',
    multiAdmin: 'Multiple Admin Accounts',
    prioritySupport: 'Priority Support'
  };

  const upgradePlans = {
    backup: 'Premium (GHS 400/month)',
    analytics: 'Pro or Premium (GHS 250+/month)',
    multiAdmin: 'Premium (GHS 400/month)',
    prioritySupport: 'Premium (GHS 400/month)'
  };

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '2px dashed var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '48px 32px',
      textAlign: 'center',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⭐</div>
      <h3 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1rem' }}>
        {featureNames[feature] || 'Premium Feature'}
      </h3>
      <p style={{ color: 'var(--text-mid)', fontSize: '.85rem', marginBottom: 20, lineHeight: 1.6 }}>
        This feature is available on the <strong>{upgradePlans[feature] || 'higher plan'}</strong>.
        Contact your system provider to upgrade.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          href="https://wa.me/233549271528"
          target="_blank"
          rel="noreferrer"
          style={{
            background: '#25D366',
            color: '#fff',
            padding: '9px 20px',
            borderRadius: 'var(--radius)',
            fontWeight: 700,
            fontSize: '.85rem',
            textDecoration: 'none'
          }}
        >
          📱 WhatsApp to Upgrade
        </a>
        <a
          href="tel:+233549271528"
          style={{
            background: 'var(--navy)',
            color: '#fff',
            padding: '9px 20px',
            borderRadius: 'var(--radius)',
            fontWeight: 700,
            fontSize: '.85rem',
            textDecoration: 'none'
          }}
        >
          📞 Call Us
        </a>
      </div>
      <p style={{ fontSize: '.75rem', color: 'var(--text-lt)', marginTop: 16 }}>
        Current plan: <strong>{plan?.name || 'Trial'}</strong>
      </p>
    </div>
  );
}

// Read-only overlay for expired accounts
export function ReadOnlyOverlay({ children }) {
  const { readOnly } = useSubscription();

  if (!readOnly) return children;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(240,244,248,0.75)',
        zIndex: 10,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔒</div>
          <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.9rem' }}>Read-Only Mode</p>
          <p style={{ color: 'var(--text-mid)', fontSize: '.8rem' }}>Renew to make changes</p>
        </div>
      </div>
      <div style={{ pointerEvents: 'none', opacity: 0.5 }}>
        {children}
      </div>
    </div>
  );
}
