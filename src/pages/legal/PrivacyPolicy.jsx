import React from 'react'; import PolicyLayout from './PolicyLayout';
export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated="June 2025">
      <section>
        <h2>1. Who We Are</h2>
        <p>SchoolMS is a school management software service operated by SchoolPilot (Ghana). Contact: schoolpilot132@gmail.com | 0549548274.</p>
      </section>
      <section>
        <h2>2. What Data We Collect</h2>
        <p>We collect only what is necessary to run the service:</p>
        <ul>
          <li><strong>School information:</strong> Name, address, phone, email</li>
          <li><strong>Administrator information:</strong> Name, email address, Ghana mobile phone number</li>
          <li><strong>Teacher information:</strong> Name, email address (provided by the school admin)</li>
          <li><strong>Student information:</strong> Name, date of birth, gender, guardian contact — provided by the school admin</li>
          <li><strong>Academic data:</strong> Assessment scores, results, class assignments, report cards</li>
          <li><strong>Usage data:</strong> Login times, score entries, report generation events (for audit purposes)</li>
        </ul>
      </section>
      <section>
        <h2>3. How We Use Your Data</h2>
        <ul>
          <li>To operate and provide the SchoolMS service</li>
          <li>To generate report cards and academic results</li>
          <li>To send service notifications (trial approval, subscription reminders)</li>
          <li>To audit and investigate disputes or fraud</li>
          <li>We never sell your data to third parties</li>
          <li>We never use student data for advertising</li>
        </ul>
      </section>
      <section>
        <h2>4. Data Storage</h2>
        <p>All data is stored on Google Firebase Firestore servers. Firebase is operated by Google LLC and is compliant with GDPR, SOC 2, and ISO 27001. Data is stored in Google's secure cloud infrastructure.</p>
      </section>
      <section>
        <h2>5. Data Retention</h2>
        <p>See our <a href="/legal/data-retention">Data Retention Policy</a> for full details. In summary: your data is never deleted automatically. Schools may request data deletion. After a 30–90 day grace period, data is permanently removed.</p>
      </section>
      <section>
        <h2>6. Your Rights</h2>
        <ul>
          <li>Access your data at any time through the app</li>
          <li>Export your data (admin can download via the Backup feature)</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your school's data (see Account Deletion section in the app)</li>
        </ul>
      </section>
      <section>
        <h2>7. Children's Data</h2>
        <p>SchoolMS processes student data on behalf of schools, who are the data controllers for their students. Schools are responsible for obtaining any necessary parental consent under applicable law. We process this data only at the school's direction.</p>
      </section>
      <section>
        <h2>8. Contact</h2>
        <p>Privacy questions: schoolpilot132@gmail.com | 0549548274 (WhatsApp)</p>
      </section>
    </PolicyLayout>
  );
}
