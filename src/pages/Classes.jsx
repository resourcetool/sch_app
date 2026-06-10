// src/pages/Classes.jsx
import React, { useState, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord } from '../services/syncService';
import { idbGetAll } from '../services/indexedDB';

function ClassModal({ cls, onClose, onSave }) {
  const [form, setForm] = useState(cls || { name: '', level: '', capacity: '', description: '' });
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onSave(form); onClose(); } catch (err) { alert(err.message); } finally { setLoading(false); }
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{cls ? 'Edit Class' : 'Add Class'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full">
                <label>Class Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Form 1A" />
              </div>
              <div className="form-group">
                <label>Level / Year</label>
                <input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="e.g. Form 1, JHS 1" />
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Classes() {
  const { classes, school, schoolId, refresh } = useSchool();
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [enrollCounts, setEnrollCounts] = useState({});

  React.useEffect(() => {
    if (!schoolId) return;
    idbGetAll('enrollments', 'schoolId', schoolId).then(enrs => {
      const counts = {};
      enrs.filter(e => e.status === 'active').forEach(e => {
        counts[e.classId] = (counts[e.classId] || 0) + 1;
      });
      setEnrollCounts(counts);
    });
  }, [schoolId, classes]);

  async function handleSave(form) {
    const id = selected?.id || uuidv4();
    const record = { id, schoolId, ...form, updatedAt: Date.now() };
    if (!selected) record.createdAt = Date.now();
    await writeRecord('classes', id, record, schoolId);
    await refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Classes</h1>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>+ Add Class</button>
      </div>
      <div className="card">
        {classes.length === 0 ? (
          <div className="empty-state"><div className="icon">🏫</div><p>No classes. Add your first class.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Class Name</th><th>Level</th><th>Capacity</th><th>Enrolled</th><th>Actions</th></tr></thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td>{c.level}</td>
                    <td>{c.capacity || '—'}</td>
                    <td><span className="badge badge-info">{enrollCounts[c.id] || 0} students</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(c); setModal('edit'); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <ClassModal cls={selected} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}
