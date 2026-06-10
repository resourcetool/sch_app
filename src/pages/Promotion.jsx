// src/pages/Promotion.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';
import {
  validatePromotionReadiness, buildPromotionPreview, executePromotion,
  getAllPromotionAudits, PROMOTION_STATUS, DEFAULT_PROMOTION_RULES
} from '../services/promotionService';

const STEPS = ['1. Select', '2. Validate', '3. Preview', '4. Execute', '5. Done'];

function DecisionBadge({ decision }) {
  const map = {
    [PROMOTION_STATUS.PROMOTE]:     { cls: 'decision-promote',     label: '↑ Promote'     },
    [PROMOTION_STATUS.REPEAT]:      { cls: 'decision-repeat',      label: '↺ Repeat'      },
    [PROMOTION_STATUS.CONDITIONAL]: { cls: 'decision-conditional', label: '⚠ Conditional' },
    [PROMOTION_STATUS.GRADUATED]:   { cls: 'decision-graduated',   label: '🎓 Graduate'   }
  };
  const d = map[decision] || { cls: '', label: decision };
  return <span className={d.cls}>{d.label}</span>;
}

export default function Promotion() {
  const { school, classes, schoolId } = useSchool();
  const { userProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('new'); // 'new' | 'history'

  // Selection state
  const [sel, setSel] = useState({
    classId: '', nextClassId: '', academicYear: school?.academicYear || '',
    term: school?.currentTerm || '1', nextAcademicYear: '', nextTerm: '1',
    isLastClass: false
  });
  const [rules, setRules] = useState({ ...DEFAULT_PROMOTION_RULES });
  const [adminNote, setAdminNote] = useState('');

  // Step data
  const [validation, setValidation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [auditLog, setAuditLog] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (tab === 'history' && schoolId) {
      getAllPromotionAudits(schoolId).then(h => setHistory(h.sort((a, b) => b.timestamp - a.timestamp)));
    }
  }, [tab, schoolId]);

  async function handleValidate(e) {
    e.preventDefault();
    if (!sel.classId || !sel.academicYear || !sel.term) { alert('Fill all fields'); return; }
    setLoading(true);
    try {
      const result = await validatePromotionReadiness(schoolId, sel.classId, sel.academicYear, sel.term);
      setValidation(result);
      setStep(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildPreview() {
    setLoading(true);
    try {
      const result = await buildPromotionPreview(
        schoolId, sel.classId, sel.nextClassId,
        sel.academicYear, sel.term,
        sel.nextAcademicYear || sel.academicYear,
        sel.nextTerm, rules, sel.isLastClass
      );
      setPreview(result);
      setStep(2);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function overrideDecision(enrollmentId, decision) {
    setPreview(prev => ({
      ...prev,
      preview: prev.preview.map(p =>
        p.enrollmentId === enrollmentId ? { ...p, overrideDecision: decision } : p
      )
    }));
  }

  async function handleExecute() {
    if (!window.confirm(`Execute promotion for ${preview?.preview?.length} students?\n\nThis action creates new enrollment records and cannot be undone.`)) return;
    setExecuting(true);
    try {
      const log = await executePromotion(
        schoolId, sel.classId, sel.nextClassId,
        sel.academicYear, sel.term,
        sel.nextAcademicYear || sel.academicYear,
        sel.nextTerm, preview, userProfile?.id || 'admin', adminNote
      );
      setAuditLog(log);
      setStep(3);
    } catch (err) {
      alert(err.message);
    } finally {
      setExecuting(false);
    }
  }

  function handleReset() {
    setStep(0); setValidation(null); setPreview(null); setAuditLog(null);
    setSel(s => ({ ...s, classId: '', nextClassId: '' }));
  }

  const selectedClass = classes.find(c => c.id === sel.classId);
  const nextClass = classes.find(c => c.id === sel.nextClassId);

  return (
    <div>
      <div className="page-header">
        <h1>Promotion Engine</h1>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'new' ? ' active' : ''}`} onClick={() => setTab('new')}>New Promotion</button>
        <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Promotion History</button>
      </div>

      {tab === 'new' && (
        <>
          {/* Step indicator */}
          <div className="steps-bar" style={{ marginBottom: 24 }}>
            {STEPS.map((s, i) => (
              <div key={i} className={`step-item${i === step ? ' active' : i < step ? ' done' : ''}`}>{s}</div>
            ))}
          </div>

          {/* STEP 0: Select */}
          {step === 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Step 1 — Select Class & Term</span></div>
              <form onSubmit={handleValidate}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Class to Promote *</label>
                    <select required value={sel.classId} onChange={e => setSel(s => ({ ...s, classId: e.target.value }))}>
                      <option value="">— Select Source Class —</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Next Class</label>
                    <select value={sel.nextClassId} onChange={e => setSel(s => ({ ...s, nextClassId: e.target.value }))} disabled={sel.isLastClass}>
                      <option value="">— Select Destination Class —</option>
                      {classes.filter(c => c.id !== sel.classId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Academic Year *</label>
                    <input required value={sel.academicYear} onChange={e => setSel(s => ({ ...s, academicYear: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Term *</label>
                    <select value={sel.term} onChange={e => setSel(s => ({ ...s, term: e.target.value }))}>
                      <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Next Academic Year</label>
                    <input value={sel.nextAcademicYear} onChange={e => setSel(s => ({ ...s, nextAcademicYear: e.target.value }))} placeholder={sel.academicYear} />
                  </div>
                  <div className="form-group">
                    <label>Next Term</label>
                    <select value={sel.nextTerm} onChange={e => setSel(s => ({ ...s, nextTerm: e.target.value }))}>
                      <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
                    </select>
                  </div>

                  {/* Promotion Rules */}
                  <div className="form-group full" style={{ marginTop: 8 }}>
                    <label style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8, display: 'block' }}>Promotion Rules</label>
                    <div className="form-grid" style={{ background: 'var(--surface2)', padding: 14, borderRadius: 8 }}>
                      <div className="form-group">
                        <label>Promote if average ≥</label>
                        <input type="number" value={rules.promoteThreshold} onChange={e => setRules(r => ({ ...r, promoteThreshold: +e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Conditional min</label>
                        <input type="number" value={rules.conditionalMin} onChange={e => setRules(r => ({ ...r, conditionalMin: +e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Conditional max</label>
                        <input type="number" value={rules.conditionalMax} onChange={e => setRules(r => ({ ...r, conditionalMax: +e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Repeat if below</label>
                        <input type="number" value={rules.repeatBelow} onChange={e => setRules(r => ({ ...r, repeatBelow: +e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="form-group full">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={sel.isLastClass} onChange={e => setSel(s => ({ ...s, isLastClass: e.target.checked }))} />
                      This is a final/graduating class (students will be marked as Graduated)
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Validating…' : 'Validate & Continue →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 1: Validation Result */}
          {step === 1 && validation && (
            <div className="card">
              <div className="card-header"><span className="card-title">Step 2 — Validation Report</span></div>
              {validation.valid ? (
                <div className="alert alert-success">
                  ✓ All validation checks passed. {validation.resultCount} result(s) found. Ready to preview promotion.
                </div>
              ) : (
                <div className="alert alert-danger">
                  <strong>Validation Failed</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {validation.warnings?.map((w, i) => (
                <div key={i} className="alert alert-warning">{w}</div>
              ))}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setStep(0)} className="btn btn-ghost">← Back</button>
                {validation.valid && (
                  <button onClick={handleBuildPreview} className="btn btn-primary" disabled={loading}>
                    {loading ? 'Building Preview…' : 'Build Promotion Preview →'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 2 && preview && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Step 3 — Promotion Preview</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['promote', 'repeat', 'conditional', 'graduated'].map(k => (
                    <span key={k} className={`badge badge-${k === 'promote' ? 'success' : k === 'repeat' ? 'danger' : k === 'conditional' ? 'warning' : 'info'}`}>
                      {preview.summary[k]} {k}
                    </span>
                  ))}
                </div>
              </div>

              <div className="alert alert-warning">
                Review each student's decision. You may override individual decisions before executing.
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Admin Note (optional)</label>
                <input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="e.g. End of 2024/2025 academic year promotion" />
              </div>

              <div className="table-wrap">
                <table className="promotion-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Average</th>
                      <th>Position</th>
                      <th>Current Class</th>
                      <th>Next Class</th>
                      <th>Decision</th>
                      <th>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((p, i) => {
                      const effective = p.overrideDecision || p.decision;
                      return (
                        <tr key={p.enrollmentId} style={{ background: p.overrideDecision ? '#fff8e1' : '' }}>
                          <td>{i + 1}</td>
                          <td className="td-mono">{p.studentCode}</td>
                          <td style={{ fontWeight: 600 }}>{p.studentName}</td>
                          <td>{p.average}%</td>
                          <td>{p.position}</td>
                          <td>{p.currentClass}</td>
                          <td>{p.nextClass}</td>
                          <td><DecisionBadge decision={effective} /></td>
                          <td>
                            <select
                              value={p.overrideDecision || ''}
                              onChange={e => overrideDecision(p.enrollmentId, e.target.value || null)}
                              style={{ fontSize: '.78rem', padding: '3px 6px', borderRadius: 4 }}
                            >
                              <option value="">Auto</option>
                              <option value={PROMOTION_STATUS.PROMOTE}>Promote</option>
                              <option value={PROMOTION_STATUS.REPEAT}>Repeat</option>
                              <option value={PROMOTION_STATUS.CONDITIONAL}>Conditional</option>
                              {sel.isLastClass && <option value={PROMOTION_STATUS.GRADUATED}>Graduate</option>}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button onClick={() => setStep(1)} className="btn btn-ghost">← Back</button>
                <button onClick={handleExecute} className="btn btn-accent btn-lg" disabled={executing}>
                  {executing ? 'Executing Promotion…' : '🚀 Execute Promotion'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 3 && auditLog && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 3 + 'rem', marginBottom: 16 }}>🎉</div>
              <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Promotion Complete!</h2>
              <p style={{ color: 'var(--text-mid)', marginBottom: 24 }}>Audit log recorded. All enrollment records updated.</p>

              <div className="stats-grid" style={{ maxWidth: 500, margin: '0 auto 28px', textAlign: 'left' }}>
                <div className="stat-card green"><span className="label">Promoted</span><span className="value">{auditLog.summary.promoted}</span></div>
                <div className="stat-card accent"><span className="label">Repeated</span><span className="value">{auditLog.summary.repeated}</span></div>
                <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}><span className="label">Conditional</span><span className="value">{auditLog.summary.conditional}</span></div>
                <div className="stat-card blue"><span className="label">Graduated</span><span className="value">{auditLog.summary.graduated}</span></div>
              </div>

              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 20px', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px', textAlign: 'left' }}>
                <div style={{ fontSize: '.78rem', color: 'var(--text-lt)' }}>Promotion ID</div>
                <div className="td-mono" style={{ fontSize: '.82rem' }}>{auditLog.id}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-lt)', marginTop: 6 }}>Executed</div>
                <div style={{ fontSize: '.84rem' }}>{new Date(auditLog.timestamp).toLocaleString()}</div>
              </div>

              <button onClick={handleReset} className="btn btn-primary btn-lg">Start New Promotion</button>
            </div>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>No promotion history yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From Class</th>
                    <th>Year/Term</th>
                    <th>Promoted</th>
                    <th>Repeated</th>
                    <th>Conditional</th>
                    <th>Graduated</th>
                    <th>Total</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const fromCls = classes.find(c => c.id === h.fromClassId);
                    return (
                      <tr key={h.id}>
                        <td style={{ fontSize: '.8rem' }}>{new Date(h.timestamp).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{fromCls?.name || h.fromClassId}</td>
                        <td className="td-mono">{h.fromAcademicYear} T{h.fromTerm}</td>
                        <td><span className="badge badge-success">{h.summary?.promoted || 0}</span></td>
                        <td><span className="badge badge-danger">{h.summary?.repeated || 0}</span></td>
                        <td><span className="badge badge-warning">{h.summary?.conditional || 0}</span></td>
                        <td><span className="badge badge-info">{h.summary?.graduated || 0}</span></td>
                        <td style={{ fontWeight: 700 }}>{h.summary?.total || 0}</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>{h.adminNote || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
