// src/components/common/SubscriptionBanner.jsx
import React from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';

export default function SubscriptionBanner() {
  const { status, days, plan, subscription } = useSubscription();

  if (!subscription) return null;
  if (status === 'active' && days > 7) return null; // no banner when all is well

  const configs = {
    expiring: {
      bg: '#fff8e1', border: '#f5a623', color: '#7d5400',
      icon: '⏰',
      text: `Your ${plan.name} plan expires in ${days} day${days !== 1 ? 's' : ''}. Contact 024XXXXXXX to renew.`
    },
    grace: {
      bg: '#fce4ec', border: '#e74c3c', color: '#c0392b',
      icon: '🔒',
      text: `Your subscription has expired. System is in read-only mode. Contact 024XXXXXXX to renew.`
    },
    expired: {
      bg: '#fce4ec', border: '#e74c3c', color: '#c0392b',
      icon: '🔒',
      text: `Your subscription has expired. System is in read-only mode. Contact 024XXXXXXX to renew.`
    },
    suspended: {
      bg: '#f3e5f5', border: '#8e44ad', color: '#6c3483',
      icon: '⛔',
      text: `Your account has been suspended. Contact 024XXXXXXX for assistance.`
    },
    trial: {
      bg: '#e3f2fd', border: '#2980b9', color: '#1a5276',
      icon: '🎯',
      text: `Free trial — ${days} day${days !== 1 ? 's' : ''} remaining. Limited to 50 students. Contact 024XXXXXXX to upgrade.`
    }
  };

  // Show trial banner if on trial plan regardless of status
  const key = subscription.plan === 'trial' ? 'trial' : status;
  const config = configs[key];
  if (!config) return null;

  return (
    <div style={{
      background: config.bg,
      borderBottom: `2px solid ${config.border}`,
      color: config.color,
      padding: '9px 24px',
      fontSize: '.83rem',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0
    }}>
      <span>{config.icon}</span>
      <span>{config.text}</span>
      <a
        href="https://wa.me/233240000000"
        target="_blank"
        rel="noreferrer"
        style={{
          marginLeft: 'auto',
          background: config.border,
          color: '#fff',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: '.78rem',
          textDecoration: 'none',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}
      >
        Contact Now →
      </a>
    </div>
  );
}
