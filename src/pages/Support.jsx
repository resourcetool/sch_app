// src/pages/Support.jsx
//
// New page — Help & Support center for Admins and Teachers.
// - Role-aware: shows different guidance depending on whether the
//   logged-in user is an admin or a teacher.
// - Step-by-step usage guides for the core workflows.
// - FAQ accordion for common questions.
// - Direct technical support contact: email + phone, with quick-action
//   buttons (mailto / tel / WhatsApp).

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SUPPORT_EMAIL = 'schoolpilot132@gmail.com';
const SUPPORT_PHONE = '0549548274';
const SUPPORT_PHONE_INTL = '233549548274'; // for wa.me links (Ghana country code, no leading 0)

// ── GUIDE STEP CARD ───────────────────────────────────────────────
function GuideStep({ number, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: 'var(--navy)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '.85rem', flexShrink: 0,
      }}>
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--navy)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '.85rem', color: 'var(--text-mid)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

// ── FAQ ACCORDION ITEM ────────────────────────────────────────────
function FaqItem({ question, answer, isOpen, onToggle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '14px 0', cursor: 'pointer', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--navy)' }}>{question}</span>
        <span style={{ fontSize: '1rem', color: 'var(--text-lt)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>
      {isOpen && (
        <div style={{ paddingBottom: 14, fontSize: '.84rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>
          {answer}
        </div>
      )}
    </div>
  );
}

// ── ADMIN GUIDE CONTENT ────────────────────────────────────────────
const ADMIN_GUIDE = [
  {
    title: '1. Set up your school',
    steps: [
      ['Add your classes', 'Go to Classes → type a class name (e.g. "JHS 1A") → click + Add Class. Use Bulk Add to add many at once, one per line.'],
      ['Add your subjects', 'Go to Subjects → type a subject name → click + Add Subject. Set Max Class Score and Max Exam Score for each (e.g. 30/70 or 50/50) — this becomes the real weighting shown on report cards.'],
      ['Assign subjects to classes', 'Open a subject\'s Edit panel and tap each class it should appear in. Or open a class\'s Edit panel and tap each subject taught there — either direction works.'],
    ],
  },
  {
    title: '2. Add students',
    steps: [
      ['Quick Add', 'On the Students page, use the Quick Add row: type First Name + Last Name, pick a class, press Enter. The student is created AND enrolled in one step.'],
      ['Bulk import', 'Click ⬆ Import Excel to upload a spreadsheet of students at once.'],
    ],
  },
  {
    title: '3. Add teachers and assign their classes',
    steps: [
      ['Quick Add a teacher', 'On the Teachers page, fill in name + email + password, click + Add. This creates their login automatically — you stay logged in as admin throughout.'],
      ['Assign classes & subjects', 'Click Edit on the teacher → tap the classes and subjects they teach. Use "Auto-assign from selected classes" to quickly fill in matching subjects. This determines exactly what the teacher can see and enter scores for — nothing else.'],
    ],
  },
  {
    title: '4. Set assessment deadlines (optional but recommended)',
    steps: [
      ['Go to Deadlines', 'Set an opening and closing date for score entry each term. You can lock entry manually at any time, or extend a deadline if needed.'],
    ],
  },
  {
    title: '5. Generate results and reports',
    steps: [
      ['Review teacher submissions', 'On the Scores page → "All Submissions" tab, you can view, edit, approve, or delete any score a teacher entered.'],
      ['Generate Results', 'On the Reports page, select a class/term and click ⚡ Generate Results. This calculates totals, averages, and positions for every enrolled student.'],
      ['Print report cards', 'Click 🖨 Print All to download every student\'s report card as a PDF, or 📄 Print for a single student.'],
      ['Customise the look', 'Click 🎨 Customise to set your school\'s colors, fonts, borders, logo, and draw or upload signatures for the Class Teacher, Counsellor, Academic Head, and Administrator.'],
    ],
  },
];

const TEACHER_GUIDE = [
  {
    title: '1. Find your class and subject',
    steps: [
      ['Go to Score Entry', 'You will only see the classes and subjects your school admin assigned to you. If you have just one subject, it\'s already selected — just pick your class.'],
      ['Multiple subjects?', 'If you teach more than one subject, you\'ll see tabs at the top — tap the subject you want to enter scores for.'],
    ],
  },
  {
    title: '2. Enter scores',
    steps: [
      ['Type directly into the grid', 'Click into any Class Score or Exam Score cell and type. Scores are automatically limited to the maximum your admin configured — you can\'t accidentally enter more than the max.'],
      ['Move fast with your keyboard', 'Press Tab to move to the next cell, Enter or ↓ to move to the next student\'s row, ↑ to go back. This works just like a spreadsheet.'],
      ['Grades update instantly', 'As you type, the Total and Grade columns update live so you can see results immediately.'],
    ],
  },
  {
    title: '3. Save your work',
    steps: [
      ['Click Save All Scores', 'Your scores are saved to the school\'s database immediately — they are visible to your admin and used in report generation right away.'],
      ['Watch for the deadline', 'If your admin has set a deadline, you\'ll see a banner showing when entry closes. After the deadline, the grid becomes read-only and you cannot make further changes — contact your admin if you need it extended.'],
    ],
  },
  {
    title: '4. View results and analytics',
    steps: [
      ['Reports page', 'You can view (but not edit) generated results for your assigned classes.'],
      ['Analytics page', 'View charts for your assigned classes — class averages, grade distribution, and individual student progress over time.'],
    ],
  },
];

// ── FAQ DATA (role-aware) ──────────────────────────────────────────
const ADMIN_FAQ = [
  { q: 'A teacher says they get a permission error when entering scores.', a: 'Make sure you have assigned at least one class AND one subject to that teacher in the Teachers page. Both must be set — a teacher with a class but no subject (or vice versa) cannot enter scores for that class.' },
  { q: 'Report generation only shows one subject for a class.', a: 'Check that all subjects for that class are properly assigned — either from the Subjects page (tap the class) or the Classes page (tap the subject). Both directions work; just make sure at least one is set for every subject.' },
  { q: 'I clicked "Generate Results" twice — will it duplicate students?', a: 'No. Generating results again for the same class/term updates existing records in place rather than creating duplicates.' },
  { q: 'How do I remove a student, class, or subject?', a: 'Each has a Remove button in its table row. Removing a student withdraws them (their score history is preserved). Removing a class or subject is permanent — you\'ll be warned if students or other data depend on it.' },
  { q: 'A school\'s data disappeared after I cleared my browser cache.', a: 'This should no longer happen — all data is now synced from the live database the moment you log back in. If you still see missing data, contact support immediately.' },
  { q: 'How do I set the report card colors, fonts, and signatures?', a: 'Go to Reports → 🎨 Customise. You can set colors, fonts, table borders and padding, and draw or upload signatures for each signatory.' },
];

const TEACHER_FAQ = [
  { q: 'I don\'t see any classes or subjects on Score Entry.', a: 'Your school admin needs to assign you to at least one class and one subject in the Teachers page. Contact your admin if this hasn\'t been done yet.' },
  { q: 'I can\'t edit a score I already saved.', a: 'Either the deadline for entry has passed, or your admin has approved/finalised that score. Contact your admin if a correction is needed.' },
  { q: 'I entered a score but it got automatically lowered.', a: 'Scores are automatically capped at the maximum allowed for that subject (set by your admin). If you believe the maximum is wrong, ask your admin to check the subject settings.' },
  { q: 'I forgot my password.', a: 'On the Login page, click "Forgot password?" and enter your email. You\'ll receive a reset link.' },
  { q: 'Can I use this on my phone?', a: 'Yes — the app works fully on mobile browsers and works offline. Your scores sync automatically once you\'re back online.' },
];

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Support() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const [openFaq, setOpenFaq] = useState(null);
  const [tab, setTab] = useState('guide');

  const guide = isAdmin ? ADMIN_GUIDE : TEACHER_GUIDE;
  const faq   = isAdmin ? ADMIN_FAQ   : TEACHER_FAQ;

  const mailtoLink = `mailto:${SUPPORT_EMAIL}?subject=SchoolMS Support Request&body=Hi, I need help with...`;
  const telLink    = `tel:+${SUPPORT_PHONE_INTL}`;
  const waLink     = `https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, I need help with SchoolMS.`;

  return (
    <div>
      <div className="page-header">
        <h1>Help &amp; Support</h1>
      </div>

      {/* Support contact card — always visible at top */}
      <div className="card" style={{
        marginBottom: 16, background: 'linear-gradient(135deg, var(--navy) 0%, #1a4a7a 100%)',
        color: '#fff', border: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>📞 Need Technical Support?</div>
            <div style={{ fontSize: '.85rem', opacity: .9 }}>
              We're here to help with any issues — setup, errors, or questions about using the system.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={waLink} target="_blank" rel="noreferrer" style={{
              background: '#25D366', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              📱 WhatsApp
            </a>
            <a href={telLink} style={{
              background: 'rgba(255,255,255,.15)', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              📞 {SUPPORT_PHONE}
            </a>
            <a href={mailtoLink} style={{
              background: 'rgba(255,255,255,.15)', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ✉️ Email
            </a>
          </div>
        </div>
        <div style={{ fontSize: '.74rem', opacity: .75, marginTop: 10 }}>
          {SUPPORT_EMAIL} &nbsp;·&nbsp; {SUPPORT_PHONE}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'guide' ? ' active' : ''}`} onClick={() => setTab('guide')}>
          📖 {isAdmin ? 'Admin Guide' : 'Teacher Guide'}
        </button>
        <button className={`tab${tab === 'faq' ? ' active' : ''}`} onClick={() => setTab('faq')}>
          ❓ FAQ
        </button>
      </div>

      {/* Guide tab */}
      {tab === 'guide' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {guide.map((section, si) => (
            <div className="card" key={si}>
              <div className="card-header">
                <span className="card-title">{section.title}</span>
              </div>
              {section.steps.map(([title, desc], i) => (
                <GuideStep key={i} number={i + 1} title={title}>{desc}</GuideStep>
              ))}
            </div>
          ))}

          <div className="card" style={{ background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.8rem' }}>💡</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--navy)' }}>Still stuck?</div>
                <div style={{ fontSize: '.84rem', color: 'var(--text-mid)' }}>
                  Reach out anytime — WhatsApp is usually fastest:{' '}
                  <a href={waLink} target="_blank" rel="noreferrer" style={{ color: 'var(--navy)', fontWeight: 700 }}>
                    {SUPPORT_PHONE}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ tab */}
      {tab === 'faq' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Frequently Asked Questions</span>
          </div>
          <div>
            {faq.map((item, i) => (
              <FaqItem
                key={i}
                question={item.q}
                answer={item.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
