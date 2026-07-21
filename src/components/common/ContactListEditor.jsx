// src/components/common/ContactListEditor.jsx
//
// Lets a school have MORE than one contact email and phone number —
// e.g. the head admin plus an assistant/bursar who should also get
// renewal reminders and WhatsApp messages. Used identically on both the
// admin's own Settings page and super admin's School Detail view.
//
// Data shape: an array of { id, value, label }. The first entry in each
// list is treated as "primary" for anywhere in the app that still only
// reads a single value (e.g. WhatsApp remind buttons use contacts[0]).

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function ContactListEditor({
  type,            // 'email' | 'phone'
  items = [],
  onChange,        // (newItems) => void
  disabled = false,
}) {
  const [draftValue, setDraftValue] = useState('');
  const [draftLabel, setDraftLabel] = useState('');

  const isEmail = type === 'email';
  const icon = isEmail ? '📧' : '📱';
  const placeholder = isEmail ? 'name@example.com' : '0244 123 456';
  const labelPlaceholder = isEmail ? 'e.g. Assistant, Bursar' : 'e.g. Bursar, Front Desk';

  function validate(value) {
    if (!value.trim()) return false;
    if (isEmail) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    return value.replace(/\D/g, '').length >= 9; // loose phone check
  }

  function handleAdd() {
    if (!validate(draftValue)) return;
    const value = draftValue.trim();
    if (items.some(i => i.value.toLowerCase() === value.toLowerCase())) {
      setDraftValue('');
      return; // already in the list — silently ignore the duplicate
    }
    onChange([...items, { id: uuidv4(), value, label: draftLabel.trim() }]);
    setDraftValue('');
    setDraftLabel('');
  }

  function handleRemove(id) {
    onChange(items.filter(i => i.id !== id));
  }

  function handleMakePrimary(id) {
    const target = items.find(i => i.id === id);
    if (!target) return;
    onChange([target, ...items.filter(i => i.id !== id)]);
  }

  return (
    <div>
      {items.length === 0 ? (
        <p style={{ fontSize: '.8rem', color: 'var(--text-lt)', margin: '4px 0 10px' }}>
          No {isEmail ? 'emails' : 'phone numbers'} added yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: i === 0 ? '#e8f8f0' : '#fff',
            }}>
              <span>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.value}
                  {i === 0 && (
                    <span style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--success)', marginLeft: 8 }}>PRIMARY</span>
                  )}
                </div>
                {item.label && <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>{item.label}</div>}
              </div>
              {!disabled && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {i !== 0 && (
                    <button
                      type="button" onClick={() => handleMakePrimary(item.id)}
                      className="btn btn-ghost btn-sm" style={{ fontSize: '.68rem', padding: '2px 6px' }}
                      title="Make this the primary contact"
                    >
                      ★ Make Primary
                    </button>
                  )}
                  <button
                    type="button" onClick={() => handleRemove(item.id)}
                    className="btn btn-ghost btn-sm" style={{ fontSize: '.68rem', padding: '2px 6px', color: 'var(--danger)' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            type={isEmail ? 'email' : 'tel'}
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
            placeholder={placeholder}
            style={{ flex: '1 1 160px', fontSize: '.84rem' }}
          />
          <input
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            placeholder={labelPlaceholder}
            style={{ flex: '1 1 130px', fontSize: '.84rem' }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!validate(draftValue)}
            className="btn btn-primary btn-sm"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  );
}
