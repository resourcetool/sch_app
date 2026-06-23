// src/utils/validation.js
// Centralised validation helpers used across signup, login, and settings.

// ── PASSWORD STRENGTH ─────────────────────────────────────────────
export function checkPasswordStrength(password) {
  const errors = [];
  if (!password) return { score: 0, label: 'Too short', color: '#ef5350', errors: ['Enter a password'] };
  if (password.length < 8)                        errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password))                    errors.push('One uppercase letter (A-Z)');
  if (!/[0-9]/.test(password))                    errors.push('One number (0-9)');
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password))
                                                   errors.push('One special character e.g. !@#$');
  const score = 4 - errors.length;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef5350', '#ff7043', '#ffa726', '#66bb6a', '#43a047'];
  return { score: Math.max(0, score), label: labels[Math.max(0, score)], color: colors[Math.max(0, score)], errors };
}

// ── GHANA PHONE VALIDATION ────────────────────────────────────────
const GHANA_PREFIXES = [
  '020','023','024','025','026','027','028',
  '050','053','054','055','056','057','059',
];
export function validateGhanaPhone(raw) {
  if (!raw) return { valid: false, error: 'Phone number is required' };
  const digits = raw.replace(/\D/g, '');
  let local;
  if (digits.startsWith('233') && digits.length === 12) local = '0' + digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 10) local = digits;
  else return { valid: false, error: 'Enter a valid Ghana mobile number (e.g. 024XXXXXXX or 0541234567)' };
  const prefix = local.substring(0, 3);
  if (!GHANA_PREFIXES.includes(prefix))
    return { valid: false, error: `"${prefix}" is not a recognised Ghana mobile prefix. Valid: 020/024/026/027/028/050/054/055/056/057/059` };
  return { valid: true, normalised: local };
}

// ── EMAIL VALIDATION ──────────────────────────────────────────────
export function validateEmail(email) {
  if (!email?.trim()) return { valid: false, error: 'Email is required' };
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email.trim())) return { valid: false, error: 'Enter a valid email address (e.g. name@school.edu.gh)' };
  const domain = email.split('@')[1]?.toLowerCase();
  const blocked = ['mailinator.com','guerrillamail.com','temp-mail.org','throwaway.email',
    'yopmail.com','sharklasers.com','trashmail.com','fakeinbox.com'];
  if (blocked.includes(domain)) return { valid: false, error: 'Disposable/temporary email addresses are not accepted' };
  return { valid: true };
}

// ── SCHOOL NAME VALIDATION ────────────────────────────────────────
export function validateSchoolName(name) {
  if (!name?.trim()) return { valid: false, error: 'School name is required' };
  if (name.trim().length < 3) return { valid: false, error: 'School name must be at least 3 characters' };
  if (/^(test|fake|demo|abc|xyz|asdf|qwerty|school\s*1?$)/i.test(name.trim()))
    return { valid: false, error: "Please enter your school's real name" };
  return { valid: true };
}
