// src/services/subscriptionService.js
//
// CHANGED — trial model replaced with milestone-based early termination:
//   Trial ends when ANY of these happens (whichever comes first):
//     1. First academic report generated   (generateResults() called)
//     2. First full class assessment completed (finalizeResults() called)
//     3. 21 days pass since trial start
//   This matches the principle "free trial gives a taste of the real
//   workflow, then converts" rather than a pure calendar countdown.
//
// After trial ends (by any trigger): READ-ONLY access, NOT data deletion.
// Data is never removed for trial users — this is the trust foundation:
// a school that tried the system and decided to pay later should find
// everything exactly as they left it.

import { idbGet, idbPut } from './indexedDB';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// ── PLAN DEFINITIONS ──────────────────────────────────────────────
export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Free Trial',
    price: 0,
    maxStudents: 50,
    durationDays: 21,        // outer time bound — milestones can end it sooner
    features: {
      backup: false,
      analytics: true,
      promotion: true,
      watermark: true,      // PDFs have watermark during trial
      multiAdmin: false,
      prioritySupport: false
    },
    color: '#8898aa',
    badge: 'Trial'
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 150,
    maxStudents: 200,
    durationDays: 30,
    features: {
      backup: false,
      analytics: false,
      promotion: true,
      watermark: false,
      multiAdmin: false,
      prioritySupport: false
    },
    color: '#2980b9',
    badge: 'Starter'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 250,
    maxStudents: 99999,
    durationDays: 30,
    features: {
      backup: false,
      analytics: true,
      promotion: true,
      watermark: false,
      multiAdmin: false,
      prioritySupport: false
    },
    color: '#0f3460',
    badge: 'Pro'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 400,
    maxStudents: 99999,
    durationDays: 30,
    features: {
      backup: true,
      analytics: true,
      promotion: true,
      watermark: false,
      multiAdmin: true,
      prioritySupport: true
    },
    color: '#e94560',
    badge: 'Premium'
  }
};

export const BACKUP_ADDON_PRICE = 100; // GHS/month

// ── TRIAL MILESTONE CHECK ─────────────────────────────────────────
// Called by generateResults() and finalizeResults() in scoreService.js
// the moment either milestone happens, for a school still on trial.
// Ends the trial immediately (sets status to 'trial_ended') rather than
// waiting for the 21-day calendar bound.
export async function checkAndEndTrialOnMilestone(schoolId, milestoneType) {
  const sub = await getSubscription(schoolId);
  if (!sub || sub.plan !== 'trial' || sub.status !== 'active') return; // not an active trial — nothing to do

  const updated = {
    ...sub,
    status:        'trial_ended',
    trialEndedAt:  Date.now(),
    trialEndReason: milestoneType, // 'first_report' | 'first_assessment_finalized' | 'time_limit'
  };

  await setDoc(doc(db, 'subscriptions', schoolId), updated, { merge: true });
  await idbPut('subscriptions', updated);
  return updated;
}

// ── SUBSCRIPTION STATUS ───────────────────────────────────────────
// Possible return values:
//   'none'        — no subscription record exists
//   'active'      — paid plan or trial, currently usable
//   'expiring'    — paid plan, <7 days left
//   'trial_ending'— trial, <3 days left on the 21-day bound (soft warning)
//   'trial_ended' — trial ended by milestone OR by hitting day 21 — READ ONLY
//   'grace'       — paid plan, past expiry, within 7-day grace window
//   'expired'     — paid plan, past grace window
//   'suspended'   — manually suspended by super admin
export function getSubscriptionStatus(subscription) {
  if (!subscription) return 'none';
  const now = Date.now();

  if (subscription.status === 'suspended')   return 'suspended';
  if (subscription.status === 'trial_ended') return 'trial_ended';

  const expiry = subscription.expiresAt;

  // Trial-specific: even if not yet milestone-ended, check the 21-day bound
  if (subscription.plan === 'trial') {
    if (now > expiry) return 'trial_ended';            // time limit reached
    if (expiry - now < 3 * 24 * 60 * 60 * 1000) return 'trial_ending'; // <3 days left
    return 'active';
  }

  // Paid plans: standard expiry + grace logic
  if (now > expiry + 7 * 24 * 60 * 60 * 1000) return 'expired';  // past grace
  if (now > expiry) return 'grace';                                 // in grace period
  if (expiry - now < 7 * 24 * 60 * 60 * 1000) return 'expiring';  // < 7 days left
  return 'active';
}

export function daysRemaining(subscription) {
  if (!subscription) return 0;
  const diff = subscription.expiresAt - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function daysUntilDelete(subscription) {
  if (!subscription) return 0;
  const graceEnd = subscription.expiresAt + 60 * 24 * 60 * 60 * 1000; // 60 days after expiry
  const diff = graceEnd - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── GET SUBSCRIPTION ──────────────────────────────────────────────
export async function getSubscription(schoolId) {
  let sub = await idbGet('subscriptions', schoolId);

  if (navigator.onLine) {
    try {
      const snap = await getDoc(doc(db, 'subscriptions', schoolId));
      if (snap.exists()) {
        sub = { id: schoolId, ...snap.data() };
        await idbPut('subscriptions', sub);
      }
    } catch (err) {
      console.warn('Could not fetch subscription:', err.message);
    }
  }
  return sub || null;
}

// ── FEATURE CHECK ─────────────────────────────────────────────────
export function canUseFeature(subscription, feature) {
  if (!subscription) return false;
  const status = getSubscriptionStatus(subscription);
  if (status === 'suspended')   return false;
  if (status === 'expired')     return false;
  if (status === 'trial_ended') return false;  // read-only — no feature access
  if (status === 'grace')       return false;

  const plan = PLANS[subscription.plan] || PLANS.trial;

  if (feature === 'backup') {
    return plan.features.backup || subscription.backupAddon === true;
  }

  return plan.features[feature] === true;
}

// READ-ONLY applies to: grace, expired, suspended, AND trial_ended.
// Critically, trial_ended does NOT mean data loss — isReadOnly() only
// blocks new writes (entering scores, adding students, etc). All
// existing data remains fully visible and exportable-on-paper-request.
export function isReadOnly(subscription) {
  const status = getSubscriptionStatus(subscription);
  return status === 'grace' || status === 'expired' || status === 'suspended' || status === 'trial_ended';
}

export function getStudentLimit(subscription) {
  if (!subscription) return 50;
  const plan = PLANS[subscription.plan] || PLANS.trial;
  return plan.maxStudents;
}

export function hasWatermark(subscription) {
  if (!subscription) return true;
  const plan = PLANS[subscription.plan] || PLANS.trial;
  const status = getSubscriptionStatus(subscription);
  if (status === 'grace' || status === 'expired' || status === 'trial_ended') return true;
  return plan.features.watermark === true;
}
