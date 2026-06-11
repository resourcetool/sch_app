// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getSubscription, getSubscriptionStatus, daysRemaining,
  canUseFeature, isReadOnly, getStudentLimit, hasWatermark, PLANS
} from '../services/subscriptionService';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { userProfile } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const schoolId = userProfile?.schoolId;

  const refresh = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    try {
      const sub = await getSubscription(schoolId);
      setSubscription(sub);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { refresh(); }, [refresh]);

  const status = getSubscriptionStatus(subscription);
  const days = daysRemaining(subscription);
  const plan = subscription ? (PLANS[subscription.plan] || PLANS.trial) : PLANS.trial;
  const readOnly = isReadOnly(subscription);
  const watermark = hasWatermark(subscription);
  const studentLimit = getStudentLimit(subscription);

  function can(feature) {
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
  return useContext(SubscriptionContext);
}
