// src/contexts/SubscriptionContext.jsx
//
// Changes:
// - Handles pending_approval: shows PendingApprovalScreen instead of app
// - Handles rejected: shows RejectedScreen with clear reason
// - No longer falls back to a fake "active trial" if no subscription found
//   (was masking real pending/rejected states)
// - refresh() exposed so SubscriptionExpired can trigger re-check after payment

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth }             from './AuthContext';
import {
  getSubscription, getSubscriptionStatus, daysRemaining,
  canUseFeature, isReadOnly, getStudentLimit, hasWatermark, PLANS
} from '../services/subscriptionService';
import { isSuperAdmin } from '../services/superAdminService';

const SubscriptionContext = createContext(null);

const SA_SUBSCRIPTION = {
  plan: 'premium', status: 'active',
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  backupAddon: true,
};

const SUPPORT_PHONE_INTL = '233549548274';

// ── PENDING APPROVAL SCREEN ───────────────────────────────────────
function PendingApprovalScreen({ subscription, onRefresh, logout }) {
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    await onRefresh();
    setChecking(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f3460 0%, #1a4a7a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
        <h2 style={{ color: '#0f3460', marginBottom: 10 }}>Awaiting Approval</h2>
        <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.7, fontSize: '.88rem' }}>
          Your trial request for <strong>{subscription?.schoolName}</strong> is being reviewed.
          Our team typically responds within a few hours during business hours.
        </p>
        <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6, fontSize: '.85rem' }}>What to expect</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: '.82rem', lineHeight: 2, color: '#388e3c' }}>
            <li>We verify your school name, email, and phone</li>
            <li>You get a WhatsApp notification when approved</li>
            <li>Click "Check Status" below or log back in after approval</li>
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={check}
            className="btn btn-primary btn-lg"
            disabled={checking}
          >
            {checking ? '⏳ Checking…' : '↻ Check Approval Status'}
          </button>
          <a
            href={`https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, I submitted a SchoolMS trial request for ${subscription?.schoolName || 'my school'} and am waiting for approval.`}
            target="_blank" rel="noreferrer"
            style={{
              display: 'block', background: '#25D366', color: '#fff',
              padding: '12px 20px', borderRadius: 10, fontWeight: 700,
              textDecoration: 'none', fontSize: '.9rem',
            }}
          >
            📱 Contact Us — 0549548274
          </a>
        </div>
        <button
          onClick={logout}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── DELETION REQUESTED SCREEN ────────────────────────────────────
function DeletionRequestedScreen({ subscription, logout }) {
  const deleteAfter = subscription?.deleteAfter
    ? new Date(subscription.deleteAfter).toLocaleDateString('en-GH', { dateStyle: 'long' })
    : '60 days from request';
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f3460 0%, #1a4a7a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🗑</div>
        <h2 style={{ color: '#0f3460', marginBottom: 10 }}>Deletion Request Pending</h2>
        <p style={{ color: '#666', marginBottom: 16, lineHeight: 1.7, fontSize: '.88rem' }}>
          Your school has requested account deletion. Your account is now inactive and your
          data will be permanently deleted on <strong>{deleteAfter}</strong>.
        </p>
        <div style={{ background: '#fff3e0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 4, fontSize: '.85rem' }}>Changed your mind?</div>
          <div style={{ fontSize: '.82rem', color: '#bf6000', lineHeight: 1.6 }}>
            Contact us before {deleteAfter} to cancel this deletion request and restore your account.
            All your data is still safely preserved during this period.
          </div>
        </div>
        <a href={`https://wa.me/233549548274?text=Hello, I'd like to cancel my SchoolMS data deletion request.`}
          target="_blank" rel="noreferrer"
          style={{ display: 'block', background: '#25D366', color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '.9rem', marginBottom: 10 }}>
          📱 Cancel Deletion — WhatsApp 0549548274
        </a>
        <button onClick={logout} style={{ marginTop: 8, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── REJECTED SCREEN ───────────────────────────────────────────────
function RejectedScreen({ subscription, logout }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f3460 0%, #1a4a7a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
        <h2 style={{ color: '#0f3460', marginBottom: 10 }}>Trial Request Not Approved</h2>
        {subscription?.rejectionReason && (
          <div style={{ background: '#fce4ec', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 4, fontSize: '.85rem' }}>Reason</div>
            <div style={{ fontSize: '.84rem', color: '#c62828' }}>{subscription.rejectionReason}</div>
          </div>
        )}
        <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.7, fontSize: '.88rem' }}>
          If you believe this is an error, please contact us on WhatsApp with your school's
          official details and we'll review it again.
        </p>
        <a
          href={`https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, my SchoolMS trial request was rejected. I'd like to appeal.`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', background: '#25D366', color: '#fff',
            padding: '12px 20px', borderRadius: 10, fontWeight: 700,
            textDecoration: 'none', fontSize: '.9rem', marginBottom: 10,
          }}
        >
          📱 Appeal on WhatsApp — 0549548274
        </a>
        <button
          onClick={logout}
          style={{ marginTop: 8, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '.78rem', textDecoration: 'underline' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── PROVIDER ──────────────────────────────────────────────────────
export function SubscriptionProvider({ children }) {
  const { userProfile, logout } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading,      setLoading]      = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    if (isSuperAdmin(userProfile?.email)) {
      setSubscription(SA_SUBSCRIPTION);
      setLoading(false);
      return;
    }
    if (!schoolId) { setLoading(false); return; }

    setLoading(true);
    try {
      const sub = await getSubscription(schoolId);
      // If no subscription found at all — school registered but trial not started.
      // Do NOT fake an active subscription — show nothing/pending UI.
      setSubscription(sub || null);
    } catch (err) {
      console.warn('[Subscription] fetch error:', err.message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [schoolId, userProfile?.email]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll every 30 seconds while pending so approval is detected quickly
  useEffect(() => {
    const status = getSubscriptionStatus(subscription);
    if (status !== 'pending_approval') return;
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [subscription, refresh]);

  const status       = getSubscriptionStatus(subscription);
  const days         = daysRemaining(subscription);
  const plan         = subscription ? (PLANS[subscription.plan] || PLANS.trial) : PLANS.trial;
  const readOnly     = isReadOnly(subscription);
  const watermark    = hasWatermark(subscription);
  const studentLimit = getStudentLimit(subscription);

  function can(feature) {
    if (isSuperAdmin(userProfile?.email)) return true;
    return canUseFeature(subscription, feature);
  }

  // Show loading screen while fetching subscription — NEVER render app
  // until we know the subscription status. This prevents the brief
  // "active" flash that let pending-approval trials reach the dashboard.
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f3460' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '.85rem', opacity: .7 }}>Checking account status…</div>
        </div>
      </div>
    );
  }

  // Intercept special states before rendering the app
  if (status === 'pending_approval') {
    return <PendingApprovalScreen subscription={subscription} onRefresh={refresh} logout={logout} />;
  }
  if (status === 'rejected') {
    return <RejectedScreen subscription={subscription} logout={logout} />;
  }
  if (status === 'deletion_requested') {
    return <DeletionRequestedScreen subscription={subscription} logout={logout} />;
  }

  return (
    <SubscriptionContext.Provider value={{
      subscription, loading, refresh,
      status, days, plan, readOnly,
      watermark, studentLimit, can,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) return {
    subscription: null, loading: false,
    status: 'active', days: 30,
    plan: PLANS.trial, readOnly: false,
    watermark: false, studentLimit: 9999,
    can: () => true, refresh: () => {},
  };
  return ctx;
}
