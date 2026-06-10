// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { defaultGradingScale } from '../services/scoreService';
import { DEFAULT_PROMOTION_RULES } from '../services/promotionService';

export default function Settings() {
  const { school, updateSchool } = useSchool();
  const [tab, setTab] = useState('school');
  const [schoolForm, setSchoolForm] = useState(null);
  const [gradingScale, setGradingScale] = useState([]);
  const [promoRules, setPromoRules] = useState({ ...DEFAULT_PROMOTION_RULES });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (school) {
      setSchoolForm({ ...school });
      setGradingScale(school.gradingScale || defaultGradingScale());
      setPromoRules(school.promotionRules || { ...DEFAULT_PROMOTION_RULES });
    }
  }, [school]);

  async function saveSchoolInfo(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSchool(schoolForm);
      setSaved('school');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveGrading() {
    setSaving(true);
    try {
      await updateSchool({ gradingScale });
      setSaved('grading');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePromoRules() {
    setSaving(true);
    try {
      await updateSchool({ promotionRules: promoRules });
      setSaved('promo');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateGradeRow(i, field, val) {
    setGradingScale(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: field === 'isPassing' ? val : val } : row));
  }

  function addGradeRow() {
    setGradingScale(prev => [...prev, { min: 0, max: 0, grade: '', remarks: '', isPassing: true }]);
  }

  function removeGradeRow(i) {
    setGradingScale(prev => prev.filter((_, idx) => idx !== i));
  }

  if (!schoolForm) return <div className="spinner-center"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>

      <div className="tabs">
        <button className={`tab${tab === 'school' ? ' active' : ''}`} onClick={() => setTab('school')}>School Info</button>
        <button className={`tab${tab === 'academic' ? ' active' : ''}`} onClick={() => setTab('academic')}>Academic Year</button>
        <button className={`tab${tab === 'grading' ? ' active' : ''}`} onClick={() => setTab('grading')}>Grading Scale</button>
        <button className={`tab${tab === 'promotion' ? ' active' : ''}`} onClick={() => setTab('promotion')}>Promotion Rules</button>
      </div>

      {/* School Info */}
      {tab === 'school' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-header"><span className="card-title">School Information</span></div>
          <form onSubmit={saveSchoolInfo}>
            <div className="form-grid">
              <div className="form-group full">
                <label>School Name *</label>
                <input required value={schoolForm.name || ''} onChange={e => setSchoolForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>School Code</label>
                <input maxLength={6} value={schoolForm.code || ''} onChange={e => setSchoolForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={schoolForm.phone || ''} onChange={e => setSchoolForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Address</label>
                <input value={schoolForm.address || ''} onChange={e => setSchoolForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={schoolForm.email || ''} onChange={e => setSchoolForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={schoolForm.website || ''} onChange={e => setSchoolForm(f => ({ ...f, website: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Motto</label>
                <input value={schoolForm.motto || ''} onChange={e => setSchoolForm(f => ({ ...f, motto: e.target.value }))} />
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

      {/* Academic Year */}
      {tab === 'academic' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Academic Year Settings</span></div>
          <div className="alert alert-warning">
            Changing the academic year affects default filters across the system. Existing data is not affected.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Current Academic Year</label>
              <input value={schoolForm.academicYear || ''} onChange={e => setSchoolForm(f => ({ ...f, academicYear: e.target.value }))} placeholder="2024/2025" />
            </div>
            <div className="form-group">
              <label>Current Term</label>
              <select value={schoolForm.currentTerm || '1'} onChange={e => setSchoolForm(f => ({ ...f, currentTerm: e.target.value }))}>
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

      {/* Grading Scale */}
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
            Define the grading scale for your school. Grades are applied from top to bottom — order matters.
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Min Score</th>
                  <th>Max Score</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                  <th>Passing</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gradingScale.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input type="number" min="0" max="100" value={row.min} onChange={e => updateGradeRow(i, 'min', +e.target.value)} style={{ width: 70 }} />
                    </td>
                    <td>
                      <input type="number" min="0" max="100" value={row.max} onChange={e => updateGradeRow(i, 'max', +e.target.value)} style={{ width: 70 }} />
                    </td>
                    <td>
                      <input type="text" value={row.grade} onChange={e => updateGradeRow(i, 'grade', e.target.value)} style={{ width: 70 }} />
                    </td>
                    <td>
                      <input type="text" value={row.remarks} onChange={e => updateGradeRow(i, 'remarks', e.target.value)} style={{ width: 120 }} />
                    </td>
                    <td>
                      <input type="checkbox" checked={row.isPassing} onChange={e => updateGradeRow(i, 'isPassing', e.target.checked)} />
                    </td>
                    <td>
                      <button onClick={() => removeGradeRow(i)} className="btn btn-danger btn-sm btn-icon">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promotion Rules */}
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
              <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>Students above this average are promoted</span>
            </div>
            <div className="form-group">
              <label>Conditional minimum</label>
              <input type="number" min="0" max="100" value={promoRules.conditionalMin} onChange={e => setPromoRules(r => ({ ...r, conditionalMin: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Conditional maximum</label>
              <input type="number" min="0" max="100" value={promoRules.conditionalMax} onChange={e => setPromoRules(r => ({ ...r, conditionalMax: +e.target.value }))} />
              <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>Students in this range require review</span>
            </div>
            <div className="form-group">
              <label>Repeat if average &lt;</label>
              <input type="number" min="0" max="100" value={promoRules.repeatBelow} onChange={e => setPromoRules(r => ({ ...r, repeatBelow: +e.target.value }))} />
              <span style={{ fontSize: '.74rem', color: 'var(--text-lt)' }}>Students below this average repeat class</span>
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
