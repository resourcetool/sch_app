// src/services/superAdminService.js
//
// Changes:
// - Replaced Math.random()-based code generation with crypto.getRandomValues() (secure).
// - Replaced Math.random()-based ID generation with crypto.randomUUID().
// - Added isSuperAdmin() that supports multiple emails from VITE_SUPER_ADMIN_EMAILS env var.
// - Added getSuperAdminEmails() helper for EmailJS notification targets.
// - Added sendAccessRequestNotification() using EmailJS (failure-safe).
// - submitAccessRequest() now triggers the email notification after saving.
// - Firestore reads for super-admin collections (accessRequests, registrationCodes, subscriptions)
//   work because the updated Firestore rules grant access when request.auth.token.email is in
//   the super-admin list (enforced at rule level via the custom claim pattern documented in README).

import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from './firebase';
import { PLANS } from './subscriptionService';

// ── SUPER ADMIN CONFIG ────────────────────────────────────────────

/**
 * Returns the array of super-admin email addresses configured via env.
 * Supports a single email (legacy VITE_SUPER_ADMIN_EMAIL) or a
 * comma-separated list (VITE_SUPER_ADMIN_EMAILS).
 */
export function getSuperAdminEmails() {
  const multi = import.meta.env.VITE_SUPER_ADMIN_EMAILS || '';
  const single = import.meta.env.VITE_SUPER_ADMIN_EMAIL || '';
  const raw = multi || single;
  return raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email) {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}

// ── SECURE CODE GENERATION ────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1

/**
 * Returns a cryptographically-random character from CODE_CHARS.
 * Uses rejection sampling to avoid modulo bias.
 */
function randomChar() {
  const max = 256 - (256 % CODE_CHARS.length);
  const buf = new Uint8Array(1);
  let val;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= max);
  return CODE_CHARS[val % CODE_CHARS.length];
}

function generateCode() {
  // Format: XXX-XXXX-XXX  (10 meaningful chars)
  const seg = (n) => Array.from({ length: n }, randomChar).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

// ── EMAILJS NOTIFICATION ─────────────────────────────────────────

/**
 * Sends an email notification to every super-admin address via EmailJS.
 * Failures are logged but do NOT throw — request saving must not be blocked.
 *
 * EmailJS template variables expected:
 *   {{to_email}}, {{school_name}}, {{admin_name}}, {{email}},
 *   {{phone}}, {{school_type}}, {{region}}, {{plan}}, {{submitted_at}}
 */
export async function sendAccessRequestNotification(requestData) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS] Not configured — skipping access-request notification.');
    return;
  }

  const adminEmails = getSuperAdminEmails();
  if (adminEmails.length === 0) {
    console.warn('[EmailJS] No super-admin emails configured.');
    return;
  }

  const submittedAt = new Date(requestData.submittedAt || Date.now()).toLocaleString('en-GH', {
    dateStyle: 'medium', timeStyle: 'short'
  });

  const planLabels = {
    starter: 'Starter — GHS 150/month',
    pro:     'Pro — GHS 250/month',
    premium: 'Premium — GHS 400/month',
  };

  const templateParams = {
    school_name:  requestData.schoolName  || '—',
    admin_name:   requestData.adminName   || '—',
    email:        requestData.email       || '—',
    phone:        requestData.phone       || '—',
    school_type:  requestData.schoolType  || '—',
    region:       requestData.region      || '—',
    plan:         planLabels[requestData.plan] || requestData.plan || '—',
    student_count: requestData.studentCount || '—',
    message:      requestData.message     || '—',
    submitted_at: submittedAt,
  };

  // Send to each super-admin email
  const sends = adminEmails.map(async (toEmail) => {
    try {
      const response = await fetch(
        `https://api.emailjs.com/api/v1.0/email/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id:  serviceId,
            template_id: templateId,
            user_id:     publicKey,
            template_params: { ...templateParams, to_email: toEmail },
          }),
        }
      );
      if (!response.ok) {
        const text = await response.text();
        console.error(`[EmailJS] Failed for ${toEmail}: ${response.status} — ${text}`);
      } else {
        console.log(`[EmailJS] Notification sent to ${toEmail}`);
      }
    } catch (err) {
      console.error(`[EmailJS] Network error for ${toEmail}:`, err);
    }
  });

  // Wait for all but don't let errors propagate
  await Promise.allSettled(sends);
}

// ── REGISTRATION CODES ────────────────────────────────────────────

export async function createRegistrationCode(schoolName, plan, createdByEmail) {
  const code = generateCode();
  const id   = crypto.randomUUID();           // secure UUID instead of Math.random
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  const doc_data = {
    id,
    code,
    schoolName: schoolName.trim(),
    plan,
    status:     'active',   // active | used | expired
    createdBy:  createdByEmail,
    createdAt:  Date.now(),
    expiresAt,
    usedBy:     null,
    usedAt:     null,
  };

  await setDoc(doc(db, 'registrationCodes', id), doc_data);
  return doc_data;
}

export async function validateCode(code, schoolName) {
  const q    = query(collection(db, 'registrationCodes'), where('code', '==', code.toUpperCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return { valid: false, reason: 'Code not found. Check the code and try again.' };

  const data = { id: snap.docs[0].id, ...snap.docs[0].data() };

  if (data.status === 'used')    return { valid: false, reason: 'This code has already been used to register a school.' };
  if (data.status === 'expired') return { valid: false, reason: 'This code has expired. Ask your provider to generate a new one.' };

  if (Date.now() > data.expiresAt) {
    await updateDoc(doc(db, 'registrationCodes', data.id), { status: 'expired' });
    return { valid: false, reason: 'This code has expired (48-hour limit). Ask your provider to generate a new one.' };
  }

  // ── SCHOOL NAME CHECK ─────────────────────────────────────────
  // Normalise both names: lowercase, strip punctuation and extra spaces.
  // Then check if either name contains the other (handles abbreviations,
  // slight differences in punctuation like "May's" vs "Mays").
  const normalise = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const codeName  = normalise(data.schoolName);
  const inputName = normalise(schoolName);

  // Split both into words and check that at least half the code's words appear in the input
  const codeWords  = codeName.split(' ').filter(Boolean);
  const inputWords = inputName.split(' ').filter(Boolean);
  const matchCount = codeWords.filter(w => inputWords.some(iw => iw.includes(w) || w.includes(iw))).length;
  const threshold  = Math.max(1, Math.ceil(codeWords.length * 0.5));

  if (matchCount < threshold) {
    return {
      valid:  false,
      reason: `School name does not match this code. The code was issued for "${data.schoolName}". Please enter your school name exactly as submitted when requesting access.`,
    };
  }

  return { valid: true, data };
}

export async function markCodeUsed(codeId, schoolId, schoolName) {
  await updateDoc(doc(db, 'registrationCodes', codeId), {
    status:      'used',
    usedBy:      schoolId,
    usedByName:  schoolName,
    usedAt:      Date.now(),
  });
}

// ── SUBSCRIPTION MANAGEMENT ───────────────────────────────────────

export async function activateSchool(schoolId, schoolName, plan, adminEmail, paymentRef, amountPaid, notes) {
  const plan_data = PLANS[plan] || PLANS.starter;
  const now       = Date.now();
  const expiresAt = now + plan_data.durationDays * 24 * 60 * 60 * 1000;

  const subscription = {
    id:           schoolId,
    schoolId,
    schoolName,
    plan,
    status:       'active',
    backupAddon:  plan === 'premium',
    activatedAt:  now,
    expiresAt,
    renewedAt:    now,
    adminEmail,
    paymentHistory: [{ ref: paymentRef, amount: amountPaid, plan, date: now, notes }],
  };

  await setDoc(doc(db, 'subscriptions', schoolId), subscription);
  return subscription;
}

// ── FREE TRIAL (self-serve, no registration code needed) ──────────
//
// Fairness & anti-fraud design:
// - One trial per email AND per phone number — checked before creating.
//   A school that already used a trial (even under a different school
//   name) cannot start a second one with the same contact details.
// - Trial subscription is created the same way a paid one is — same
//   shape, same enforcement — so there is no special "free path" that
//   bypasses normal expiry/lockout logic. It expires exactly like a
//   paid plan would, just with $0 charged.
// - No payment details are collected or stored at trial signup. There is
//   no auto-charge: MoMo has no stored-card billing, so nothing happens
//   automatically when the trial ends except read-only lockout — the
//   school always chooses if/when to pay.
export async function checkTrialEligibility(email, phone) {
  const normalisedEmail = email.trim().toLowerCase();
  const normalisedPhone = phone.replace(/\D/g, ''); // digits only

  const q1 = query(collection(db, 'subscriptions'), where('trialEmail', '==', normalisedEmail));
  const q2 = query(collection(db, 'subscriptions'), where('trialPhone', '==', normalisedPhone));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  if (!snap1.empty) {
    return { eligible: false, reason: 'A free trial has already been used with this email address.' };
  }
  if (!snap2.empty) {
    return { eligible: false, reason: 'A free trial has already been used with this phone number.' };
  }
  return { eligible: true };
}

export async function startFreeTrial(schoolId, schoolName, adminEmail, adminPhone) {
  const eligibility = await checkTrialEligibility(adminEmail, adminPhone);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }

  const plan_data = PLANS.trial;
  const now       = Date.now();
  const expiresAt = now + plan_data.durationDays * 24 * 60 * 60 * 1000;

  const subscription = {
    id:           schoolId,
    schoolId,
    schoolName,
    plan:         'trial',
    status:       'active',
    backupAddon:  false,
    activatedAt:  now,
    expiresAt,
    renewedAt:    now,
    adminEmail,
    trialEmail:   adminEmail.trim().toLowerCase(),
    trialPhone:   adminPhone.replace(/\D/g, ''),
    isTrial:      true,
    paymentHistory: [],
  };

  await setDoc(doc(db, 'subscriptions', schoolId), subscription);
  return subscription;
}

export async function renewSubscription(schoolId, plan, paymentRef, amountPaid, notes, backupAddon = false) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) throw new Error('School subscription not found');

  const existing  = snap.data();
  const plan_data = PLANS[plan] || PLANS[existing.plan];
  const now       = Date.now();
  const baseDate  = existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = baseDate + plan_data.durationDays * 24 * 60 * 60 * 1000;

  const updated = {
    plan,
    status:      'active',
    backupAddon: plan === 'premium' || backupAddon,
    expiresAt,
    renewedAt:   now,
    paymentHistory: [
      ...(existing.paymentHistory || []),
      { ref: paymentRef, amount: amountPaid, plan, date: now, notes },
    ],
  };

  await updateDoc(doc(db, 'subscriptions', schoolId), updated);
  return { ...existing, ...updated };
}

export async function suspendSchool(schoolId, reason) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status:      'suspended',
    suspendedAt: Date.now(),
    suspendReason: reason,
  });
}

export async function unsuspendSchool(schoolId) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status:        'active',
    suspendedAt:   null,
    suspendReason: null,
  });
}

export async function toggleBackupAddon(schoolId, enabled) {
  await updateDoc(doc(db, 'subscriptions', schoolId), { backupAddon: enabled });
}

// ── FETCH ALL DATA (super-admin) ──────────────────────────────────

export async function getAllSchools() {
  const [schoolsSnap, subsSnap] = await Promise.all([
    getDocs(collection(db, 'schools')),
    getDocs(collection(db, 'subscriptions')),
  ]);

  const subMap = {};
  subsSnap.docs.forEach(d => { subMap[d.id] = d.data(); });

  return schoolsSnap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    subscription: subMap[d.id] || null,
  }));
}

export async function getAllCodes() {
  const snap = await getDocs(
    query(collection(db, 'registrationCodes'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSchoolDetails(schoolId) {
  const [schoolSnap, subSnap] = await Promise.all([
    getDoc(doc(db, 'schools', schoolId)),
    getDoc(doc(db, 'subscriptions', schoolId)),
  ]);

  return {
    school:       schoolSnap.exists() ? { id: schoolId, ...schoolSnap.data() } : null,
    subscription: subSnap.exists()    ? subSnap.data()                          : null,
  };
}

export async function addSuperAdminNote(schoolId, note, adminEmail) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) return;
  const existing = snap.data();
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    notes: [...(existing.notes || []), { text: note, by: adminEmail, at: Date.now() }],
  });
}

// ── ACCESS REQUESTS ───────────────────────────────────────────────

/**
 * Saves a new access request to Firestore, then attempts to notify
 * all super-admin email addresses via EmailJS.
 * EmailJS failures are caught and logged — they never block the save.
 */
export async function submitAccessRequest(data) {
  const id           = crypto.randomUUID();
  const submittedAt  = Date.now();
  const requestData  = { id, ...data, status: 'pending', submittedAt };

  await setDoc(doc(db, 'accessRequests', id), requestData);
  console.log('[AccessRequest] Saved to Firestore:', id);

  // Fire-and-forget notification — must not block or throw
  sendAccessRequestNotification(requestData).catch(err => {
    console.error('[AccessRequest] EmailJS notification error:', err);
  });

  return id;
}

export async function getAllAccessRequests() {
  const snap = await getDocs(
    query(collection(db, 'accessRequests'), orderBy('submittedAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateRequestStatus(requestId, status, adminEmail = '') {
  await updateDoc(doc(db, 'accessRequests', requestId), {
    status,
    updatedAt:   Date.now(),
    updatedBy:   adminEmail,
  });
}

export async function deleteAccessRequest(requestId) {
  await deleteDoc(doc(db, 'accessRequests', requestId));
}
