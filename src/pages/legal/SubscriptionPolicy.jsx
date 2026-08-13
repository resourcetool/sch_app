import React, { useState } from 'react'; import PolicyLayout from './PolicyLayout';
import { Link } from 'react-router-dom';
import { getPlanPrice, getTermlySaving, BACKUP_ADDON_PRICE, BACKUP_ADDON_TERMLY_PRICE } from '../../services/subscriptionService';
import { BillingCycleToggle, LivePlanPriceTable, ROICalculator } from '../../components/common/PricingCalculator';

export default function SubscriptionPolicy() {
  const [cycle, setCycle] = useState('termly');

  return (
    <PolicyLayout title="Subscription Policy" lastUpdated="August 2026">
      <section>
        <h2>Plans and Pricing</h2>
        <p>
          You can pay <strong>monthly</strong>, <strong>per term</strong>, or <strong>annually</strong>.
          Termly is the recommended option for most schools — one payment covers a full 3-month
          term and includes a built-in saving over paying month by month. Annual billing offers
          the largest saving of all, for schools that prefer a single yearly payment. Monthly
          stays available for schools that prefer it; no cycle is ever required.
        </p>

        {/* Interactive pricing tool — same calculator used on the main
            Pricing page, embedded here so admins can check current costs
            without leaving this policy page. Both surfaces read from the
            same live plan config, so the numbers here always match. */}
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, fontSize: '.85rem', color: '#555', fontWeight: 600 }}>
            Choose a billing cycle to see live pricing below
          </div>
          <BillingCycleToggle cycle={cycle} setCycle={setCycle} />
        </div>

        <LivePlanPriceTable cycle={cycle} />
        <p style={{ fontSize: '.85rem', color: '#666', marginTop: 8 }}>
          Analytics (performance charts, class/subject comparisons) is not included in the free
          trial or the Starter plan — it requires Pro or Premium. The Backup add-on can be added
          to Starter or Pro for GHS {BACKUP_ADDON_PRICE}/month or GHS {BACKUP_ADDON_TERMLY_PRICE}/term;
          it is already included in Premium. The Free Trial is not shown above — it's GHS 0 for
          up to 50 students, for 21 days or until your first report/finalized assessment,
          whichever comes first.
        </p>

        <div style={{ margin: '28px 0' }}>
          <ROICalculator />
        </div>

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
          <li><strong>Termly billing (recommended):</strong> your subscription runs for 90 days (one school term) from activation — or, if you've set your actual term-end date in Settings, until that date plus a 7-day grace period, whichever your super admin applies at renewal.</li>
          <li><strong>Annual billing:</strong> your subscription runs for 365 days from activation — the largest available saving, in exchange for a single upfront payment.</li>
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
