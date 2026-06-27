// src/services/trialExpiryService.js
//
// NEW FILE — Sends EmailJS notifications to school admins when their
// free trial is approaching expiry (7 days, 3 days, 1 day before end).
//
// Called from:
//   1. SuperAdmin panel → "Send Expiry Warnings" button
//   2. Automatically each time super admin loads the Schools tab
//      (only sends if not already sent for the current threshold)
//
// EmailJS template variables sent:
//   {{to_email}}       — school admin email
//   {{school_name}}    — school's name
//   {{days_remaining}} — number of days left
//   {{expiry_date}}    — formatted expiry date
//   {{plan_name}}      — e.g. "Free Trial"
//   {{upgrade_link}}   — link to contact/upgrade (WhatsApp deep link)
//   {{contact_phone}}  — support WhatsApp number

import { db }                    from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const SUPPORT_PHONE       = '233549548274';
const SUPPORT_WHATSAPP    = `https://wa.me/${SUPPORT_PHONE}`;
const EXPIRY_THRESHOLDS   = [7, 3, 1]; // days before expiry to send warning

/**
 * Sends a trial-expiry warning email via EmailJS to a single school admin.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendTrialExpiryEmail(toEmail, schoolName, daysRemaining, expiryDate) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_EXPIRY ||
                     import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[TrialExpiry] EmailJS not configured — skipping expiry notification.');
    return false;
  }

  const expiryFormatted = new Date(expiryDate).toLocaleDateString('en-GH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const upgradeLink = `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Hello, I'd like to upgrade my SchoolMS subscription for ${schoolName} before my trial expires on ${expiryFormatted}.`
  )}`;

  const urgencyLabel = daysRemaining <= 1
    ? '🚨 URGENT — Expires Tomorrow!'
    : daysRemaining <= 3
    ? '⚠️ Trial Expiring Soon'
    : '📅 Trial Expiry Reminder';

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  serviceId,
        template_id: templateId,
        user_id:     publicKey,
        template_params: {
          to_email:       toEmail,
          school_name:    schoolName,
          days_remaining: daysRemaining.toString(),
          expiry_date:    expiryFormatted,
          plan_name:      'Free Trial',
          upgrade_link:   upgradeLink,
          contact_phone:  '0549548274',
          subject:        `${urgencyLabel} — ${schoolName}`,
          message:        buildExpiryMessage(schoolName, daysRemaining, expiryFormatted, upgradeLink),
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[TrialExpiry] EmailJS failed for ${toEmail}: ${response.status} — ${text}`);
      return false;
    }

    console.log(`[TrialExpiry] Warning sent to ${toEmail} (${daysRemaining}d remaining)`);
    return true;
  } catch (err) {
    console.error(`[TrialExpiry] Network error for ${toEmail}:`, err);
    return false;
  }
}

function buildExpiryMessage(schoolName, daysRemaining, expiryDate, upgradeLink) {
  const urgency = daysRemaining <= 1
    ? 'Your trial expires TOMORROW. After expiry, your account will be set to read-only and you will not be able to add new data.'
    : daysRemaining <= 3
    ? `Your trial expires in ${daysRemaining} days (${expiryDate}). Act now to keep full access.`
    : `Your free trial will expire in ${daysRemaining} days on ${expiryDate}.`;

  return [
    `Dear ${schoolName} Administrator,`,
    '',
    urgency,
    '',
    'To continue using SchoolMS without interruption:',
    '• Contact us on WhatsApp: 0549548274',
    '• Or click this link to message us directly: ' + upgradeLink,
    '',
    'Plans start from GHS 150/month. Your data is always preserved — nothing is deleted when a trial ends.',
    '',
    'Thank you for using SchoolMS.',
    'The SchoolMS Team',
  ].join('\n');
}

/**
 * Checks all trial subscriptions and sends expiry warnings for schools
 * whose trials are within the threshold days of expiring.
 *
 * Tracks sent warnings in the subscription document to avoid duplicates.
 * Returns a summary of what was sent.
 *
 * @param {Array} schools — from getAllSchools() — each has { id, name, subscription }
 */
export async function checkAndSendTrialExpiryWarnings(schools) {
  const now    = Date.now();
  const results = { sent: [], skipped: [], failed: [] };

  const trialSchools = schools.filter(s =>
    s.subscription?.isTrial &&
    s.subscription?.status === 'active' &&
    s.subscription?.expiresAt
  );

  for (const school of trialSchools) {
    const sub           = school.subscription;
    const msRemaining   = sub.expiresAt - now;
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    // Only warn for schools within our threshold windows
    if (daysRemaining < 0 || daysRemaining > Math.max(...EXPIRY_THRESHOLDS)) {
      results.skipped.push({ school: school.name, reason: `${daysRemaining}d remaining — outside warning window` });
      continue;
    }

    // Find the matching threshold (closest one not yet sent)
    const threshold = EXPIRY_THRESHOLDS
      .filter(t => daysRemaining <= t)
      .sort((a, b) => a - b)[0];

    if (!threshold) continue;

    // Check if we've already sent this threshold's warning
    const sentWarnings = sub.expirySentWarnings || {};
    const warningKey   = `days_${threshold}`;
    if (sentWarnings[warningKey]) {
      results.skipped.push({ school: school.name, reason: `${threshold}d warning already sent` });
      continue;
    }

    const adminEmail = sub.adminEmail || sub.trialEmail;
    if (!adminEmail) {
      results.failed.push({ school: school.name, reason: 'No admin email on file' });
      continue;
    }

    const sent = await sendTrialExpiryEmail(adminEmail, school.name, daysRemaining, sub.expiresAt);

    if (sent) {
      // Mark this threshold as sent so we don't duplicate
      try {
        await updateDoc(doc(db, 'subscriptions', school.id), {
          expirySentWarnings: { ...sentWarnings, [warningKey]: Date.now() },
        });
      } catch (err) {
        console.warn('[TrialExpiry] Could not mark warning as sent:', err.message);
      }
      results.sent.push({ school: school.name, email: adminEmail, daysRemaining, threshold });
      // Small delay to avoid hitting EmailJS rate limits
      await new Promise(r => setTimeout(r, 400));
    } else {
      results.failed.push({ school: school.name, email: adminEmail, reason: 'EmailJS send failed' });
    }
  }

  return results;
}
