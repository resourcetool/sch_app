// src/pages/Support.jsx
//
// Interactive help system — Uber-style guided flows.
// User picks a topic → sees step-by-step wizard they can navigate through.
// Each step has a title, explanation, and optional tip/action.
// Role-aware: admins and teachers see different topic menus.

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link }    from 'react-router-dom';

const SUPPORT_PHONE      = '0549548274';
const SUPPORT_PHONE_INTL = '233549548274';
const SUPPORT_EMAIL      = 'schoolpilot132@gmail.com';

// ── FLOW DEFINITIONS ─────────────────────────────────────────────
// Each flow is a topic the user can pick. Steps are shown one at a time.
const ADMIN_FLOWS = [
  {
    id: 'setup',
    icon: '🏫',
    title: 'Set up my school',
    summary: 'Add classes, subjects, and assign them together',
    steps: [
      {
        title: 'Add your classes',
        body: 'Go to the Classes page from the sidebar. In the quick-add row at the top, type a class name (e.g. "JHS 1A") and press Enter or click + Add Class. Each class you create will appear immediately in the list.',
        tip: '💡 Use Bulk Add if you have many classes — paste one name per line and they all get created at once.',
        action: { label: 'Go to Classes', to: '/classes' },
      },
      {
        title: 'Add your subjects',
        body: 'Go to the Subjects page. Type a subject name in the quick-add row — you can also click "Bulk Add" and tap the common Ghanaian subjects to add them quickly. When adding a subject, set the Max Class Score and Max Exam Score (e.g. 30 and 70) — these values will appear on every report card automatically.',
        tip: '💡 The class/exam split you set here (e.g. 30/70) is exactly what prints on the report — so get it right before entering scores.',
        action: { label: 'Go to Subjects', to: '/subjects' },
      },
      {
        title: 'Assign subjects to classes',
        body: 'Click Edit on any subject, then tap the classes that subject is taught in. Or click Edit on a class and select its subjects. Either direction works — the system checks both when generating reports.',
        tip: '💡 A subject must be assigned to a class before a teacher can enter scores for it — and before it appears in report cards.',
      },
      {
        title: 'You\'re ready to add students and teachers',
        body: 'Your school structure is set up. Next step: add your students (and enrol them in classes), then create teacher accounts and assign their classes and subjects.',
        tip: '🎉 You can always come back and add more classes or subjects later — existing data is never affected.',
      },
    ],
  },
  {
    id: 'students',
    icon: '👥',
    title: 'Add students',
    summary: 'Add individual students or import many at once',
    steps: [
      {
        title: 'Use Quick Add for fast entry',
        body: 'On the Students page, use the Quick Add row at the top: type the student\'s First Name and Last Name, choose their gender, select a class, and press Enter. The student is created and enrolled in that class in one step.',
        tip: '💡 Leaving the class blank creates the student without enrolment — you can enrol them later with the Enroll button.',
        action: { label: 'Go to Students', to: '/students' },
      },
      {
        title: 'Import many students from Excel',
        body: 'If you have a spreadsheet of student names, click ⬆ Import Excel in the top right. Your spreadsheet should have columns: First Name, Last Name, Gender, Date of Birth, Guardian Name, Guardian Phone.',
        tip: '💡 Download a template from the Import button if you\'re not sure about the format.',
      },
      {
        title: 'Enrol a student who isn\'t in a class yet',
        body: 'Find the student in the table — they\'ll show "Not enrolled" in the Class column. Click the Enrol button on their row, pick a class, academic year, and term, then save.',
        tip: '💡 A student must be enrolled in a class before their name appears on the score entry grid for that class.',
      },
      {
        title: 'Remove a student',
        body: 'Click the Remove button on the student\'s row. This marks them as Withdrawn — they disappear from class lists and score entry going forward. Their historical scores and results are always preserved.',
        tip: '⚠ Removing is not permanent deletion — the student record stays in the database for academic record purposes.',
      },
    ],
  },
  {
    id: 'teachers',
    icon: '👨‍🏫',
    title: 'Add & assign teachers',
    summary: 'Create teacher accounts and assign their classes and subjects',
    steps: [
      {
        title: 'Create a teacher account',
        body: 'Go to the Teachers page. In the Quick Add row, enter the teacher\'s name, email address, and a password (at least 8 characters). Click + Add. This creates their Firebase login immediately — they can log in right away.',
        tip: '💡 You stay logged in as admin throughout — the teacher account is created in the background without affecting your session.',
        action: { label: 'Go to Teachers', to: '/teachers' },
      },
      {
        title: 'Assign their classes and subjects',
        body: 'Click Edit on the teacher. In the edit panel, tap each class they teach — the pills highlight in blue when selected. Then tap each subject they\'re responsible for. You can also click "Auto-assign from selected classes" to automatically select all subjects taught in those classes.',
        tip: '⚠ A teacher who has no classes or subjects assigned will get a permission error on the Score Entry page. Always assign both.',
      },
      {
        title: 'Give the teacher their login details',
        body: 'Share the teacher\'s email and password with them directly (WhatsApp is fine). They go to your school\'s web address, click "Sign In", and enter those details. They\'ll only see Score Entry, Reports, and Analytics — not admin pages.',
        tip: '💡 Teachers should change their password after first login. They can do this from the Login page → "Forgot password?".',
      },
      {
        title: 'Remove a teacher',
        body: 'Click the Remove button on the teacher\'s row. Their account is deactivated — they can no longer log in. Their previously entered scores are preserved.',
      },
    ],
  },
  {
    id: 'scores',
    icon: '✏️',
    title: 'Manage score entry',
    summary: 'Set deadlines, review teacher submissions, fix errors',
    steps: [
      {
        title: 'Set an assessment deadline (optional)',
        body: 'Go to Deadlines from the sidebar. Set an opening date and closing date for score entry. Teachers can only enter scores within this window. You can lock entry manually at any time, or extend it if a teacher needs more time.',
        action: { label: 'Go to Deadlines', to: '/assessments' },
      },
      {
        title: 'View all submitted scores',
        body: 'Go to Score Entry → "All Submissions" tab. Filter by class, subject, or term to see exactly what each teacher has entered. You can see scores in real time as teachers submit them.',
      },
      {
        title: 'Edit or delete a teacher\'s score',
        body: 'In the All Submissions tab, click Edit on any score row. Change the Class Score and/or Exam Score, enter a reason, and save. Every admin edit is logged in an audit trail. Click Delete to remove a score entirely.',
        tip: '⚠ Editing a score that has already been finalised requires admin override. Changes are always logged.',
      },
    ],
  },
  {
    id: 'reports',
    icon: '📄',
    title: 'Generate & print reports',
    summary: 'Create results and download professional report cards',
    steps: [
      {
        title: 'Generate results for a class',
        body: 'Go to Reports. Select a class, academic year, and term, then click ⚡ Generate Results. The system fetches all teacher-submitted scores from the database, calculates totals, averages, and class positions, then shows the full results table.',
        tip: '💡 Always click Generate Results after all teachers have finished entering scores — it fetches the latest data every time.',
        action: { label: 'Go to Reports', to: '/reports' },
      },
      {
        title: 'Print a student\'s report card',
        body: 'In the results table, click 📄 Print on any student\'s row. A PDF downloads immediately with their full report card including all subjects, grades, grade numbers, remarks, the grades legend, and the conduct table.',
        tip: '💡 The report card shows your school name and logo, the correct class/exam weighting per subject, and all signatory names you configured in Settings.',
      },
      {
        title: 'Print all report cards at once',
        body: 'Click 🖨 Print All in the page header to download one PDF per student in sequence. There\'s a short pause between each download so your browser doesn\'t block them.',
        tip: '💡 Allow pop-ups / multiple downloads in your browser settings if prompted.',
      },
      {
        title: 'Customise the report card appearance',
        body: 'Click 🎨 Customise to open the Report Customiser. Change colors, font, border style, table padding, and border thickness. In the Signatures tab, draw or upload each signatory\'s signature — it appears on every report card.',
        tip: '💡 Changes are saved to your school settings and apply to all future PDFs. Existing downloaded PDFs are not affected.',
      },
      {
        title: 'Finalise results',
        body: 'Click 🔒 Finalise Results when you\'re confident the results are correct. This locks the results for promotion and prevents further editing by teachers. Finalising is one of the trial milestone triggers.',
        tip: '⚠ Finalising cannot be undone by teachers — only a super admin can override a finalised result.',
      },
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    title: 'School settings & logo',
    summary: 'Configure your school info, logo, signatories, and grading scale',
    steps: [
      {
        title: 'Add your school logo',
        body: 'Go to Settings → 🖼 Logo tab. Click "Choose Image" and select a PNG or JPG (max 500KB, square images work best). You\'ll see a preview of how it looks on the report header — logo appears on both left and right sides.',
        tip: '💡 A transparent-background PNG looks best on the report card.',
        action: { label: 'Go to Settings', to: '/settings' },
      },
      {
        title: 'Set signatory names',
        body: 'Go to Settings → 📄 Report Card tab. Fill in the names for Class Teacher, School Counsellor, Academic Head, and Administrator. These names print on every report card — you can also draw or upload their signatures in the 🎨 Customise panel from the Reports page.',
      },
      {
        title: 'Set Next Term Begins date',
        body: 'On the Report Card settings tab, pick a date for "Next Term Begins". This prints on every report card automatically — no need to set it per-student.',
      },
      {
        title: 'Customise your grading scale',
        body: 'Go to Settings → Grading Scale tab. The default is the standard Ghana BECE scale (A1–F9). You can edit the mark ranges, grade letters, and remarks to match your school\'s specific policy.',
        tip: '💡 Changes to the grading scale take effect the next time you generate results — existing results are not retroactively changed.',
      },
    ],
  },
];

const TEACHER_FLOWS = [
  {
    id: 'scores',
    icon: '✏️',
    title: 'Enter scores',
    summary: 'Open the score sheet and enter class and exam scores',
    steps: [
      {
        title: 'Go to Score Entry',
        body: 'Tap "Score Entry" in the sidebar menu (or the ✏️ icon). You\'ll see the filters at the top — Class, Subject, Academic Year, and Term.',
        action: { label: 'Go to Score Entry', to: '/scores' },
      },
      {
        title: 'Select your class',
        body: 'If you teach only one subject, it\'s already selected for you — you just need to pick your class from the dropdown. If you teach more than one subject, tap the subject tabs that appear above the filters first, then pick your class.',
        tip: '💡 You only see the classes and subjects your admin assigned to you — not other teachers\' classes.',
      },
      {
        title: 'Enter scores in the grid',
        body: 'The score grid loads with every student enrolled in that class. Click any Class Score or Exam Score cell and type a number. The grade updates instantly as you type. Scores are automatically limited to the maximum your admin set — if you type too high a number it\'ll be corrected automatically.',
        tip: '⌨️ Keyboard shortcuts: Tab = next cell, Enter = next student, ↑↓ = move up/down, ←→ = switch between class/exam score.',
      },
      {
        title: 'Save your scores',
        body: 'Click 💾 Save All Scores at the bottom of the grid. Your scores are saved to the school\'s database immediately — your admin can see them right away.',
        tip: '💡 You can save partially — come back and add more scores later before the deadline. Saving again updates the existing scores, not duplicates them.',
      },
    ],
  },
  {
    id: 'deadline',
    icon: '📅',
    title: 'Deadlines & locked entry',
    summary: 'What to do if entry is closed or the deadline is approaching',
    steps: [
      {
        title: 'Understanding the deadline banner',
        body: 'If your admin has set a deadline, you\'ll see an orange banner at the top of Score Entry showing when entry closes. Enter and save your scores before that time.',
        tip: '⏰ The deadline applies to ALL teachers — plan to enter scores a day or two before to avoid last-minute issues.',
      },
      {
        title: 'If entry is locked',
        body: 'A red banner says "Entry Closed" — this means your admin has either locked entry manually or the deadline has passed. You cannot enter or change scores. Contact your admin directly.',
        tip: '💡 Your admin can extend the deadline or unlock entry at any time from the Deadlines page.',
      },
      {
        title: 'If you need to correct a score after the deadline',
        body: 'You cannot edit scores after the deadline yourself. Contact your admin — they can edit or override any score from the "All Submissions" tab, and the change is logged in the audit trail.',
      },
    ],
  },
  {
    id: 'password',
    icon: '🔑',
    title: 'I forgot my password',
    summary: 'Reset your login password',
    steps: [
      {
        title: 'Go to the login page',
        body: 'Open the app and go to the Sign In page. You should see a "Forgot password?" link next to the password field.',
        action: { label: 'Go to Login', to: '/login' },
      },
      {
        title: 'Enter your email address',
        body: 'Click "Forgot password?" and enter the email address your admin used when creating your teacher account. Click "Send Reset Link".',
      },
      {
        title: 'Check your email and click the link',
        body: 'You\'ll receive an email from Firebase (Google) with a reset link. Click it, choose a new strong password (8+ characters, with a number and special character), and save.',
        tip: '💡 Check your spam or junk folder if you don\'t see the email within 2 minutes.',
      },
      {
        title: 'Sign in with your new password',
        body: 'Go back to the app and sign in with your email and the new password you just set.',
      },
    ],
  },
  {
    id: 'offline',
    icon: '📶',
    title: 'Using without internet',
    summary: 'The app works offline — here\'s what that means',
    steps: [
      {
        title: 'The app works when you\'re offline',
        body: 'If you lose internet connection while using the app, you can keep viewing data and entering scores. Your work is saved locally on your device.',
        tip: '💡 The sync status indicator in the top bar shows whether you\'re online (green ● Synced) or offline.',
      },
      {
        title: 'Your scores sync automatically when you\'re back online',
        body: 'As soon as your internet connection returns, any scores or data you entered offline are automatically sent to the school\'s database. You don\'t need to do anything — it happens in the background.',
      },
      {
        title: 'Never clear your browser data while working offline',
        body: 'If you clear your browser\'s cache or site data while offline, locally saved (unsynced) data will be lost. Always reconnect and wait for the "Synced" status before clearing browser data.',
        tip: '⚠ If you\'re online and see "Synced", clearing cache is safe — your data is in the database. It\'s just offline-unsynced data that\'s at risk.',
      },
    ],
  },
];

// ── TOPIC CARD ────────────────────────────────────────────────────
function TopicCard({ flow, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        padding: '16px 18px', background: '#fff', border: '1.5px solid var(--border)',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        transition: 'all .15s', marginBottom: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.border = '1.5px solid var(--navy)'; e.currentTarget.style.background = '#f5f8ff'; }}
      onMouseLeave={e => { e.currentTarget.style.border = '1.5px solid var(--border)'; e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{ fontSize: '1.6rem', width: 40, textAlign: 'center', flexShrink: 0 }}>{flow.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2, fontSize: '.92rem' }}>{flow.title}</div>
        <div style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{flow.summary}</div>
      </div>
      <div style={{ color: 'var(--text-lt)', fontSize: '1.1rem', flexShrink: 0 }}>›</div>
    </button>
  );
}

// ── STEP NAVIGATOR ────────────────────────────────────────────────
function StepNavigator({ flow, onBack }) {
  const [stepIdx, setStepIdx] = useState(0);
  const step      = flow.steps[stepIdx];
  const isFirst   = stepIdx === 0;
  const isLast    = stepIdx === flow.steps.length - 1;
  const progress  = ((stepIdx + 1) / flow.steps.length) * 100;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--navy)', padding: '4px 8px 4px 0' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 2 }}>{flow.icon} {flow.title}</div>
          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.95rem' }}>
            Step {stepIdx + 1} of {flow.steps.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--navy)', borderRadius: 2,
          width: `${progress}%`, transition: 'width .3s ease',
        }} />
      </div>

      {/* Step content */}
      <div className="card" style={{ minHeight: 220 }}>
        <h3 style={{ color: 'var(--navy)', marginBottom: 12, fontSize: '1rem' }}>{step.title}</h3>
        <p style={{ color: 'var(--text-mid)', lineHeight: 1.75, fontSize: '.88rem', marginBottom: step.tip ? 14 : 0 }}>
          {step.body}
        </p>

        {step.tip && (
          <div style={{
            background: '#e3f2fd', borderRadius: 8, padding: '10px 14px',
            fontSize: '.82rem', color: '#0d47a1', lineHeight: 1.6,
          }}>
            {step.tip}
          </div>
        )}

        {step.action && (
          <div style={{ marginTop: 14 }}>
            <Link
              to={step.action.to}
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              {step.action.label} →
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <button
          onClick={() => setStepIdx(i => Math.max(0, i - 1))}
          disabled={isFirst}
          className="btn btn-ghost"
          style={{ opacity: isFirst ? .3 : 1 }}
        >
          ← Previous
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {flow.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              style={{
                width: i === stepIdx ? 20 : 8, height: 8, borderRadius: 4, border: 'none',
                background: i === stepIdx ? 'var(--navy)' : i < stepIdx ? '#90caf9' : 'var(--border)',
                cursor: 'pointer', padding: 0, transition: 'all .2s',
              }}
            />
          ))}
        </div>

        {isLast ? (
          <button onClick={onBack} className="btn btn-primary">
            ✓ Done
          </button>
        ) : (
          <button onClick={() => setStepIdx(i => Math.min(flow.steps.length - 1, i + 1))} className="btn btn-primary">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Support() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const flows   = isAdmin ? ADMIN_FLOWS : TEACHER_FLOWS;

  const [activeFlow, setActiveFlow] = useState(null);
  const [showContact, setShowContact] = useState(false);

  const waLink    = `https://wa.me/${SUPPORT_PHONE_INTL}?text=Hello, I need help with SchoolMS.`;
  const mailtoLink = `mailto:${SUPPORT_EMAIL}?subject=SchoolMS Support Request&body=Hi, I need help with...`;

  return (
    <div>
      <div className="page-header">
        <h1>Help &amp; Support</h1>
      </div>

      {/* Support contact banner */}
      <div className="card" style={{
        marginBottom: 16,
        background: 'linear-gradient(135deg, var(--navy) 0%, #1a4a7a 100%)',
        color: '#fff', border: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
              Need help from our team?
            </div>
            <div style={{ fontSize: '.83rem', opacity: .9 }}>
              We're available on WhatsApp, phone, and email — usually respond within a few hours.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={waLink} target="_blank" rel="noreferrer" style={{
              background: '#25D366', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none',
            }}>
              📱 WhatsApp
            </a>
            <a href={`tel:+${SUPPORT_PHONE_INTL}`} style={{
              background: 'rgba(255,255,255,.15)', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none',
            }}>
              📞 {SUPPORT_PHONE}
            </a>
            <a href={mailtoLink} style={{
              background: 'rgba(255,255,255,.15)', color: '#fff', padding: '9px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.84rem', textDecoration: 'none',
            }}>
              ✉️ Email
            </a>
          </div>
        </div>
        <div style={{ fontSize: '.72rem', opacity: .6, marginTop: 8 }}>
          {SUPPORT_EMAIL} · {SUPPORT_PHONE}
        </div>
      </div>

      {/* Step navigator — active flow */}
      {activeFlow ? (
        <div className="card">
          <StepNavigator
            flow={activeFlow}
            onBack={() => setActiveFlow(null)}
          />
        </div>
      ) : (
        /* Topic list */
        <div>
          <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 12, fontSize: '.88rem' }}>
            {isAdmin ? '🔧 What do you need help with?' : '❓ What do you need help with?'}
          </div>
          {flows.map(flow => (
            <TopicCard
              key={flow.id}
              flow={flow}
              onClick={() => setActiveFlow(flow)}
            />
          ))}

          {/* Contact section */}
          <div className="card" style={{ marginTop: 16, background: 'var(--surface2)' }}>
            <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--navy)', marginBottom: 4 }}>
              Can't find what you're looking for?
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginBottom: 12 }}>
              Contact us directly — WhatsApp is fastest.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={waLink} target="_blank" rel="noreferrer" style={{
                background: '#25D366', color: '#fff', padding: '8px 16px', borderRadius: 8,
                fontWeight: 700, fontSize: '.82rem', textDecoration: 'none',
              }}>
                📱 WhatsApp — {SUPPORT_PHONE}
              </a>
              <a href={mailtoLink} style={{
                background: 'var(--navy)', color: '#fff', padding: '8px 16px', borderRadius: 8,
                fontWeight: 700, fontSize: '.82rem', textDecoration: 'none',
              }}>
                ✉️ {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
