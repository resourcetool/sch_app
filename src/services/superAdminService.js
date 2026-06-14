// src/services/superAdminService.js

import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, query, orderBy, where
} from 'firebase/firestore';
import { db } from './firebase';
import { PLANS } from './subscriptionService';

// ── SUPER ADMIN IDENTITY ──────────────────────────────────────────
const SA_EMAILS_RAW = import.meta.env.VITE_SUPER_ADMIN_EMAILS || '';
export const SUPER_ADMIN_EMAILS = SA_EMAILS_RAW
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

if (import.meta.env.VITE_SUPER_ADMIN_EMAIL) {
  const legacy = import.meta.env.VITE_SUPER_ADMIN_EMAIL.trim().toLowerCase();
  if (legacy && !SUPER_ADMIN_EMAILS.includes(legacy)) {
    SUPER_ADMIN_EMAILS.push(legacy);
  }
}

export function isSuperAdmin(email) {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// ── SECURE CODE GENERATION ────────────────────────────────────────
function generateSecureCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const all = Array.from(randomBytes).map(b => chars[b % chars.length]).join('');
  return `${all.slice(0,3)}-${all.slice(3,7)}-${all.slice(7,10)}`;
}

function generateSecureId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

// ── EMAILJS NOTIFICATION ──────────────────────────────────────────
// FIX: EmailJS free plan does NOT support dynamic to_email.
// The recipient must be fixed in the EmailJS template itself.
// We send one email per SA email address instead.
export async function sendAccessRequestNotification(requestData) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS] Not configured — set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY');
    return;
  }

  const submittedAt = new Date(requestData.submittedAt).toLocaleString('en-GH', {
    dateStyle: 'full', timeStyle: 'short'
  });

  // Template params — these match {{variable}} in your EmailJS template
  const templateParams = {
    school_name:   requestData.schoolName   || 'N/A',
    admin_name:    requestData.adminName    || 'N/A',
    email:         requestData.email        || 'N/A',
    phone:         requestData.phone        || 'N/A',
    school_type:   requestData.schoolType   || 'N/A',
    region:        requestData.region       || 'N/A',
    plan:          (requestData.plan || 'pro').toUpperCase(),
    student_count: requestData.studentCount || 'N/A',
    message:       requestData.message      || 'None',
    submitted_at:  submittedAt,
    // reply_to lets you reply directly to the school
    reply_to:      requestData.email || '',
  };

  try {
    const emailjs = await import('@emailjs/browser');

    // Send to each SA email separately — works on EmailJS free plan
    // In your EmailJS template, set "To Email" to YOUR email (hardcoded).
    // The school's details appear in the body via {{variable}} placeholders.
    for (const saEmail of SUPER_ADMIN_EMAILS) {
      await emailjs.default.send(
        serviceId,
        templateId,
        // Pass sa_email so template can use {{sa_email}} if needed
        { ...templateParams, sa_email: saEmail },
        publicKey
      );
    }
    console.info('[EmailJS] Notification sent to:', SUPER_ADMIN_EMAILS);
  } catch (err) {
    // Non-blocking — log only
    console.error('[EmailJS] Failed (non-blocking):', err.text || err.message);
  }
}

// ── REGISTRATION CODES ────────────────────────────────────────────
export async function createRegistrationCode(schoolName, plan, createdByEmail) {
  const code = generateSecureCode();
  const id   = generateSecureId('code');
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000;

  const codeData = {
    id, code,
    schoolName: schoolName.trim(),
    plan,
    status:    'active',
    createdBy: createdByEmail,
    createdAt: Date.now(),
    expiresAt,
    usedBy: null,
    usedAt: null
  };

  await setDoc(doc(db, 'registrationCodes', id), codeData);
  return codeData;
}

export async function validateCode(code, schoolName) {
  if (!code || !schoolName) return { valid: false, reason: 'Code and school name are required' };

  const q = query(
    collection(db, 'registrationCodes'),
    where('code', '==', code.toUpperCase().trim())
  );
  const snap = await getDocs(q);
  if (snap.empty) return { valid: false, reason: 'Code not found. Check the code and try again.' };

  const data = { id: snap.docs[0].id, ...snap.docs[0].data() };

  if (data.status === 'used')    return { valid: false, reason: 'This code has already been used.' };
  if (data.status === 'expired') return { valid: false, reason: 'This code has expired.' };
  if (Date.now() > data.expiresAt) {
    await updateDoc(doc(db, 'registrationCodes', data.id), { status: 'expired' });
    return { valid: false, reason: 'This code has expired (48-hour limit). Request a new one.' };
  }

  const codeName  = data.schoolName.toLowerCase().replace(/\s+/g, '');
  const inputName = schoolName.toLowerCase().replace(/\s+/g, '');
  const minLen    = Math.min(4, codeName.length, inputName.length);
  const match     = inputName.includes(codeName.slice(0, minLen)) ||
                    codeName.includes(inputName.slice(0, minLen));
  if (!match) {
    return { valid: false, reason: 'School name does not match this code. Contact your provider.' };
  }

  return { valid: true, data };
}

export async function markCodeUsed(codeId, schoolId, schoolName) {
  await updateDoc(doc(db, 'registrationCodes', codeId), {
    status: 'used', usedBy: schoolId, usedByName: schoolName, usedAt: Date.now()
  });
}

// ── SUBSCRIPTION MANAGEMENT ───────────────────────────────────────
export async function activateSchool(schoolId, schoolName, plan, adminEmail, paymentRef, amountPaid, notes) {
  const planData  = PLANS[plan] || PLANS.starter;
  const now       = Date.now();
  const expiresAt = now + planData.durationDays * 24 * 60 * 60 * 1000;

  const subscription = {
    id: schoolId, schoolId, schoolName, plan,
    status: 'active',
    backupAddon: plan === 'premium',
    activatedAt: now, expiresAt, renewedAt: now,
    adminEmail, notes: [],
    paymentHistory: [{ ref: paymentRef, amount: amountPaid, plan, date: now, notes: notes || '' }]
  };

  await setDoc(doc(db, 'subscriptions', schoolId), subscription);
  return subscription;
}

export async function renewSubscription(schoolId, plan, paymentRef, amountPaid, notes, backupAddon = false) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) throw new Error('School subscription not found');

  const existing  = snap.data();
  const planData  = PLANS[plan] || PLANS[existing.plan] || PLANS.starter;
  const now       = Date.now();
  const baseDate  = existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = baseDate + planData.durationDays * 24 * 60 * 60 * 1000;

  const updated = {
    plan, status: 'active',
    backupAddon: plan === 'premium' || backupAddon,
    expiresAt, renewedAt: now,
    paymentHistory: [
      ...(existing.paymentHistory || []),
      { ref: paymentRef, amount: amountPaid, plan, date: now, notes: notes || '' }
    ]
  };

  await updateDoc(doc(db, 'subscriptions', schoolId), updated);
  return { ...existing, ...updated };
}

export async function suspendSchool(schoolId, reason) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status: 'suspended', suspendedAt: Date.now(), suspendReason: reason
  });
}

export async function unsuspendSchool(schoolId) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status: 'active', suspendedAt: null, suspendReason: null
  });
}

export async function toggleBackupAddon(schoolId, enabled) {
  await updateDoc(doc(db, 'subscriptions', schoolId), { backupAddon: enabled });
}

export async function addSuperAdminNote(schoolId, note, adminEmail) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) return;
  const existing = snap.data();
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    notes: [...(existing.notes || []), { text: note, by: adminEmail, at: Date.now() }]
  });
}

// ── FETCH DATA ────────────────────────────────────────────────────
export async function getAllSchools() {
  const [schoolsSnap, subsSnap] = await Promise.all([
    getDocs(collection(db, 'schools')),
    getDocs(collection(db, 'subscriptions'))
  ]);

  const subMap = {};
  subsSnap.docs.forEach(d => { subMap[d.id] = d.data(); });

  return schoolsSnap.docs.map(d => ({
    ...d.data(), id: d.id,
    subscription: subMap[d.id] || null
  }));
}

export async function getAllCodes() {
  try {
    // FIX: avoid orderBy to skip index requirement — sort client-side
    const snap = await getDocs(collection(db, 'registrationCodes'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error('getAllCodes error:', err.message);
    return [];
  }
}

export async function getSchoolDetails(schoolId) {
  const [schoolSnap, subSnap] = await Promise.all([
    getDoc(doc(db, 'schools', schoolId)),
    getDoc(doc(db, 'subscriptions', schoolId))
  ]);
  return {
    school:       schoolSnap.exists() ? { id: schoolId, ...schoolSnap.data() } : null,
    subscription: subSnap.exists()    ? subSnap.data() : null
  };
}

// ── ACCESS REQUESTS ───────────────────────────────────────────────
export async function submitAccessRequest(data) {
  const id = generateSecureId('req');
  const requestData = {
    id, ...data,
    status:      'pending',
    submittedAt: Date.now()
  };

  await setDoc(doc(db, 'accessRequests', id), requestData);

  // Non-blocking email
  sendAccessRequestNotification(requestData).catch(err =>
    console.error('[EmailJS] Background error:', err)
  );

  return id;
}

export async function getAllAccessRequests() {
  try {
    // FIX: No orderBy — avoids missing index error. Sort client-side.
    const snap = await getDocs(collection(db, 'accessRequests'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  } catch (err) {
    console.error('getAllAccessRequests error:', err.message);
    return [];
  }
}

export async function updateRequestStatus(requestId, status) {
  await updateDoc(doc(db, 'accessRequests', requestId), {
    status, updatedAt: Date.now()
  });
}
