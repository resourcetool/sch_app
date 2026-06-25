import React from 'react'; import PolicyLayout from './PolicyLayout';
export default function DataSecurity() {
  return (
    <PolicyLayout title="Data Security Policy" lastUpdated="June 2025">
      <section>
        <h2>How We Protect Your Data</h2>
        <ul>
          <li><strong>Encryption in transit:</strong> All data is transmitted over HTTPS/TLS encryption</li>
          <li><strong>Encryption at rest:</strong> All data stored in Google Firebase is encrypted at rest by default</li>
          <li><strong>Authentication:</strong> Firebase Authentication with email verification required for all accounts</li>
          <li><strong>Access control:</strong> Each school's data is isolated — no school can see another school's data</li>
          <li><strong>Role-based access:</strong> Admins, teachers, and super admins each have strictly limited access to only what they need</li>
          <li><strong>Audit logs:</strong> Key actions (logins, score saves, report generation) are logged with server-verified timestamps</li>
        </ul>
      </section>
      <section>
        <h2>Database Security Rules</h2>
        <p>SchoolMS uses Firestore Security Rules that enforce school-level data isolation at the database layer — not just the application layer. Even if someone obtained a valid Firebase token, they could not access another school's data.</p>
        <p>Teacher accounts can only read and write data for their assigned classes and subjects — not other teachers' data.</p>
      </section>
      <section>
        <h2>Password Security</h2>
        <ul>
          <li>Passwords are never stored in plain text — Firebase Authentication handles all password hashing using industry-standard algorithms</li>
          <li>We require strong passwords: minimum 8 characters with uppercase, number, and special character</li>
          <li>Password reset is available via verified email link</li>
        </ul>
      </section>
      <section>
        <h2>Third-Party Services</h2>
        <ul>
          <li><strong>Google Firebase:</strong> Database, authentication, and hosting — SOC 2, ISO 27001, GDPR compliant</li>
          <li><strong>Vercel:</strong> Application hosting — SOC 2 compliant</li>
          <li><strong>EmailJS:</strong> Email notifications only — no data stored beyond what is needed to send the email</li>
        </ul>
      </section>
      <section>
        <h2>Incident Response</h2>
        <p>In the event of a data breach affecting your school's data, we will notify you within 72 hours via email and WhatsApp, describe what was affected, and take immediate steps to secure the breach.</p>
      </section>
      <section>
        <h2>Reporting a Security Issue</h2>
        <p>If you discover a security vulnerability, please contact us immediately and confidentially: schoolpilot132@gmail.com | 0549548274 (WhatsApp). Do not publicly disclose the vulnerability before we have had a chance to address it.</p>
      </section>
    </PolicyLayout>
  );
}
