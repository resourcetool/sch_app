import React from 'react'; import PolicyLayout from './PolicyLayout';
export default function DataRetention() {
  return (
    <PolicyLayout title="Data Retention Policy" lastUpdated="June 2025">
      <section>
        <h2>Our Commitment</h2>
        <p style={{ background: '#e8f5e9', borderRadius: 8, padding: 14, fontWeight: 600, color: '#2e7d32' }}>
          ✓ Your school's data is NEVER automatically deleted — not after a trial ends, not after a subscription expires, not ever, unless you explicitly request it.
        </p>
      </section>
      <section>
        <h2>How Long We Keep Your Data</h2>
        <ul>
          <li><strong>Active subscription:</strong> All data kept indefinitely while subscribed</li>
          <li><strong>After trial ends:</strong> All data kept indefinitely. Account is read-only.</li>
          <li><strong>After subscription expires:</strong> All data kept for at least 12 months. Account is read-only after a 7-day grace period.</li>
          <li><strong>After deletion request:</strong> Account deactivated immediately. Data preserved for 30–90 days (grace period). Permanently deleted after grace period expires.</li>
        </ul>
      </section>
      <section>
        <h2>Requesting Data Deletion</h2>
        <p>Only the school administrator (the original account owner) can request deletion. To request:</p>
        <ol>
          <li>Log in and go to Settings → Account → Request Data Deletion</li>
          <li>Confirm your identity and reason for deletion</li>
          <li>Download your data export first (strongly recommended)</li>
          <li>Submit the request</li>
        </ol>
        <p>After submission: your account is immediately deactivated. Your data enters a 30–90 day grace period during which you can cancel the deletion request by contacting us. After the grace period, all data is permanently and irreversibly deleted.</p>
      </section>
      <section>
        <h2>Data Export Before Deletion</h2>
        <p>Before any deletion takes effect, we strongly recommend downloading your data export (available to Premium subscribers in the Backup section, or on request for all plans). Exports include all student records, results, and report cards.</p>
      </section>
      <section>
        <h2>What Is Deleted</h2>
        <p>A full deletion removes: all student records, teacher accounts, classes, subjects, assessment scores, generated results, report cards, and the school account itself. This is irreversible.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Data deletion requests: schoolpilot132@gmail.com | 0549548274</p>
      </section>
    </PolicyLayout>
  );
}
