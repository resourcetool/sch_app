import React from 'react'; import PolicyLayout from './PolicyLayout';
export default function SubscriptionPolicy() {
  return (
    <PolicyLayout title="Subscription Policy" lastUpdated="June 2025">
      <section>
        <h2>Plans and Pricing</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                {['Plan','Price/Month','Students','Analytics','Backup','Support'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Free Trial','GHS 0','Up to 50','✓','✕','Standard'],
                ['Starter','GHS 150','Up to 200','✕','✕','Standard'],
                ['Pro','GHS 250','Unlimited','✓','✕','Standard'],
                ['Premium','GHS 400','Unlimited','✓','✓','Priority'],
              ].map(([plan,...cols], i) => (
                <tr key={plan} style={{ background: i % 2 === 0 ? '#f8f9ff' : '#fff' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{plan}</td>
                  {cols.map((c, j) => <td key={j} style={{ padding: '10px 14px' }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>How Payment Works</h2>
        <ol>
          <li>You send your monthly payment via Mobile Money to our registered number</li>
          <li>You notify us on WhatsApp (0549548274) with your school name and payment confirmation</li>
          <li>We verify and activate your subscription within a few hours</li>
          <li>You receive confirmation via WhatsApp and can log in immediately</li>
        </ol>
        <p style={{ background: '#e8f5e9', borderRadius: 8, padding: 12, marginTop: 12 }}>
          <strong>✓ No auto-charge ever.</strong> We do not store your payment details. We do not bill you automatically. You always control when and whether you pay.
        </p>
      </section>
      <section>
        <h2>Subscription Period</h2>
        <p>Subscriptions run for 30 days from activation. You will receive reminders at 7 days, 3 days, and 1 day before expiry.</p>
      </section>
      <section>
        <h2>After Expiry</h2>
        <ul>
          <li>Your account becomes <strong>read-only</strong> — you can view but not add new data</li>
          <li>A 7-day grace period applies before read-only mode activates</li>
          <li>Your data is <strong>never deleted</strong> due to non-payment</li>
          <li>Renew at any time to restore full access immediately</li>
        </ul>
      </section>
      <section>
        <h2>Refunds</h2>
        <p>We do not offer refunds for partial months except in cases where SchoolMS was unavailable for more than 48 consecutive hours due to a fault on our side. Disputes: schoolpilot132@gmail.com</p>
      </section>
    </PolicyLayout>
  );
}
