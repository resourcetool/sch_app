// src/components/common/UpsellModal.jsx
//
// PSYCHOLOGY: fires the pricing conversation at the peak-value moment —
// right after the school sees their first real report generated in
// minutes instead of a full evening — rather than a generic countdown
// reminder days later. This is when the endowment effect is strongest:
// they've just felt the payoff, so the price feels smallest relative to
// what they just experienced.
//
// Shown once per school (sessionStorage flag), never blocks the screen
// permanently — always dismissible.

import React from 'react';
import { Link } from 'react-router-dom';
import { PLANS, getPlanPrice } from '../../services/subscriptionService';
import MoMoPayButton from './MoMoPayButton';

export default function UpsellModal({ onClose, schoolId }) {
  const plan = PLANS.pro; // recommended plan — matches the "most popular" framing on Pricing.jsx
  const price = getPlanPrice(plan.id, 'termly');
  const perDay = Math.round(price / 90);

  function dismiss() {
    if (schoolId) sessionStorage.setItem(`upsell_shown_${schoolId}`, '1');
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,26,46,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, maxWidth: 420, width: '100%',
        padding: '28px 24px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#1a1a2e', marginBottom: 6 }}>
            Your first report just printed
          </div>
          <div style={{ fontSize: '.85rem', color: '#666', lineHeight: 1.6 }}>
            That took minutes instead of a full evening. Keep this going for your
            whole school, every term — from as little as
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F3460', margin: '8px 0 2px' }}>
            GHS {perDay}<span style={{ fontSize: '.9rem', fontWeight: 700, color: '#888' }}>/day</span>
          </div>
          <div style={{ fontSize: '.75rem', color: '#aaa' }}>
            ({plan.name} plan · GHS {price} per term)
          </div>
        </div>

        <div style={{
          background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10,
          padding: '10px 14px', fontSize: '.78rem', color: '#2e7d32', textAlign: 'center',
          marginBottom: 18,
        }}>
          🔒 If it doesn't work out, nothing is ever lost — your data stays safe, always.
        </div>

        <MoMoPayButton amount={price} planName={plan.name} compact />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link
            to="/pricing"
            onClick={dismiss}
            style={{
              flex: 1, textAlign: 'center', padding: '11px', borderRadius: 8,
              border: '1.5px solid #0F3460', color: '#0F3460',
              fontWeight: 700, fontSize: '.82rem', textDecoration: 'none',
            }}
          >
            See All Plans
          </Link>
          <button
            onClick={dismiss}
            style={{
              flex: 1, padding: '11px', borderRadius: 8, border: 'none',
              background: '#f0f0f0', color: '#888', fontWeight: 700,
              fontSize: '.82rem', cursor: 'pointer',
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
