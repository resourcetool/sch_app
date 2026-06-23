// src/components/PasswordInput.jsx
// Reusable password input with live strength meter and requirement checklist.
// Shows real-time feedback as the user types — no surprises on submit.

import React, { useState } from 'react';
import { checkPasswordStrength } from '../utils/validation';

export default function PasswordInput({ value, onChange, label = 'Password', placeholder = 'Min 8 characters', required = true, showStrength = true }) {
  const [show, setShow] = useState(false);
  const strength = showStrength && value ? checkPasswordStrength(value) : null;

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label>{label}{required && ' *'}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
          style={{ paddingRight: 44, width: '100%' }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 2 }}
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>

      {/* Strength bar */}
      {strength && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= strength.score - 1 ? strength.color : '#e0e0e0',
                transition: 'background .2s',
              }} />
            ))}
          </div>
          <div style={{ fontSize: '.72rem', color: strength.color, fontWeight: 600, marginBottom: 3 }}>
            {strength.label}
          </div>
          {strength.errors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {strength.errors.map(e => (
                <div key={e} style={{ fontSize: '.7rem', color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#ef5350', fontWeight: 700 }}>✕</span> {e}
                </div>
              ))}
            </div>
          )}
          {strength.score === 4 && (
            <div style={{ fontSize: '.72rem', color: '#43a047', fontWeight: 600 }}>✓ Strong password</div>
          )}
        </div>
      )}
    </div>
  );
}
