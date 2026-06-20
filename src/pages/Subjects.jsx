// src/pages/Subjects.jsx
// Redesigned for speed:
// - Inline quick-add row (no modal for simple adds)
// - Bulk add: paste list of subject names
// - Class assignment done with pill toggles in the edit panel
// - Scores weight shown as a mini-bar
// - All writes via writeRecord (IDB → Firestore)

import React, { useState, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord, deleteRecord } from '../services/syncService';

const COMMON_SUBJECTS = [
  'English Language', 'Mathematics', 'Integrated Science', 'Social Studies',
  'Religious & Moral Education', 'Creative Arts', 'Computing / ICT',
  'Career Technology', 'French', 'Ghanaian Language', 'Physical Education',
  'History', 'Economics', 'Elective Mathematics', 'Biology', 'Chemistry', 'Physics',
];

function EditModal({ subject, classes, onClose, onSave }) {
  const [form, setForm] = useState({
    name:          subject.name,
    code:          subject.code          || '',
    maxClassScore: subject.maxClassScore ?? 30,
    maxExamScore:  subject.maxExamScore  ?? 70,
    classIds:      subject.classIds      || [],
    description:   subject.description  || '',
  });
  const [saving, setSaving] = useState(false);

  function toggleClass(id) {
    setForm(f => ({
      ...f,
      classIds: f.classIds.includes(id)
        ? f.classIds.filter(x => x !== id)
        : [...f.classIds, id],
    }));
  }

  function selectAll()   { setForm(f => ({ ...f, classIds: classes.map(c => c.id) })); }
  function deselectAll() { setForm(f => ({ ...f, classIds: [] })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ ...subject, ...form }); onClose(); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const total = (Number(form.maxClassScore) || 0) + (Number(form.maxExamScore) || 0);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Subject — {subject.name}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full">
                <label>Subject Name *</label>
                <input
                  required list="subj-list"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
                <datalist id="subj-list">
                  {COMMON_SUBJECTS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Subject Code</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MATH"
                  maxLength={6}
                />
              </div>
              <div className="form-group">
                <label>Max Class Score</label>
                <input
                  type="number" min="0" max="100"
                  value={form.maxClassScore}
                  onChange={e => setForm(f => ({ ...f, maxClassScore: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Max Exam Score</label>
                <input
                  type="number" min="0" max="100"
                  value={form.maxExamScore}
                  onChange={e => setForm(f => ({ ...f, maxExamScore: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
                <div style={{ fontSize: '.78rem', color: 'var(--text-mid)' }}>Total: <strong>{total}</strong></div>
                <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 4, background: 'var(--border)' }}>
                  <div style={{ width: `${(form.maxClassScore / total) * 100 || 0}%`, background: '#2980b9' }} />
                  <div style={{ width: `${(form.maxExamScore  / total) * 100 || 0}%`, background: '#e94560' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: '.68rem', color: 'var(--text-lt)', marginTop: 3 }}>
                  <span style={{ color: '#2980b9' }}>■ Class</span>
                  <span style={{ color: '#e94560' }}>■ Exam</span>
                </div>
              </div>

              <div className="form-group full">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ margin: 0 }}>Assign to Classes</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={selectAll}   className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem' }}>All</button>
                    <button type="button" onClick={deselectAll} className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem' }}>None</button>
                  </div>
                </div>
                {classes.length === 0
                  ? <span style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No classes yet — add classes first.</span>
                  : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {classes.map(c => {
                        const on = form.classIds.includes(c.id);
                        return (
                          <button
                            key={c.id} type="button"
                            onClick={() => toggleClass(c.id)}
                            style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: '.8rem',
                              border: `1.5px solid ${on ? 'var(--navy)' : 'var(--border)'}`,
                              background: on ? 'var(--navy)' : '#fff',
                              color: on ? '#fff' : 'var(--text-mid)',
                              cursor: 'pointer', fontWeight: on ? 700 : 400,
                              transition: 'all .15s',
                            }}
                          >
                            {on ? '✓ ' : ''}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  )
                }
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Subjects() {
  const { subjects, classes, schoolId, refresh } = useSchool();
  const [editing,    setEditing]    = useState(null);
  const [showBulk,   setShowBulk]   = useState(false);
  const [bulkText,   setBulkText]   = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);

  // Quick-add inline
  const [quickName,   setQuickName]   = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const nameRef = useRef();

  async function saveSubject(data) {
    const id     = data.id || uuidv4();
    const record = {
      id, schoolId,
      name:          data.name.trim(),
      code:          (data.code || data.name.substring(0, 4).toUpperCase()).toUpperCase(),
      maxClassScore: Number(data.maxClassScore) || 30,
      maxExamScore:  Number(data.maxExamScore)  || 70,
      classIds:      data.classIds || [],
      description:   data.description || '',
      updatedAt:     Date.now(),
    };
    if (!data.id) record.createdAt = Date.now();
    await writeRecord('subjects', id, record, schoolId);
    await refresh();
  }

  // Removing a subject is a HARD delete (Firestore rules allow it for admins).
  // Warns the admin if the subject is assigned to any classes, since deleting
  // it removes it from the score entry grid and reports going forward.
  // Any scores already entered for this subject remain in the database for
  // historical/audit purposes, but will no longer appear in NEW reports
  // since report generation looks up subjects by current assignment.
  async function handleRemoveSubject(subject) {
    const assignedCount = classes.filter(c => subject.classIds?.includes(c.id) || c.subjectIds?.includes(subject.id)).length;
    const warning = assignedCount > 0
      ? `"${subject.name}" is assigned to ${assignedCount} class(es).\n\n` +
        `Deleting it will remove it from score entry and future reports for those classes. ` +
        `Previously entered scores remain in the database for historical records.\n\n` +
        `Delete "${subject.name}" anyway?`
      : `Delete subject "${subject.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    try {
      await deleteRecord('subjects', subject.id);
      await refresh();
    } catch (err) {
      alert('Failed to delete subject: ' + err.message);
    }
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickAdding(true);
    try {
      await saveSubject({ name: quickName.trim(), classIds: [] });
      setQuickName('');
      nameRef.current?.focus();
    } catch (err) { alert(err.message); }
    finally { setQuickAdding(false); }
  }

  async function handleBulkAdd() {
    const names = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (names.length === 0) return;
    setBulkAdding(true);
    try {
      for (const name of names) await saveSubject({ name, classIds: [] });
      setBulkText('');
      setShowBulk(false);
    } catch (err) { alert(err.message); }
    finally { setBulkAdding(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Subjects <span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-lt)' }}>({subjects.length})</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowBulk(b => !b)}>
          {showBulk ? '✕ Cancel' : '📋 Bulk Add'}
        </button>
      </div>

      {showBulk && (
        <div className="card" style={{ marginBottom: 12, background: '#fffde7', border: '1px solid #f9a825' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--navy)' }}>Bulk Add Subjects</div>
          <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginBottom: 8 }}>One subject per line. Assign classes after.</p>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '.76rem', color: 'var(--text-lt)', marginBottom: 6 }}>Common subjects (click to add to list):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {COMMON_SUBJECTS.filter(s => !subjects.find(ex => ex.name === s)).slice(0, 12).map(s => (
                <button
                  key={s} type="button"
                  onClick={() => setBulkText(t => t ? t + '\n' + s : s)}
                  style={{ fontSize: '.72rem', padding: '3px 9px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={5}
            placeholder={"English Language\nMathematics\nIntegrated Science"}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '.85rem', resize: 'vertical', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleBulkAdd} className="btn btn-primary" disabled={bulkAdding || !bulkText.trim()}>
              {bulkAdding ? 'Adding…' : `➕ Add ${bulkText.split('\n').filter(l => l.trim()).length} Subjects`}
            </button>
            <button onClick={() => setShowBulk(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        {/* Quick-add inline */}
        <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: 8, padding: '10px 0 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={nameRef}
            list="subj-quick-list"
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Subject name, e.g. Mathematics"
            style={{ flex: 1, minWidth: 200 }}
          />
          <datalist id="subj-quick-list">
            {COMMON_SUBJECTS.map(s => <option key={s} value={s} />)}
          </datalist>
          <button type="submit" className="btn btn-primary btn-sm" disabled={quickAdding || !quickName.trim()}>
            {quickAdding ? '…' : '+ Add Subject'}
          </button>
        </form>

        {subjects.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📚</div>
            <p>No subjects yet. Type a name above and click <strong>+ Add Subject</strong>, or use <strong>Bulk Add</strong>.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Subject</th><th>Code</th>
                  <th>Class</th><th>Exam</th><th>Total</th>
                  <th>Assigned Classes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => {
                  const assigned = classes.filter(c => s.classIds?.includes(c.id));
                  const total    = (s.maxClassScore || 0) + (s.maxExamScore || 0);
                  return (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-lt)', width: 32 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td className="td-mono" style={{ fontSize: '.78rem' }}>{s.code || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{s.maxClassScore}</td>
                      <td style={{ textAlign: 'center' }}>{s.maxExamScore}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{total}</td>
                      <td>
                        {assigned.length === 0
                          ? <span className="badge badge-neutral" style={{ fontSize: '.72rem' }}>Not assigned</span>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {assigned.map(c => (
                                <span key={c.id} className="badge badge-info" style={{ fontSize: '.7rem' }}>{c.name}</span>
                              ))}
                            </div>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveSubject(s)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          subject={editing} classes={classes}
          onClose={() => setEditing(null)}
          onSave={async (data) => { await saveSubject(data); setEditing(null); }}
        />
      )}
    </div>
  );
}
