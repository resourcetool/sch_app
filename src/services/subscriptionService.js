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
// ── BILLING CYCLES ──────────────────────────────────────────────
// Schools can pay monthly OR termly (once per school term — 3x/year).
// Termly is a small saving AND more practical for Ghanaian schools
// that operate on a term budget rather than a monthly salary cycle.
//
// Monthly:  pay every 30 days
// Termly:   pay once per term (~120 days = 4 months)
//           priced at 3.5 months instead of 4 → small saving built in
//           so termly feels like a reward, not a trap

export const BILLING_CYCLES = {
  monthly: {
    id:           'monthly',
    label:        'Monthly',
    durationDays: 30,
    // multiplier = 1 — base price as listed
    multiplier:   1,
    saving:       null,
  },
  termly: {
    id:           'termly',
    label:        'Per Term',
    durationDays: 120,   // ~1 school term (4 months)
    // School pays for 3.5 months instead of 4 — saves half a month
    multiplier:   3.5,
    saving:       'Save half a month every term',
  },
};

export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Free Trial',
    price: 0,
    maxStudents: 50,
    durationDays: 21,
    features: {
      backup: false,
      analytics: false,   // Analytics is a paid-plan feature — not available during the free trial
      promotion: true,
      watermark: true,
      multiAdmin: false,
      prioritySupport: false,
    },
    color: '#8898aa',
    badge: 'Trial',
    tagline: 'Try everything free',
    highlight: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 150,           // GHS per month
    termlyPrice: 525,     // GHS per term (3.5 × 150) — saves GHS 75 vs monthly
    maxStudents: 200,
    durationDays: 30,
    features: {
      backup: false,
      analytics: false,
      promotion: true,
      watermark: false,
      multiAdmin: false,
      prioritySupport: false,
    },
    color: '#2980b9',
    badge: 'Starter',
    tagline: 'Perfect for small schools',
    highlight: false,
    bestFor: 'Schools with up to 200 students',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 250,           // GHS per month
    termlyPrice: 875,     // GHS per term (3.5 × 250) — saves GHS 125 vs monthly
    maxStudents: 99999,
    durationDays: 30,
    features: {
      backup: false,
      analytics: true,
      promotion: true,
      watermark: false,
      multiAdmin: false,
      prioritySupport: false,
    },
    color: '#0f3460',
    badge: 'Pro',
    tagline: 'Most popular choice',
    highlight: true,      // shown as recommended
    bestFor: 'Growing schools that want full analytics',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 400,           // GHS per month
    termlyPrice: 1400,    // GHS per term (3.5 × 400) — saves GHS 200 vs monthly
    maxStudents: 99999,
    durationDays: 30,
    features: {
      backup: true,
      analytics: true,
      promotion: true,
      watermark: false,
      multiAdmin: true,
      prioritySupport: true,
    },
    color: '#e94560',
    badge: 'Premium',
    tagline: 'Everything included',
    highlight: false,
    bestFor: 'Schools that want zero worries',
  },
};

export const BACKUP_ADDON_PRICE         = 100;  // GHS/month
export const BACKUP_ADDON_TERMLY_PRICE  = 350;  // GHS/term (3.5 × 100) — saves GHS 50

// ── PLAN FEATURE DESCRIPTIONS ─────────────────────────────────────
// Plain-language explanation of what each plan includes, shown wherever
// a school (or super admin, on a school's behalf) is choosing a plan —
// so the choice is informed rather than a guess. Kept in one place so
// the renewal screen, the expired-subscription screen, and super admin's
// renewal tool all describe plans identically.
export const PLAN_FEATURE_LIST = {
  starter: [
    'Up to 200 students',
    'Unlimited classes & subjects',
    'Score entry for teachers',
    'PDF report cards (SchoolMS watermark shown)',
    'Promotion engine (end-of-year promotion wizard)',
    'Works fully offline',
    '✗ No performance analytics/charts',
    '✗ No data backup & restore tools',
  ],
  pro: [
    'Unlimited students',
    'Unlimited classes & subjects',
    'Score entry for teachers',
    'Clean PDF report cards — no watermark',
    'Promotion engine (end-of-year promotion wizard)',
    'Works fully offline',
    '✓ Performance analytics — class trends, subject comparison, student progress',
    '✗ No data backup & restore tools (can be added separately)',
  ],
  premium: [
    'Unlimited students',
    'Unlimited classes & subjects',
    'Score entry for teachers',
    'Clean PDF report cards — no watermark',
    'Promotion engine (end-of-year promotion wizard)',
    'Works fully offline',
    '✓ Performance analytics — class trends, subject comparison, student progress',
    '✓ Data backup & restore included',
    '✓ Multiple admin accounts',
    '✓ Priority WhatsApp support',
  ],
};

// One-line summary of who each plan suits — used next to the plan name
export const PLAN_SUMMARY = {
  starter: 'Best for small schools (under 200 students) that just need reports done right — no analytics needed yet.',
  pro:     'Best for schools that want to track performance trends over time, not just print reports.',
  premium: 'Best for schools that want everything handled — analytics, backups, and multiple staff logins — with zero add-ons to think about.',
};

// Helper — get the price for a plan + billing cycle combination
export function getPlanPrice(planId, cycle = 'monthly') {
  const plan = PLANS[planId];
  if (!plan || !plan.price) return 0;
  return cycle === 'termly' ? (plan.termlyPrice || Math.round(plan.price * 3.5)) : plan.price;
}

// Helper — get termly saving vs paying monthly for 4 months
export function getTermlySaving(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.price) return 0;
  const monthly4 = plan.price * 4;
  const termly   = plan.termlyPrice || Math.round(plan.price * 3.5);
  return monthly4 - termly;
}

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

  if (subscription.status === 'suspended')        return 'suspended';
  if (subscription.status === 'trial_ended')      return 'trial_ended';
  if (subscription.status === 'pending_approval')  return 'pending_approval';
  if (subscription.status === 'rejected')           return 'rejected';
  if (subscription.status === 'deletion_requested') return 'deletion_requested';

  const expiry = subscription.expiresAt;

  if (subscription.plan === 'trial') {
    if (!expiry || now > expiry) return 'trial_ended';
    if (expiry - now < 3 * 24 * 60 * 60 * 1000) return 'trial_ending';
    return 'active';
  }

  if (now > expiry + 7 * 24 * 60 * 60 * 1000) return 'expired';
  if (now > expiry) return 'grace';
  if (expiry - now < 7 * 24 * 60 * 60 * 1000) return 'expiring';
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
  if (['suspended','expired','trial_ended','grace','pending_approval','rejected'].includes(status)) return false;
  const plan = PLANS[subscription.plan] || PLANS.trial;
  if (feature === 'backup') return plan.features.backup || subscription.backupAddon === true;
  return plan.features[feature] === true;
}

export function isReadOnly(subscription) {
  const status = getSubscriptionStatus(subscription);
  return ['grace','expired','suspended','trial_ended','pending_approval','rejected','deletion_requested'].includes(status);
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
