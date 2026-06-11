// src/services/subscriptionService.js
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
    durationDays: 30,
    features: {
      backup: false,
      analytics: true,
      promotion: true,
      watermark: true,     // PDFs have watermark
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

// ── SUBSCRIPTION STATUS ───────────────────────────────────────────
export function getSubscriptionStatus(subscription) {
  if (!subscription) return 'none';
  const now = Date.now();
  const expiry = subscription.expiresAt;

  if (subscription.status === 'suspended') return 'suspended';
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
  // Try IDB first
  let sub = await idbGet('subscriptions', schoolId);

  // Pull from Firestore if online
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
  if (status === 'suspended') return false;
  if (status === 'expired') return false;

  const plan = PLANS[subscription.plan] || PLANS.trial;

  // During grace period — read-only, no feature access
  if (status === 'grace') return false;

  // Check backup add-on separately
  if (feature === 'backup') {
    return plan.features.backup || subscription.backupAddon === true;
  }

  return plan.features[feature] === true;
}

export function isReadOnly(subscription) {
  const status = getSubscriptionStatus(subscription);
  return status === 'grace' || status === 'expired' || status === 'suspended';
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
  if (status === 'grace' || status === 'expired') return true;
  return plan.features.watermark === true;
}
