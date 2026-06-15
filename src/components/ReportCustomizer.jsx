// src/components/ReportCustomizer.jsx
//
// Admin can customise the report card appearance and draw/upload signatures.
// Settings saved to school.reportStyle in Firestore/IDB.
// Signature can be drawn on a canvas or uploaded as an image.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';

const FONT_OPTIONS  = ['helvetica', 'times', 'courier'];
const BORDER_STYLES = ['single', 'double', 'none'];

const DEFAULTS = {
  primaryColor:   '#0f3460',
  accentColor:    '#e94560',
  tableHeaderBg:  '#0f3460',
  tableHeaderText:'#ffffff',
  borderStyle:    'single',
  fontSize:       8,
  titleFontSize:  13,
  font:           'helvetica',
  showLogo:       true,
  showWatermark:  false,
  headerBg:       '#ffffff',
};

const SIGNATORIES = [
  { key: 'classTeacher',   label: "Class Teacher" },
  { key: 'counsellor',     label: "School Counsellor" },
  { key: 'academicHead',   label: "Academic Head" },
  { key: 'administrator',  label: "Administrator" },
];

// ── SIGNATURE PAD ─────────────────────────────────────────────────
function SignaturePad({ value, onChange, label }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef(null);
  const [mode, setMode]     = useState('draw');   // 'draw' | 'upload'
  const [hasDrawn, setHasDrawn] = useState(false);
  const fileRef    = useRef();

  // Restore existing signature to canvas
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasDrawn(true);
      }
    };
    img.src = value;
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function startDraw(e) {
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const pos    = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    // Export to base64
    onChange(canvasRef.current.toDataURL('image/png'));
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
    onChange(null);
  }

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Scale to fit
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        onChange(canvas.toDataURL('image/png'));
        setHasDrawn(true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--navy)' }}>{label}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '.72rem', padding: '3px 8px' }}
          >
            ✏ Draw
          </button>
          <button
            type="button"
            onClick={() => { setMode('upload'); fileRef.current?.click(); }}
            className={`btn btn-sm ${mode === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '.72rem', padding: '3px 8px' }}
          >
            📁 Upload
          </button>
          {hasDrawn && (
            <button type="button" onClick={clearCanvas} className="btn btn-danger btn-sm" style={{ fontSize: '.72rem', padding: '3px 8px' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={260}
        height={70}
        style={{
          border: '1.5px solid var(--border)',
          borderRadius: 8,
          background: '#fafafa',
          cursor: mode === 'draw' ? 'crosshair' : 'default',
          touchAction: 'none',
          display: 'block',
          width: '100%',
          maxWidth: 260,
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {mode === 'draw' && !hasDrawn && (
        <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', marginTop: 3 }}>
          Draw signature above with mouse or finger
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
    </div>
  );
}

// ── COLOUR PICKER ROW ─────────────────────────────────────────────
function ColorRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <label style={{ flex: 1, fontSize: '.82rem', color: 'var(--text-mid)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--text-lt)' }}>{value}</span>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function ReportCustomizer({ onClose }) {
  const { school, updateSchool } = useSchool();

  const [style, setStyle]  = useState({ ...DEFAULTS, ...(school?.reportStyle || {}) });
  const [sigs,  setSigs]   = useState({
    classTeacher:  school?.signatures?.classTeacher  || null,
    counsellor:    school?.signatures?.counsellor    || null,
    academicHead:  school?.signatures?.academicHead  || null,
    administrator: school?.signatures?.administrator || null,
  });
  const [tab,    setTab]   = useState('style');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const up = (k, v) => setStyle(s => ({ ...s, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      await updateSchool({ reportStyle: style, signatures: sigs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (window.confirm('Reset all style settings to defaults?')) setStyle({ ...DEFAULTS });
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span className="modal-title">🎨 Customise Report Card</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>

        <div className="tabs" style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button className={`tab${tab === 'style'      ? ' active' : ''}`} onClick={() => setTab('style')}>Style & Colors</button>
          <button className={`tab${tab === 'signatures' ? ' active' : ''}`} onClick={() => setTab('signatures')}>Signatures</button>
          <button className={`tab${tab === 'layout'     ? ' active' : ''}`} onClick={() => setTab('layout')}>Layout</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── STYLE TAB ── */}
          {tab === 'style' && (
            <>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 12, fontSize: '.88rem' }}>Colors</div>
              <ColorRow label="Primary color (header, borders)" value={style.primaryColor}    onChange={v => up('primaryColor', v)} />
              <ColorRow label="Accent color (highlights)"       value={style.accentColor}     onChange={v => up('accentColor', v)} />
              <ColorRow label="Table header background"         value={style.tableHeaderBg}   onChange={v => up('tableHeaderBg', v)} />
              <ColorRow label="Table header text"               value={style.tableHeaderText} onChange={v => up('tableHeaderText', v)} />
              <ColorRow label="Report header background"        value={style.headerBg}        onChange={v => up('headerBg', v)} />

              <div style={{ fontWeight: 700, color: 'var(--navy)', margin: '18px 0 12px', fontSize: '.88rem' }}>Typography</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Font Family</label>
                  <select value={style.font} onChange={e => up('font', e.target.value)}>
                    <option value="helvetica">Helvetica (Modern)</option>
                    <option value="times">Times New Roman (Classic)</option>
                    <option value="courier">Courier (Monospace)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Body Font Size (pt)</label>
                  <input type="number" min="6" max="12" value={style.fontSize} onChange={e => up('fontSize', Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Title Font Size (pt)</label>
                  <input type="number" min="10" max="20" value={style.titleFontSize} onChange={e => up('titleFontSize', Number(e.target.value))} />
                </div>
              </div>

              <button onClick={resetDefaults} className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>↺ Reset to Defaults</button>
            </>
          )}

          {/* ── SIGNATURES TAB ── */}
          {tab === 'signatures' && (
            <>
              <p style={{ fontSize: '.83rem', color: 'var(--text-mid)', marginBottom: 16 }}>
                Draw or upload each signatory's signature. It will appear on every generated report card.
                Signatures are saved securely with your school settings.
              </p>
              {SIGNATORIES.map(sig => (
                <SignaturePad
                  key={sig.key}
                  label={sig.label}
                  value={sigs[sig.key]}
                  onChange={v => setSigs(s => ({ ...s, [sig.key]: v }))}
                />
              ))}
            </>
          )}

          {/* ── LAYOUT TAB ── */}
          {tab === 'layout' && (
            <>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Border Style</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {BORDER_STYLES.map(b => (
                      <button
                        key={b} type="button"
                        onClick={() => up('borderStyle', b)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${style.borderStyle === b ? 'var(--navy)' : 'var(--border)'}`,
                          background: style.borderStyle === b ? 'var(--navy)' : '#fff',
                          color: style.borderStyle === b ? '#fff' : 'var(--text-mid)',
                          fontWeight: style.borderStyle === b ? 700 : 400,
                          fontSize: '.82rem', textTransform: 'capitalize',
                        }}
                      >
                        {b === 'single' ? '▭ Single' : b === 'double' ? '▣ Double' : '☐ None'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={style.showLogo} onChange={e => up('showLogo', e.target.checked)} />
                    Show school logo on report
                  </label>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={style.showWatermark} onChange={e => up('showWatermark', e.target.checked)} />
                    Show "DRAFT" watermark
                  </label>
                </div>
              </div>

              {/* Preview swatch */}
              <div style={{ marginTop: 16, border: `2px solid ${style.primaryColor}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: style.tableHeaderBg, color: style.tableHeaderText, padding: '8px 14px', fontFamily: style.font === 'times' ? 'serif' : style.font === 'courier' ? 'monospace' : 'sans-serif', fontSize: style.titleFontSize * 0.85 + 'px', fontWeight: 700, textAlign: 'center' }}>
                  {school?.name?.toUpperCase() || 'SCHOOL NAME'} — REPORT CARD PREVIEW
                </div>
                <div style={{ padding: '8px 14px', fontSize: style.fontSize * 1.2 + 'px', fontFamily: style.font === 'times' ? 'serif' : style.font === 'courier' ? 'monospace' : 'sans-serif', color: '#333' }}>
                  <span style={{ color: style.primaryColor, fontWeight: 700 }}>Student Name: </span>Sample Student &nbsp;|&nbsp;
                  <span style={{ color: style.primaryColor, fontWeight: 700 }}>Class: </span>JHS 1
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: style.fontSize * 1.2 + 'px' }}>
                  <thead>
                    <tr style={{ background: style.tableHeaderBg, color: style.tableHeaderText }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Subject</th>
                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Class</th>
                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Exam</th>
                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Total</th>
                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[['Mathematics','28.00','65.00','93.00','A1'],['English','24.50','58.00','82.50','B2']].map(([s,c,e,t,g]) => (
                      <tr key={s} style={{ borderBottom: `1px solid #eee` }}>
                        <td style={{ padding: '3px 8px' }}>{s}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'center' }}>{c}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'center' }}>{e}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'center', fontWeight: 700 }}>{t}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'center', color: style.accentColor, fontWeight: 700 }}>{g}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">Close</button>
          <button onClick={handleSave} className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
