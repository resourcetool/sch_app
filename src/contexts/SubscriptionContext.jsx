// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getSubscription, getSubscriptionStatus, daysRemaining,
  canUseFeature, isReadOnly, getStudentLimit, hasWatermark, PLANS
} from '../services/subscriptionService';
import { isSuperAdmin } from '../services/superAdminService';

const SubscriptionContext = createContext(null);

// Super admin mock subscription — full access, never expires
const SA_SUBSCRIPTION = {
  plan: 'premium',
  status: 'active',
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  backupAddon: true
};

export function SubscriptionProvider({ children }) {
  const { userProfile } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    // Super admin gets full access
    if (isSuperAdmin(userProfile?.email)) {
      setSubscription(SA_SUBSCRIPTION);
      setLoading(false);
      return;
    }

    if (!schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sub = await getSubscription(schoolId);
      // If no subscription found, treat as trial
      setSubscription(sub || {
        plan: 'trial',
        status: 'active',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        backupAddon: false
      });
    } catch (err) {
      console.warn('Subscription fetch error:', err);
      setSubscription({ plan: 'trial', status: 'active', expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, backupAddon: false });
    } finally {
      setLoading(false);
    }
  }, [schoolId, userProfile?.email]);

  useEffect(() => { refresh(); }, [refresh]);

  const status = getSubscriptionStatus(subscription);
  const days = daysRemaining(subscription);
  const plan = subscription ? (PLANS[subscription.plan] || PLANS.trial) : PLANS.trial;
  const readOnly = isReadOnly(subscription);
  const watermark = hasWatermark(subscription);
  const studentLimit = getStudentLimit(subscription);

  function can(feature) {
    if (isSuperAdmin(userProfile?.email)) return true;
    return canUseFeature(subscription, feature);
  }

  return (
    <SubscriptionContext.Provider value={{
      subscription, loading, refresh,
      status, days, plan, readOnly,
      watermark, studentLimit, can
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  // Return safe defaults if used outside provider
  if (!ctx) return {
    subscription: null, loading: false,
    status: 'active', days: 30,
    plan: PLANS.trial, readOnly: false,
    watermark: false, studentLimit: 9999,
    can: () => true, refresh: () => {}
  };
  return ctx;
}
