// src/pages/SubscriptionExpired.jsx
import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { PLANS, daysUntilDelete } from '../services/subscriptionService';

export default function SubscriptionExpired() {
  const { subscription, status, plan } = useSubscription();
  const { logout, userProfile } = useAuth();
  const deleteIn = daysUntilDelete(subscription);

  const isSuspended = status === 'suspended';

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
          {isSuspended ? '⛔' : '🔒'}
        </div>

        <h2 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.3rem' }}>
          {isSuspended ? 'Account Suspended' : 'Subscription Expired'}
        </h2>

        <p style={{ color: 'var(--text-mid)', marginBottom: 24, lineHeight: 1.7, fontSize: '.88rem' }}>
          {isSuspended
            ? `Your account has been suspended. Please contact us to resolve this issue.`
            : `Your ${plan?.name || ''} subscription has expired. Your data is safe — renew to restore full access.`}
        </p>

        {/* Data safety notice */}
        {!isSuspended && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 6, fontSize: '.85rem' }}>✓ Your data is safe</div>
            <div style={{ fontSize: '.8rem', color: '#2e7d32', lineHeight: 1.6 }}>
              All student records, results, and history are preserved.
              {deleteIn > 0 && ` Account will be archived in ${deleteIn} days if not renewed.`}
            </div>
          </div>
        )}

        {/* Plans */}
        {!isSuspended && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Renew from GHS 150/month</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href="https://wa.me/233240000000"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block', background: '#25D366', color: '#fff',
              padding: '12px 20px', borderRadius: 10, fontWeight: 700,
              textDecoration: 'none', fontSize: '.9rem'
            }}
          >
            📱 WhatsApp to Renew — 0549271528
          </a>
          <a
            href="tel:+233240000000"
            style={{
              display: 'block', background: 'var(--navy)', color: '#fff',
              padding: '12px 20px', borderRadius: 10, fontWeight: 700,
              textDecoration: 'none', fontSize: '.9rem'
            }}
          >
            📞 Call — 0549271528
          </a>
        </div>

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
