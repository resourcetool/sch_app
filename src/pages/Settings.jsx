// src/pages/Settings.jsx
//
// Changes:
// - Added "School Logo" tab: upload a logo image, preview it, save as base64
//   to school.logoBase64 (stored in Firestore/IDB alongside all other school data).
//   Logo is automatically included in generated report card PDFs.
// - Added Report Card fields tab: Next Term Begins, Class Teacher name,
//   School Counsellor, Academic Head, Administrator — all saved to the school
//   document and used by reportService when generating PDFs.
// - School Type field added to School Info (used as subtitle in report header).
// - All existing tabs (Academic Year, Grading Scale, Promotion Rules) preserved.

import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }  from '../contexts/AuthContext';
import { defaultGradingScale }         from '../services/scoreService';
import { requestAccountDeletion }      from '../services/superAdminService';
import { useSubscription }             from '../contexts/SubscriptionContext';
import { DEFAULT_PROMOTION_RULES } from '../services/promotionService';

// ── ACCOUNT DELETION PANEL ───────────────────────────────────────
function AccountDeletionPanel({ school, schoolId, subscription }) {
  const { userProfile } = useAuth();
  const [phase,    setPhase]    = useState('info');  // info | confirm | requested
  const [reason,   setReason]   = useState('');
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [typedName,setTypedName]= useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const isPending = subscription?.status === 'deletion_requested';
  const deleteAfter = subscription?.deleteAfter
    ? new Date(subscription.deleteAfter).toLocaleDateString('en-GH', { dateStyle: 'long' })
    : null;

  async function handleSubmit() {
    if (typedName.trim() !== school?.name?.trim()) {
      setError('School name does not match. Please type it exactly.');
      return;
    }
    if (!confirm1 || !confirm2) {
      setError('Please tick both confirmation boxes.');
      return;
    }
    setLoading(true); setError('');
    try {
      await requestAccountDeletion(schoolId, userProfile.email, reason);
      setPhase('requested');
    } catch (err) {
      setError('Failed to submit request: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (isPending || phase === 'requested') {
    return (
      <div className="card" style={{ maxWidth: 580, border: '2px solid #ef5350' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>⏳</div>
        <div style={{ fontWeight: 700, color: '#c62828', fontSize: '1rem', marginBottom: 8 }}>
          Deletion Request Submitted
        </div>
        <div style={{ fontSize: '.85rem', color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 14 }}>
          Your account is now <strong>inactive</strong>. Your data is preserved until <strong>{deleteAfter || '60 days from now'}</strong>,
          after which it will be permanently deleted.
        </div>
        <div style={{ background: '#fff3e0', borderRadius: 8, padding: 12, fontSize: '.82rem', color: '#e65100', marginBottom: 14 }}>
          <strong>Changed your mind?</strong> You can cancel this request before the deletion date by contacting us on WhatsApp: 0549548274
        </div>
        <a
          href="https://wa.me/233549548274?text=Hello, I'd like to cancel my SchoolMS data deletion request."
          target="_blank" rel="noreferrer"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: 'none' }}
        >
          📱 Cancel Deletion Request
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 580 }}>
      {phase === 'info' && (
        <div className="card" style={{ border: '2px solid #ef5350' }}>
          <div style={{ fontWeight: 700, color: '#c62828', fontSize: '1rem', marginBottom: 10 }}>
            ⚠ Request Account Deletion
          </div>
          <div className="alert alert-danger" style={{ marginBottom: 14 }}>
            <strong>This is permanent and irreversible.</strong> Read carefully before proceeding.
          </div>
          {[
            ['What happens immediately', 'Your account is deactivated. No one can log in.'],
            ['What happens to your data', 'All data (students, scores, results, reports) is hidden but preserved for 60 days.'],
            ['Grace period', 'You have 60 days to cancel this request by contacting us. After that, data is permanently deleted.'],
            ['Before you proceed', 'Download your data from the Backup section first. Once deleted, data cannot be recovered.'],
          ].map(([h, b]) => (
            <div key={h} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '.83rem', color: 'var(--navy)' }}>{h}</div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>{b}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setPhase('confirm')} className="btn btn-danger">
              I Understand — Continue
            </button>
          </div>
        </div>
      )}

      {phase === 'confirm' && (
        <div className="card" style={{ border: '2px solid #ef5350' }}>
          <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 14 }}>Confirm Deletion Request</div>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="form-group">
            <label>Reason for deletion (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Switching to another system" />
          </div>
          <div className="form-group">
            <label>Type your school name to confirm *</label>
            <input
              value={typedName} onChange={e => setTypedName(e.target.value)}
              placeholder={school?.name}
              style={{ borderColor: typedName && typedName !== school?.name ? '#ef5350' : '' }}
            />
            <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Must match exactly: {school?.name}</span>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer', fontSize: '.84rem' }}>
            <input type="checkbox" checked={confirm1} onChange={e => setConfirm1(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            I understand my account will be deactivated immediately and data deleted after 60 days.
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer', fontSize: '.84rem' }}>
            <input type="checkbox" checked={confirm2} onChange={e => setConfirm2(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            I have downloaded or do not need my school's data export.
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setPhase('info')} className="btn btn-ghost">← Back</button>
            <button
              onClick={handleSubmit}
              className="btn btn-danger"
              disabled={loading || !confirm1 || !confirm2 || typedName !== school?.name}
            >
              {loading ? 'Submitting…' : '🗑 Submit Deletion Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { school, updateSchool, schoolId } = useSchool();
  const { subscription } = useSubscription();
  const [tab,         setTab]         = useState('school');
  const [schoolForm,  setSchoolForm]  = useState(null);
  const [gradingScale,setGradingScale]= useState([]);
  const [promoRules,  setPromoRules]  = useState({ ...DEFAULT_PROMOTION_RULES });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (school) {
      setSchoolForm({ ...school });
      setGradingScale(school.gradingScale || defaultGradingScale());
      setPromoRules(school.promotionRules || { ...DEFAULT_PROMOTION_RULES });
      setLogoPreview(school.logoBase64 || null);
    }
  }, [school]);

  async function saveSchoolInfo(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      await updateSchool(schoolForm);
      setSaved('school');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function saveGrading() {
    setSaving(true);
    try {
      await updateSchool({ gradingScale });
      setSaved('grading');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function savePromoRules() {
    setSaving(true);
    try {
      await updateSchool({ promotionRules: promoRules });
      setSaved('promo');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function saveLogo() {
    if (!logoPreview) { alert('No logo selected.'); return; }
    setSaving(true);
    try {
      await updateSchool({ logoBase64: logoPreview });
      setSaved('logo');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function saveReportFields() {
    setSaving(true);
    try {
      await updateSchool(schoolForm);
      setSaved('report');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Logo must be under 500 KB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setLogoPreview(ev.target.result);
      setSchoolForm(f => ({ ...f, logoBase64: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function updateGradeRow(i, field, val) {
    setGradingScale(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }
  function addGradeRow() {
    setGradingScale(prev => [...prev, { min: 0, max: 0, grade: '', remarks: '', isPassing: true }]);
  }
  function removeGradeRow(i) {
    setGradingScale(prev => prev.filter((_, idx) => idx !== i));
  }

  if (!schoolForm) return <div className="spinner-center"><div className="spinner" /></div>;

  const sf = schoolForm;
  const up = (k, v) => setSchoolForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      <div className="tabs">
        <button className={`tab${tab === 'school'  ? ' active' : ''}`} onClick={() => setTab('school')}>School Info</button>
        <button className={`tab${tab === 'logo'    ? ' active' : ''}`} onClick={() => setTab('logo')}>🖼 Logo</button>
        <button className={`tab${tab === 'report'  ? ' active' : ''}`} onClick={() => setTab('report')}>📄 Report Card</button>
        <button className={`tab${tab === 'academic'? ' active' : ''}`} onClick={() => setTab('academic')}>Academic Year</button>
        <button className={`tab${tab === 'grading' ? ' active' : ''}`} onClick={() => setTab('grading')}>Grading Scale</button>
        <button className={`tab${tab === 'promotion'?' active' : ''}`} onClick={() => setTab('promotion')}>Promotion Rules</button>
        <button className={`tab${tab === 'account' ? ' active' : ''}`} onClick={() => setTab('account')} style={{ color: tab === 'account' ? '#ef5350' : '' }}>⚠ Account</button>
      </div>

      {/* ── SCHOOL INFO ── */}
      {tab === 'school' && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-header"><span className="card-title">School Information</span></div>
          <form onSubmit={saveSchoolInfo}>
            <div className="form-grid">
              <div className="form-group full">
                <label>School Name *</label>
                <input required value={sf.name || ''} onChange={e => up('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>School Code</label>
                <input value={sf.code || ''} onChange={e => up('code', e.target.value)} />
              </div>
              <div className="form-group">
                <label>School Type / Level</label>
                <select value={sf.schoolType || ''} onChange={e => up('schoolType', e.target.value)}>
                  <option value="">— Select —</option>
                  <option>PRIMARY SCHOOL</option>
                  <option>JUNIOR HIGH SCHOOL</option>
                  <option>SENIOR HIGH SCHOOL</option>
                  <option>PRIMARY &amp; JHS</option>
                  <option>JHS &amp; SHS</option>
                  <option>PRIVATE BASIC</option>
                </select>
              </div>
              <div className="form-group full">
                <label>Address</label>
                <input value={sf.address || ''} onChange={e => up('address', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={sf.phone || ''} onChange={e => up('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={sf.email || ''} onChange={e => up('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={sf.website || ''} onChange={e => up('website', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Motto</label>
                <input value={sf.motto || ''} onChange={e => up('motto', e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <button type="submit" className={`btn ${saved === 'school' ? 'btn-success' : 'btn-primary'}`} disabled={saving}>
                {saving ? 'Saving…' : saved === 'school' ? '✓ Saved!' : 'Save School Info'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── LOGO ── */}
      {tab === 'logo' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header"><span className="card-title">School Logo</span></div>
          <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 16 }}>
            Your logo appears on the left and right sides of every generated report card.
            Upload a square PNG or JPG, maximum 500 KB.
          </p>

          {/* Preview */}
          <div style={{
            width: 140, height: 140, border: '2px dashed var(--border)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16, overflow: 'hidden',
            background: 'var(--surface2)',
          }}>
            {logoPreview ? (
              <img src={logoPreview} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-lt)' }}>
                <div style={{ fontSize: '2rem' }}>🏫</div>
                <div style={{ fontSize: '.75rem', marginTop: 4 }}>No logo yet</div>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: 'none' }}
            onChange={handleLogoFile}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              📁 Choose Image
            </button>
            {logoPreview && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { setLogoPreview(null); setSchoolForm(f => ({ ...f, logoBase64: null })); }}
              >
                Remove
              </button>
            )}
            <button
              className={`btn ${saved === 'logo' ? 'btn-success' : 'btn-primary'}`}
              onClick={saveLogo}
              disabled={saving || !logoPreview}
            >
              {saving ? 'Saving…' : saved === 'logo' ? '✓ Saved!' : '💾 Save Logo'}
            </button>
          </div>

          {logoPreview && (
            <div style={{ marginTop: 16, background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: '.78rem', color: 'var(--text-mid)', marginBottom: 4 }}>Preview on report header:</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px' }}>
                <img src={logoPreview} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--navy)' }}>{sf.name?.toUpperCase() || 'SCHOOL NAME'}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--navy)' }}>END OF SECOND TERM REPORT</div>
                </div>
                <img src={logoPreview} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPORT CARD FIELDS ── */}
      {tab === 'report' && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-header"><span className="card-title">Report Card Fields</span></div>
          <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 16 }}>
            These values appear on every generated report card. They can also be overridden per-student when printing.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Next Term Begins</label>
              <input
                type="date"
                value={sf.nextTermBegins || ''}
                onChange={e => up('nextTermBegins', e.target.value)}
              />
              <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Shown on report header</span>
            </div>
            {/* MEC field removed — the report now shows the actual class name
                (e.g. "JHS 1", "Class 6") assigned in the Classes page automatically.
                No manual entry needed. */}
            {/* Class/Exam Score Weight fields removed — these are now read
                directly per-subject from each subject's Max Class Score /
                Max Exam Score (set in the Subjects page). This guarantees
                the report card always shows the real weighting actually
                used to calculate that subject's total, instead of a
                separate school-wide setting that could fall out of sync. */}
            <div className="form-group full" style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', color: 'var(--text-mid)' }}>
              ℹ️ Class/Exam score weighting (e.g. 30%/70%) is now set per-subject in the
              <strong> Subjects</strong> page via Max Class Score and Max Exam Score. The report card
              automatically reflects each subject's real weighting.
            </div>
            <div className="form-group full" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem' }}>Signatories</span>
            </div>
            <div className="form-group">
              <label>Class Teacher's Name</label>
              <input value={sf.classTeacher || ''} onChange={e => up('classTeacher', e.target.value)} />
            </div>
            <div className="form-group">
              <label>School Counsellor's Name</label>
              <input value={sf.counsellor || ''} onChange={e => up('counsellor', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Academic Head's Name</label>
              <input value={sf.academicHead || ''} onChange={e => up('academicHead', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Administrator's Name</label>
              <input value={sf.administrator || ''} onChange={e => up('administrator', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button
              onClick={saveReportFields}
              className={`btn ${saved === 'report' ? 'btn-success' : 'btn-primary'}`}
              disabled={saving}
            >
              {saving ? 'Saving…' : saved === 'report' ? '✓ Saved!' : 'Save Report Fields'}
            </button>
          </div>
        </div>
      )}

      {/* ── ACADEMIC YEAR ── */}
      {tab === 'academic' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Academic Year Settings</span></div>
          <div className="alert alert-warning">
            Changing the academic year affects default filters across the system. Existing data is not affected.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Current Academic Year</label>
              <input value={sf.academicYear || ''} onChange={e => up('academicYear', e.target.value)} placeholder="2024/2025" />
            </div>
            <div className="form-group">
              <label>Current Term</label>
              <select value={sf.currentTerm || '1'} onChange={e => up('currentTerm', e.target.value)}>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={saveSchoolInfo} className={`btn ${saved === 'school' ? 'btn-success' : 'btn-primary'}`} disabled={saving}>
              {saving ? 'Saving…' : saved === 'school' ? '✓ Saved!' : 'Save Academic Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ── GRADING SCALE ── */}
      {tab === 'grading' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Grading Scale</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addGradeRow} className="btn btn-ghost btn-sm">+ Add Row</button>
              <button onClick={saveGrading} className={`btn btn-sm ${saved === 'grading' ? 'btn-success' : 'btn-primary'}`} disabled={saving}>
                {saving ? 'Saving…' : saved === 'grading' ? '✓ Saved!' : 'Save Scale'}
              </button>
            </div>
          </div>
          <div className="alert alert-info">
            Define your grading scale. Rows are applied top-to-bottom in the report card legend, and Grade No. is assigned by rank (row 1 = Grade No. 1).
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Grade No.</th><th>Min Score</th><th>Max Score</th>
                  <th>Grade</th><th>Remarks</th><th>Passing</th><th></th>
                </tr>
              </thead>
              <tbody>
                {gradingScale.map((row, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center', color: 'var(--text-lt)', fontWeight: 700 }}>{i + 1}</td>
                    <td><input type="number" min="0" max="100" value={row.min} onChange={e => updateGradeRow(i, 'min', +e.target.value)} style={{ width: 70 }} /></td>
                    <td><input type="number" min="0" max="100" value={row.max} onChange={e => updateGradeRow(i, 'max', +e.target.value)} style={{ width: 70 }} /></td>
                    <td><input type="text" value={row.grade}   onChange={e => updateGradeRow(i, 'grade',   e.target.value)} style={{ width: 70 }} /></td>
                    <td><input type="text" value={row.remarks} onChange={e => updateGradeRow(i, 'remarks', e.target.value)} style={{ width: 120 }} /></td>
                    <td><input type="checkbox" checked={row.isPassing} onChange={e => updateGradeRow(i, 'isPassing', e.target.checked)} /></td>
                    <td><button onClick={() => removeGradeRow(i)} className="btn btn-danger btn-sm btn-icon">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ACCOUNT (DELETION) ── */}
      {tab === 'account' && (
        <AccountDeletionPanel school={school} schoolId={schoolId} subscription={subscription} />
      )}

      {/* ── PROMOTION RULES ── */}
      {tab === 'promotion' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div className="card-header"><span className="card-title">Default Promotion Rules</span></div>
          <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 20 }}>
            These are the default rules applied during promotions. They can be overridden per promotion batch.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Promote if average ≥</label>
              <input type="number" min="0" max="100" value={promoRules.promoteThreshold} onChange={e => setPromoRules(r => ({ ...r, promoteThreshold: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Conditional minimum</label>
              <input type="number" min="0" max="100" value={promoRules.conditionalMin} onChange={e => setPromoRules(r => ({ ...r, conditionalMin: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Conditional maximum</label>
              <input type="number" min="0" max="100" value={promoRules.conditionalMax} onChange={e => setPromoRules(r => ({ ...r, conditionalMax: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Repeat if average &lt;</label>
              <input type="number" min="0" max="100" value={promoRules.repeatBelow} onChange={e => setPromoRules(r => ({ ...r, repeatBelow: +e.target.value }))} />
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginTop: 12, fontSize: '.82rem' }}>
            <strong>Current Rules:</strong><br />
            ≥ {promoRules.promoteThreshold} → Promote &nbsp;|&nbsp;
            {promoRules.conditionalMin}–{promoRules.conditionalMax} → Conditional &nbsp;|&nbsp;
            &lt; {promoRules.repeatBelow} → Repeat
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={savePromoRules} className={`btn ${saved === 'promo' ? 'btn-success' : 'btn-primary'}`} disabled={saving}>
              {saving ? 'Saving…' : saved === 'promo' ? '✓ Saved!' : 'Save Promotion Rules'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
