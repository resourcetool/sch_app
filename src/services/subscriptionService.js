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
// SIMPLIFIED: termly is now the ONLY cycle actively sold — "pay once
// per academic term, no automatic renewal" is the whole pricing story.
// Monthly and annual stay defined here (not deleted) purely so any
// EXISTING subscription already on one of those cycles keeps working
// and renewing correctly — new signups and the Pricing page only ever
// show termly. Don't remove monthly/annual entries; just don't surface
// them as options going forward.
export const ACTIVELY_SOLD_CYCLE = 'termly';

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
    durationDays: 90,   // 1 school term = 3 months
    // School pays for 2.5 months instead of 3 — saves half a month
    multiplier:   2.5,
    saving:       'Save half a month every term',
  },
  annual: {
    id:           'annual',
    label:        'Annual',
    durationDays: 365,
    // Priced at 9 months instead of 12 — bigger saving than termly,
    // in exchange for a single upfront payment. Improves cash flow
    // for us and gives schools that can afford it a clear reason to
    // commit for the year instead of renewing 3x.
    multiplier:   9,
    saving:       'Save 3 months — the biggest discount available',
  },
};

// ── REFERRAL PROGRAM ──────────────────────────────────────────────
// A school that refers another paying school gets a free month added
// to their own expiry once the referred school's first payment is
// confirmed by super admin. Cheap for us (marginal cost per school is
// near zero), valuable in tight school-network communities where word
// of mouth between head teachers carries real weight.
export const REFERRAL_REWARD_DAYS = 30;

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
    price: 150,           // GHS per month (internal reference — termly is the only cycle shown/sold)
    termlyPrice: 375,     // GHS per term — the headline, listed price
    maxStudents: 200,
    durationDays: 30,
    features: {
      backup: false,        // no AUTOMATIC cloud backup
      manualBackup: true,   // manual backup/export IS included — every plan gets this
      analytics: false,
      promotion: true,
      watermark: true,      // subtle "Powered by Schpilot" footer on report PDFs
      multiAdmin: false,
      prioritySupport: false,
    },
    color: '#2980b9',
    badge: 'Starter',
    tagline: 'Get your results done.',
    highlight: false,
    bestFor: 'Schools with up to 200 students',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 250,
    termlyPrice: 625,
    maxStudents: 500,
    durationDays: 30,
    features: {
      backup: false,        // automatic backup is an optional add-on at Pro; included from Premium up
      manualBackup: true,
      analytics: true,
      promotion: true,
      watermark: false,     // no watermark from Pro up
      multiAdmin: false,
      prioritySupport: false,
    },
    color: '#0f3460',
    badge: 'Pro',
    tagline: 'Control the entire assessment process.',
    highlight: true,      // shown as recommended — "Most Popular"
    bestFor: 'Schools with up to 500 students that want full control and analytics',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 400,
    termlyPrice: 1000,    // GHS per term (2.5 × 400) — saves GHS 200 vs 3 months
    maxStudents: 1000,
    durationDays: 30,
    features: {
      backup: true,          // automatic cloud backup included
      manualBackup: true,
      analytics: true,
      promotion: true,
      watermark: false,      // Premium can also set fully custom branding — see reportStyle.customBranding
      multiAdmin: true,
      prioritySupport: true,
    },
    color: '#e94560',
    badge: 'Premium',
    tagline: 'Run assessment across the whole school.',
    highlight: false,
    bestFor: 'Schools with up to 1,000 students that want everything handled',
  },
};

// Schools above 1,000 students don't fit a fixed tier — shown as a
// "Contact Us" card in the pricing UI rather than a real PLANS entry,
// since pricing for that size is negotiated directly, not self-serve.
export const CONTACT_US_THRESHOLD = 1000;

export const BACKUP_ADDON_PRICE         = 100;  // GHS/month
export const BACKUP_ADDON_TERMLY_PRICE  = 250;  // GHS/term (2.5 × 100) — saves GHS 50 vs 3 months

// ── PLAN FEATURE DESCRIPTIONS ─────────────────────────────────────
// Plain-language explanation of what each plan includes, shown wherever
// a school (or super admin, on a school's behalf) is choosing a plan —
// so the choice is informed rather than a guess. Kept in one place so
// the renewal screen, the expired-subscription screen, and super admin's
// renewal tool all describe plans identically.
// IMPORTANT — honesty over sales copy: only list a feature here once it
// actually exists in the app. Items marked "(coming soon)" are on the
// roadmap for that tier but not yet built — they are shown transparently
// rather than silently promised, because charging for a feature that
// doesn't work yet is the fastest way to lose trust with a school that
// just paid. Move an item out of "(coming soon)" the day it ships.
export const PLAN_FEATURE_LIST = {
  starter: [
    'Up to 200 students',
    'Classes & subjects',
    'Teacher score entry',
    'Automatic calculations, positions & aggregates',
    'PDF report cards (subtle "Powered by Schpilot" footer)',
    'Promotion engine (end-of-year promotion wizard)',
    'Works fully offline',
    'Manual backup/export',
    '✗ No performance analytics/charts',
    '✗ No automatic cloud backup',
  ],
  pro: [
    'Up to 500 students',
    'Everything in Starter, plus:',
    'Clean PDF report cards — no watermark',
    'Manual backup/export',
    '✓ Performance analytics — class/subject trends, student progress',
    '⏳ Assessment approval workflow (coming soon)',
    '⏳ Live assessment completion dashboard (coming soon)',
    '⏳ Parent result portal (coming soon)',
    '⏳ Bulk import/export — Excel/CSV (coming soon)',
    '⏳ Advanced reports by class/subject/teacher (coming soon)',
    '✗ No automatic cloud backup (manual export included; automatic is Premium)',
  ],
  premium: [
    'Up to 1,000 students',
    'Everything in Pro, plus:',
    '✓ Automatic cloud backup & restore',
    '✓ Multiple admin accounts',
    '✓ Priority WhatsApp/phone support',
    '⏳ Advanced school-wide analytics dashboard (coming soon)',
    '⏳ Learning-risk identification & flagging (coming soon)',
    '⏳ Student academic profile & trajectory (coming soon)',
    '⏳ Advanced report-card customization — logo, colors, layout (coming soon)',
    '⏳ Multi-role permissions & audit logs (coming soon)',
    '✓ No Schpilot footer on reports',
  ],
};

// One-line summary of who each plan suits — used next to the plan name
export const PLAN_SUMMARY = {
  starter: 'Get your results done — everything you need to run assessment day to day, up to 200 students.',
  pro:     'Full analytics today, with approvals, parent access, and bulk import on the way — up to 500 students.',
  premium: 'Automatic backups, multi-admin, and priority support today, with school-wide intelligence tools on the way — up to 1,000 students.',
};

// Helper — get the price for a plan + billing cycle combination.
// Default cycle is 'termly' — the only cycle actively sold now (see
// BILLING_CYCLES note below). Monthly/annual remain in the data model
// only so existing subscriptions already on those cycles keep working.
export function getPlanPrice(planId, cycle = 'termly') {
  const plan = PLANS[planId];
  if (!plan || !plan.price) return 0;
  if (cycle === 'termly') return plan.termlyPrice || Math.round(plan.price * 2.5);
  if (cycle === 'annual') return plan.annualPrice || Math.round(plan.price * BILLING_CYCLES.annual.multiplier);
  return plan.price;
}

// ── TERM-CALENDAR-BASED EXPIRY ────────────────────────────────────
// Fixes the "flat 90-day countdown from payment date" gap: a school
// could time their payment to land right before results are due,
// getting full value out of the window without it lining up to a real
// renewal-pressure point. If the admin has set a real term-end date
// (school.nextTermBegins or an explicit termEndDate), prefer that over
// a blind duration count — with a short grace window on top so schools
// aren't cut off mid-report-generation.
//
// termEndDateMs: epoch ms of when the CURRENT term actually ends
//   (e.g. derived from school.nextTermBegins minus a day, or set
//   explicitly by the admin/super admin).
// graceDays: extra days after term end before access is restricted —
//   covers late report generation, not a payment delay tactic.
export function computeTermBasedExpiry(termEndDateMs, graceDays = 7) {
  if (!termEndDateMs || typeof termEndDateMs !== 'number') return null;
  return termEndDateMs + graceDays * 24 * 60 * 60 * 1000;
}

// Helper — get termly saving vs paying monthly for a full 3-month term
export function getTermlySaving(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.price) return 0;
  const monthly3 = plan.price * 3;
  const termly    = plan.termlyPrice || Math.round(plan.price * 2.5);
  return monthly3 - termly;
}

// ── TRIAL MILESTONE CHECK ─────────────────────────────────────────
// Called by generateResults() and finalizeResults() in scoreService.js
// the moment either milestone happens, for a school still on trial.
// Ends the trial immediately (sets status to 'trial_ended') rather than
// waiting for the 21-day calendar bound.
// GUARANTEE: only ever affects the FREE TRIAL. Starter, Pro, and Premium
// (any paid plan) NEVER end early because of usage — a school can generate
// results as many times as they want, all term long. Paid plans end on
// ONE thing only: their actual term-end date (see getSubscriptionStatus()
// below, which is pure date-math for any plan other than 'trial'). The
// `sub.plan !== 'trial'` check below is what enforces that guarantee —
// do not weaken or remove it; doing so would make a paid plan behave
// like the trial, which is exactly the bug this comment exists to prevent.
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
  // 'none' — no subscription document exists at all — used to fall
  // through here uncaught, which meant a missing subscription was treated
  // as FULL, UNRESTRICTED ACCESS rather than blocked. This happens
  // whenever account creation is interrupted partway (e.g. registerAdmin()
  // succeeds but the follow-up startFreeTrial() call fails or the network
  // drops) — the Firebase Auth account and school/profile already exist
  // and work, there's just no plan tracking it at all, making it
  // completely invisible to super admin. Treating 'none' as read-only
  // closes that gap regardless of which step of signup failed.
  return ['grace', 'expired', 'suspended', 'trial_ended', 'pending_approval', 'rejected', 'deletion_requested', 'none'].includes(status);
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
