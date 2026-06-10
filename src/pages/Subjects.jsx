// src/pages/Subjects.jsx
import React, { useState } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord } from '../services/syncService';

function SubjectModal({ subject, classes, onClose, onSave }) {
  const [form, setForm] = useState(subject || {
    name: '', code: '', classIds: [], maxClassScore: 30, maxExamScore: 70, description: ''
  });
  const [loading, setLoading] = useState(false);

  function toggleClass(id) {
    setForm(f => ({
      ...f,
      classIds: f.classIds.includes(id) ? f.classIds.filter(c => c !== id) : [...f.classIds, id]
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onSave(form); onClose(); } catch (err) { alert(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{subject ? 'Edit Subject' : 'Add Subject'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>Subject Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mathematics" />
              </div>
              <div className="form-group">
                <label>Subject Code</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MATH" />
              </div>
              <div className="form-group">
                <label>Max Class Score</label>
                <input type="number" min="0" max="100" value={form.maxClassScore} onChange={e => setForm(f => ({ ...f, maxClassScore: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Max Exam Score</label>
                <input type="number" min="0" max="100" value={form.maxExamScore} onChange={e => setForm(f => ({ ...f, maxExamScore: +e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Assigned Classes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
                  {classes.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                      <input type="checkbox" checked={form.classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>Save Subject</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Subjects() {
  const { subjects, classes, schoolId, refresh } = useSchool();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  async function handleSave(form) {
    const id = selected?.id || uuidv4();
    const record = { id, schoolId, ...form, updatedAt: Date.now() };
    if (!selected) record.createdAt = Date.now();
    await writeRecord('subjects', id, record, schoolId);
    await refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Subjects</h1>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('form'); }}>+ Add Subject</button>
      </div>
      <div className="card">
        {subjects.length === 0 ? (
          <div className="empty-state"><div className="icon">📚</div><p>No subjects yet. Add subjects and assign them to classes.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Subject Name</th><th>Code</th><th>Class Score</th><th>Exam Score</th><th>Total</th><th>Assigned Classes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {subjects.map(s => {
                  const assignedClasses = classes.filter(c => s.classIds?.includes(c.id));
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td className="td-mono">{s.code}</td>
                      <td>{s.maxClassScore}</td>
                      <td>{s.maxExamScore}</td>
                      <td style={{ fontWeight: 700 }}>{(s.maxClassScore || 0) + (s.maxExamScore || 0)}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {assignedClasses.length === 0
                            ? <span className="badge badge-neutral">None</span>
                            : assignedClasses.map(c => <span key={c.id} className="badge badge-info">{c.name}</span>)}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('form'); }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <SubjectModal subject={selected} classes={classes} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}
