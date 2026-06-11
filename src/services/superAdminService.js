// src/services/superAdminService.js
import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from './firebase';
import { PLANS } from './subscriptionService';

// Your email — hardcoded as the only super admin
export const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'your@email.com';

export function isSuperAdmin(email) {
  return email === SUPER_ADMIN_EMAIL;
}

// ── CODE GENERATION ───────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1 — confusing
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

export async function createRegistrationCode(schoolName, plan, createdByEmail) {
  const code = generateCode();
  const id = `code_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  const doc_data = {
    id,
    code,
    schoolName: schoolName.trim(),
    plan,
    status: 'active',       // active | used | expired
    createdBy: createdByEmail,
    createdAt: Date.now(),
    expiresAt,
    usedBy: null,
    usedAt: null
  };

  await setDoc(doc(db, 'registrationCodes', id), doc_data);
  return doc_data;
}

export async function validateCode(code, schoolName) {
  const q = query(collection(db, 'registrationCodes'), where('code', '==', code.toUpperCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return { valid: false, reason: 'Code not found' };

  const data = { id: snap.docs[0].id, ...snap.docs[0].data() };

  if (data.status === 'used') return { valid: false, reason: 'This code has already been used' };
  if (data.status === 'expired') return { valid: false, reason: 'This code has expired' };
  if (Date.now() > data.expiresAt) {
    await updateDoc(doc(db, 'registrationCodes', data.id), { status: 'expired' });
    return { valid: false, reason: 'This code has expired (48 hour limit)' };
  }

  // Check school name matches (case-insensitive, partial)
  const codeName = data.schoolName.toLowerCase().replace(/\s/g, '');
  const inputName = schoolName.toLowerCase().replace(/\s/g, '');
  if (!inputName.includes(codeName.substring(0, 4)) && !codeName.includes(inputName.substring(0, 4))) {
    return { valid: false, reason: 'School name does not match the code. Contact your provider.' };
  }

  return { valid: true, data };
}

export async function markCodeUsed(codeId, schoolId, schoolName) {
  await updateDoc(doc(db, 'registrationCodes', codeId), {
    status: 'used',
    usedBy: schoolId,
    usedByName: schoolName,
    usedAt: Date.now()
  });
}

// ── SUBSCRIPTION MANAGEMENT ───────────────────────────────────────
export async function activateSchool(schoolId, schoolName, plan, adminEmail, paymentRef, amountPaid, notes) {
  const plan_data = PLANS[plan] || PLANS.starter;
  const now = Date.now();
  const expiresAt = now + plan_data.durationDays * 24 * 60 * 60 * 1000;

  const subscription = {
    id: schoolId,
    schoolId,
    schoolName,
    plan,
    status: 'active',
    backupAddon: plan === 'premium', // premium includes backup
    activatedAt: now,
    expiresAt,
    renewedAt: now,
    adminEmail,
    paymentHistory: [{
      ref: paymentRef,
      amount: amountPaid,
      plan,
      date: now,
      notes
    }]
  };

  await setDoc(doc(db, 'subscriptions', schoolId), subscription);
  return subscription;
}

export async function renewSubscription(schoolId, plan, paymentRef, amountPaid, notes, backupAddon = false) {
  const snap = await getDoc(doc(db, 'subscriptions', schoolId));
  if (!snap.exists()) throw new Error('School subscription not found');

  const existing = snap.data();
  const plan_data = PLANS[plan] || PLANS[existing.plan];
  const now = Date.now();

  // Extend from now OR from current expiry if still active
  const baseDate = existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = baseDate + plan_data.durationDays * 24 * 60 * 60 * 1000;

  const updated = {
    plan,
    status: 'active',
    backupAddon: plan === 'premium' || backupAddon,
    expiresAt,
    renewedAt: now,
    paymentHistory: [
      ...(existing.paymentHistory || []),
      { ref: paymentRef, amount: amountPaid, plan, date: now, notes }
    ]
  };

  await updateDoc(doc(db, 'subscriptions', schoolId), updated);
  return { ...existing, ...updated };
}

export async function suspendSchool(schoolId, reason) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status: 'suspended',
    suspendedAt: Date.now(),
    suspendReason: reason
  });
}

export async function unsuspendSchool(schoolId) {
  await updateDoc(doc(db, 'subscriptions', schoolId), {
    status: 'active',
    suspendedAt: null,
    suspendReason: null
  });
}

export async function toggleBackupAddon(schoolId, enabled) {
  await updateDoc(doc(db, 'subscriptions', schoolId), { backupAddon: enabled });
}

// ── FETCH ALL DATA FOR SUPER ADMIN ────────────────────────────────
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
  const snap = await getDocs(query(collection(db, 'registrationCodes'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSchoolDetails(schoolId) {
  const [schoolSnap, subSnap] = await Promise.all([
    getDoc(doc(db, 'schools', schoolId)),
    getDoc(doc(db, 'subscriptions', schoolId))
  ]);

  return {
    school: schoolSnap.exists() ? { id: schoolId, ...schoolSnap.data() } : null,
    subscription: subSnap.exists() ? subSnap.data() : null
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

// ── REQUEST ACCESS (School contacts you) ──────────────────────────
export async function submitAccessRequest(data) {
  const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  await setDoc(doc(db, 'accessRequests', id), {
    id,
    ...data,
    status: 'pending',
    submittedAt: Date.now()
  });
  return id;
}

export async function getAllAccessRequests() {
  const snap = await getDocs(query(collection(db, 'accessRequests'), orderBy('submittedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateRequestStatus(requestId, status) {
  await updateDoc(doc(db, 'accessRequests', requestId), { status, updatedAt: Date.now() });
}
