// src/components/common/MoMoPayButton.jsx
//
// Zero-cost payment collection button — no payment gateway, no % fees.
// Copies the Schpilot MoMo number to the clipboard and opens the
// phone's dialer pre-filled with the right network's USSD code.
//
// IMPORTANT — replace the placeholder numbers below with your real
// Schpilot MoMo numbers before shipping. If you use the same number
// on all three networks (common — most people register one SIM across
// MTN/Telecel/AirtelTigo interoperability), just use the same value
// for all three.
//
// PLATFORM NOTE:
// - Android: tel: links with USSD codes (*170#) auto-dial immediately.
// - iOS: Apple blocks USSD codes from auto-dialing for security reasons.
//   The Phone app opens with the code pre-filled, but the person must
//   tap the green call button themselves. This is expected — the
//   instructions below account for it.
//
// This does NOT auto-confirm payment. The admin still sends the MoMo
// reference over WhatsApp afterward, same as today, so SuperAdmin can
// activate/renew their account. That manual step goes away only once
// a paid collections API (Paystack/Hubtel/MTN Collections) is added.

import React, { useState } from 'react';

// ── CONFIG — update with real numbers ──────────────────────────────
export const MOMO_NUMBER = '0549548274'; // TODO: replace with real Schpilot MoMo number
const WHATSAPP_BASE = 'https://wa.me/233549548274';

const NETWORKS = [
  { id: 'mtn',        label: 'MTN MoMo',            ussd: '*170#', color: '#FFCB05', text: '#1a1a2e' },
  { id: 'telecel',    label: 'Telecel Cash',         ussd: '*110#', color: '#E60000', text: '#fff'    },
  { id: 'airteltigo', label: 'AirtelTigo Money',     ussd: '*110#', color: '#0057A8', text: '#fff'    },
];

function dialLink(ussd) {
  // %23 = URL-encoded '#'. Works reliably on Android; opens dialer on iOS
  // (user taps call). Never silently fails — worst case it just opens
  // the Phone app with the code visible.
  return `tel:${ussd.replace('#', '%23')}`;
}

export default function MoMoPayButton({ amount, planName = 'Schpilot', compact = false }) {
  const [network, setNetwork]   = useState(null);
  const [copied, setCopied]     = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(MOMO_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (rare, old browsers) — fall back silently,
      // the number is shown on screen either way.
    }
  }

  const waConfirmLink = `${WHATSAPP_BASE}?text=${encodeURIComponent(
    `Hello, I just paid GHS ${amount} for the ${planName} plan via MoMo. Here is my reference: `
  )}`;

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e8ecf0', borderRadius: 14,
      padding: compact ? '14px 16px' : '20px 20px',
    }}>
      <div style={{ fontWeight: 800, fontSize: '.88rem', color: '#1a1a2e', marginBottom: 4 }}>
        💳 Pay GHS {amount} via Mobile Money
      </div>
      <div style={{ fontSize: '.76rem', color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
        No card, no app download. Pick your network below.
      </div>

      {/* Step 1 — choose network */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: network ? 14 : 0 }}>
        {NETWORKS.map(n => (
          <button
            key={n.id}
            onClick={() => setNetwork(n.id === network ? null : n.id)}
            style={{
              flex: '1 1 100px', padding: '10px 8px', borderRadius: 10,
              border: network === n.id ? `2px solid ${n.color}` : '1.5px solid #e8ecf0',
              background: network === n.id ? n.color : '#fff',
              color: network === n.id ? n.text : '#444',
              fontWeight: 700, fontSize: '.78rem', cursor: 'pointer',
            }}
          >
            {n.label}
          </button>
        ))}
      </div>

      {/* Step 2 — copy + dial, once a network is picked */}
      {network && (
        <div style={{ background: '#f7f9fc', borderRadius: 10, padding: '14px 16px' }}>
          <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: '.8rem', color: '#444', lineHeight: 1.9 }}>
            <li>Copy the Schpilot MoMo number below</li>
            <li>Dial the code — choose <strong>Send Money</strong></li>
            <li>Paste the number, enter <strong>GHS {amount}</strong>, confirm with your PIN</li>
            <li>Send us the MoMo reference on WhatsApp so we can activate your account</li>
          </ol>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={copyNumber}
              style={{
                flex: '1 1 140px', padding: '11px', borderRadius: 8, border: 'none',
                background: copied ? '#27AE60' : '#0F3460', color: '#fff',
                fontWeight: 700, fontSize: '.8rem', cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied!' : `📋 Copy ${MOMO_NUMBER}`}
            </button>

            <a
              href={dialLink(NETWORKS.find(n => n.id === network).ussd)}
              style={{
                flex: '1 1 140px', textAlign: 'center', padding: '11px', borderRadius: 8,
                background: '#E94560', color: '#fff', fontWeight: 700, fontSize: '.8rem',
                textDecoration: 'none',
              }}
            >
              📞 Dial {NETWORKS.find(n => n.id === network).ussd}
            </a>
          </div>

          <div style={{ fontSize: '.7rem', color: '#aaa', marginTop: 8, textAlign: 'center' }}>
            On iPhone, the code appears in your Phone app — tap the call button to continue.
          </div>

          <a
            href={waConfirmLink}
            target="_blank" rel="noreferrer"
            style={{
              display: 'block', textAlign: 'center', marginTop: 10, padding: '10px',
              borderRadius: 8, border: '1.5px solid #25D366', color: '#128C4A',
              fontWeight: 700, fontSize: '.78rem', textDecoration: 'none',
            }}
          >
            ✅ Already paid? Send us your reference
          </a>
        </div>
      )}
    </div>
  );
}
