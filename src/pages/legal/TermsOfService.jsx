import React from 'react'; import PolicyLayout from './PolicyLayout';
export default function TermsOfService() {
  return (
    <PolicyLayout title="Terms of Service" lastUpdated="June 2025">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By creating a SchoolMS account (including a free trial), you agree to these Terms of Service. If you do not agree, do not use SchoolMS.</p>
      </section>
      <section>
        <h2>2. The Service</h2>
        <p>SchoolMS provides school management software including student records, assessment management, report card generation, and analytics. Features vary by subscription plan.</p>
      </section>
      <section>
        <h2>3. Free Trial</h2>
        <ul>
          <li>Each school is entitled to one free trial per email address and phone number</li>
          <li>The trial requires approval by SchoolMS administrators</li>
          <li>The trial ends when you generate your first academic report, finalise a full class assessment, or after 21 days — whichever comes first</li>
          <li>After the trial, your account becomes read-only. Data is never deleted.</li>
          <li>We will never charge your Mobile Money automatically. You choose if and when to subscribe.</li>
        </ul>
      </section>
      <section>
        <h2>4. Payment</h2>
        <ul>
          <li>Subscriptions are monthly, paid in advance via Mobile Money (Ghana)</li>
          <li>There is no automatic billing or stored payment method</li>
          <li>You send payment manually and we activate your plan manually after confirmation</li>
          <li>No refunds for partial months except in cases of service outage caused by SchoolMS</li>
        </ul>
      </section>
      <section>
        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Enter false student records or academic data</li>
          <li>Attempt to access another school's data</li>
          <li>Use the service for any illegal purpose</li>
          <li>Share your login credentials with unauthorized persons</li>
          <li>Attempt to reverse-engineer or copy the software</li>
        </ul>
      </section>
      <section>
        <h2>6. Data Ownership</h2>
        <p>Your school's data belongs to your school. SchoolMS acts as a data processor on your behalf. We do not claim ownership of your student records, assessment data, or any other content you enter into the system.</p>
      </section>
      <section>
        <h2>7. Service Availability</h2>
        <p>We aim for 99% uptime but cannot guarantee uninterrupted service. The app works offline (data saved locally and synced when reconnected) to minimise disruption from connectivity issues.</p>
      </section>
      <section>
        <h2>8. Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms or submit false information. You may request account deletion at any time (see Data Retention Policy).</p>
      </section>
      <section>
        <h2>9. Governing Law</h2>
        <p>These Terms are governed by the laws of Ghana. Disputes will be resolved in Ghanaian courts.</p>
      </section>
      <section>
        <h2>10. Contact</h2>
        <p>schoolpilot132@gmail.com | 0549548274 (WhatsApp)</p>
      </section>
    </PolicyLayout>
  );
}
