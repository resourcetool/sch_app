// src/services/superAdminService.js
// CHANGED: Multiple super admin emails, secure crypto code generation,
//          full Firestore operations for SA, EmailJS notification support

import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, query, orderBy, where, addDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { PLANS } from './subscriptionService';

// ── SUPER ADMIN IDENTITY ──────────────────────────────────────────
// Supports multiple comma-separated emails
const SA_EMAILS_RAW = import.meta.env.VITE_SUPER_ADMIN_EMAILS || '';
export const SUPER_ADMIN_EMAILS = SA_EMAILS_RAW
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Fallback to old single-email env var for backwards compatibility
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
// Replaces Math.random() with crypto.getRandomValues() — requirement #3
function generateSecureCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const seg = (bytes) =>
    Array.from(bytes)
      .map(b => chars[b % chars.length])
      .join('');
  // Format: XXX-XXXX-XXX (10 chars, 2 separators)
  const all = seg(randomBytes);
  return `${all.slice(0, 3)}-${all.slice(3, 7)}-${all.slice(7, 10)}`;
}

function generateSecureId(prefix = 'id') {
  // crypto.randomUUID() — requirement #3
  return `${prefix}_${crypto.randomUUID()}`;
}

// ── EMAILJS NOTIFICATION ──────────────────────────────────────────
// Sends notification to all super admin emails when a request comes in
// Requirement #1 — failures must NOT prevent request from being saved
export async function sendAccessRequestNotification(requestData) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS] Not configured — skipping notification. Set VITE_EMAILJS_* env vars.');
    return;
  }

  const submittedAt = new Date(requestData.submittedAt).toLocaleString('en-GH', {
    dateStyle: 'full', timeStyle: 'short'
  });

  const templateParams = {
    school_name:    requestData.schoolName    || 'N/A',
    admin_name:     requestData.adminName     || 'N/A',
    email:          requestData.email         || 'N/A',
    phone:          requestData.phone         || 'N/A',
    school_type:    requestData.schoolType    || 'N/A',
    region:         requestData.region        || 'N/A',
    plan:           (requestData.plan || 'pro').toUpperCase(),
    student_count:  requestData.studentCount  || 'N/A',
    message:        requestData.message       || 'None',
    submitted_at:   submittedAt,
    // Send to all SA emails — EmailJS template can use {{to_email}}
    to_email:       SUPER_ADMIN_EMAILS.join(', '),
    reply_to:       requestData.email         || SUPER_ADMIN_EMAILS[0] || '',
  };

  try {
    // Dynamic import so EmailJS doesn't crash if keys are missing
    const emailjs = await import('@emailjs/browser');
    await emailjs.default.send(serviceId, templateId, templateParams, publicKey);
    console.info('[EmailJS] Access request notification sent to:', SUPER_ADMIN_EMAILS);
  } catch (err) {
    // Log but do NOT re-throw — requirement #1
    console.error('[EmailJS] Notification failed (non-blocking):', err.message);
  }
}

// ── REGISTRATION CODE ─────────────────────────────────────────────
export async function createRegistrationCode(schoolName, plan, createdByEmail) {
  const code = generateSecureCode();
  const id   = generateSecureId('code');
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  const codeData = {
    id,
    code,
    schoolName: schoolName.trim(),
    plan,
    status:     'active', // active | used | expired
    createdBy:  createdByEmail,
    createdAt:  Date.now(),
    expiresAt,
    usedBy:     null,
    usedAt:     null
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
    return { valid: false, reason: 'This code has expired (48-hour limit). Request a new code.' };
  }

  // Fuzzy school name match — first 4 chars, case-insensitive
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
    status:     'used',
    usedBy:     schoolId,
    usedByName: schoolName,
    usedAt:     Date.now()
  });
}

// ── SUBSCRIPTION MANAGEMENT ───────────────────────────────────────
export async function activateSchool(schoolId, schoolName, plan, adminEmail, paymentRef, amountPaid, notes) {
  const planData  = PLANS[plan] || PLANS.starter;
  const now       = Date.now();
  const expiresAt = now + planData.durationDays * 24 * 60 * 60 * 1000;

  const subscription = {
    id: schoolId,
    schoolId,
    schoolName,
    plan,
    status:      'active',
    backupAddon: plan === 'premium',
    activatedAt: now,
    expiresAt,
    renewedAt:   now,
    adminEmail,
    notes:       [],
    paymentHistory: [{
      ref:    paymentRef,
      amount: amountPaid,
      plan,
      date:   now,
      notes:  notes || ''
    }]
  };

  await setDoc(doc(db, 'subscriptions', schoolId), subscription);
  return subscription;
}

export async function renewSubscription(schoolId, plan, paymentRef, amountPaid, notes, backupAddon = false) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) throw new Error('School subscription not found');

  const existing = snap.data();
  const planData  = PLANS[plan] || PLANS[existing.plan] || PLANS.starter;
  const now       = Date.now();
  const baseDate  = existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = baseDate + planData.durationDays * 24 * 60 * 60 * 1000;

  const updated = {
    plan,
    status:      'active',
    backupAddon: plan === 'premium' || backupAddon,
    expiresAt,
    renewedAt:   now,
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
    status:        'suspended',
    suspendedAt:   Date.now(),
    suspendReason: reason
  });
}

export async function unsuspendSchool(schoolId) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status:        'active',
    suspendedAt:   null,
    suspendReason: null
  });
}

export async function toggleBackupAddon(schoolId, enabled) {
  await updateDoc(doc(db, 'subscriptions', schoolId), { backupAddon: enabled });
}

// ── FETCH ALL DATA ────────────────────────────────────────────────
export async function getAllSchools() {
  const [schoolsSnap, subsSnap] = await Promise.all([
    getDocs(collection(db, 'schools')),
    getDocs(collection(db, 'subscriptions'))
  ]);

  const subMap = {};
  subsSnap.docs.forEach(d => { subMap[d.id] = d.data(); });

  return schoolsSnap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    subscription: subMap[d.id] || null
  }));
}

export async function getAllCodes() {
  try {
    const snap = await getDocs(
      query(collection(db, 'registrationCodes'), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllCodes error:', err);
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

export async function addSuperAdminNote(schoolId, note, adminEmail) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) return;
  const existing = snap.data();
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    notes: [...(existing.notes || []), { text: note, by: adminEmail, at: Date.now() }]
  });
}

// ── ACCESS REQUESTS ───────────────────────────────────────────────
export async function submitAccessRequest(data) {
  const id = generateSecureId('req');
  const requestData = {
    id,
    ...data,
    status:      'pending',
    submittedAt: Date.now()
  };

  // 1. Save to Firestore
  await setDoc(doc(db, 'accessRequests', id), requestData);

  // 2. Send EmailJS notification — non-blocking, failures are logged not thrown
  sendAccessRequestNotification(requestData).catch(err =>
    console.error('[EmailJS] Background notification error:', err)
  );

  return id;
}

export async function getAllAccessRequests() {
  try {
    const snap = await getDocs(
      query(collection(db, 'accessRequests'), orderBy('submittedAt', 'desc'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getAllAccessRequests error:', err);
    return [];
  }
}

export async function updateRequestStatus(requestId, status) {
  await updateDoc(doc(db, 'accessRequests', requestId), {
    status,
    updatedAt: Date.now()
  });
}
