import React from 'react'; import PolicyLayout from './PolicyLayout';
import { Link } from 'react-router-dom';
import { getPlanPrice, getTermlySaving, BACKUP_ADDON_PRICE, BACKUP_ADDON_TERMLY_PRICE } from '../../services/subscriptionService';

export default function SubscriptionPolicy() {
  return (
    <PolicyLayout title="Subscription Policy" lastUpdated="July 2026">
      <section>
        <h2>Plans and Pricing</h2>
        <p>
          You can pay <strong>monthly</strong> or <strong>per term</strong>. Termly is the
          recommended option — one payment covers a full 3-month term and includes a small
          saving over paying month by month. Monthly stays available for schools that prefer
          it; it is never required.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                {['Plan', 'Price/Month', 'Price/Term (recommended)', 'Students', 'Analytics', 'Backup', 'Support'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Free Trial', 'trial', 'Up to 50', '✕', '✕', 'Standard'],
                ['Starter',    'starter', 'Up to 200', '✕', '✕', 'Standard'],
                ['Pro',        'pro',     'Unlimited', '✓', '✕', 'Standard'],
                ['Premium',    'premium', 'Unlimited', '✓', '✓', 'Priority'],
              ].map(([label, planId, students, analytics, backup, support], i) => (
                <tr key={planId} style={{ background: i % 2 === 0 ? '#f8f9ff' : '#fff' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{label}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {planId === 'trial' ? 'GHS 0' : `GHS ${getPlanPrice(planId, 'monthly')}`}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {planId === 'trial'
                      ? '— (21-day trial)'
                      : `GHS ${getPlanPrice(planId, 'termly')} (save GHS ${getTermlySaving(planId)})`}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{students}</td>
                  <td style={{ padding: '10px 14px' }}>{analytics}</td>
                  <td style={{ padding: '10px 14px' }}>{backup}</td>
                  <td style={{ padding: '10px 14px' }}>{support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '.85rem', color: '#666', marginTop: 8 }}>
          Analytics (performance charts, class/subject comparisons) is not included in the free
          trial or the Starter plan — it requires Pro or Premium. The Backup add-on can be added
          to Starter or Pro for GHS {BACKUP_ADDON_PRICE}/month or GHS {BACKUP_ADDON_TERMLY_PRICE}/term;
          it is already included in Premium.
        </p>
        <p>
          See the full <Link to="/pricing">Pricing page</Link> for a detailed feature-by-feature
          comparison.
        </p>
      </section>
      <section>
        <h2>How Payment Works</h2>
        <ol>
          <li>Choose your plan and billing cycle (monthly, or termly for the built-in saving)</li>
          <li>Send payment via Mobile Money to our registered number</li>
          <li>Notify us on WhatsApp (0549548274) with your school name, plan, cycle, and payment reference</li>
          <li>We verify and activate your subscription within a few hours</li>
          <li>You receive confirmation via WhatsApp and can log in immediately</li>
        </ol>
        <p style={{ background: '#e8f5e9', borderRadius: 8, padding: 12, marginTop: 12 }}>
          <strong>✓ No auto-charge ever.</strong> We do not store your payment details. We do not bill you automatically. You always control when, how often, and whether you pay.
        </p>
      </section>
      <section>
        <h2>Subscription Period</h2>
        <ul>
          <li><strong>Monthly billing:</strong> your subscription runs for 30 days from activation.</li>
          <li><strong>Termly billing (recommended):</strong> your subscription runs for 90 days (one school term) from activation.</li>
        </ul>
        <p>You will receive an in-app reminder starting 7 days before your subscription expires, whichever cycle you're on.</p>
      </section>
      <section>
        <h2>After Expiry</h2>
        <ul>
          <li>The moment your subscription period ends without renewal, your account switches to <strong>read-only mode</strong> — you can still view and print existing records, but cannot add or edit new data</li>
          <li>Your data is <strong>never deleted</strong> immediately due to non-payment — it remains safely stored for 60 days after expiry</li>
          <li>If payment still hasn't resumed after that 60-day window, inactive school data may eventually be permanently deleted — you'll be notified well before this happens</li>
          <li>Renew at any time to restore full access immediately, with all your data exactly as you left it</li>
        </ul>
      </section>
      <section>
        <h2>Refunds</h2>
        <p>We do not offer refunds for partial billing periods (monthly or termly) except in cases where SchoolMS was unavailable for more than 48 consecutive hours due to a fault on our side. Disputes: schoolpilot132@gmail.com</p>
      </section>
    </PolicyLayout>
  );
}
