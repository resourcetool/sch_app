// src/pages/Classes.jsx
// Redesigned for speed:
// - Inline quick-add row at the top of the table (no modal needed for simple adds)
// - Bulk add: paste a list of class names and create them all at once
// - Edit in a side-panel modal with subject assignment
// - Enrollment counts shown live
// - All writes go through writeRecord (IDB → Firestore sync)

import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord, deleteRecord } from '../services/syncService';
import { idbGetAll } from '../services/indexedDB';

const LEVELS = ['Nursery', 'KG 1', 'KG 2', 'Class 1', 'Class 2', 'Class 3',
  'Class 4', 'Class 5', 'Class 6', 'JHS 1', 'JHS 2', 'JHS 3',
  'SHS 1', 'SHS 2', 'SHS 3', 'Form 1', 'Form 2', 'Form 3'];

function EditModal({ cls, subjects, onClose, onSave }) {
  const [form, setForm] = useState({
    name: cls.name, level: cls.level || '', capacity: cls.capacity || '',
    description: cls.description || '',
    subjectIds: cls.subjectIds || [],
  });
  const [saving, setSaving] = useState(false);

  function toggleSubject(id) {
    setForm(f => ({
      ...f,
      subjectIds: f.subjectIds.includes(id)
        ? f.subjectIds.filter(x => x !== id)
        : [...f.subjectIds, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ ...cls, ...form }); onClose(); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Class — {cls.name}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group full">
                <label>Class Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Level</label>
                <input list="levels-list" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="e.g. JHS 1" />
                <datalist id="levels-list">{LEVELS.map(l => <option key={l} value={l} />)}</datalist>
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Subjects taught in this class</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6 }}>
                  {subjects.length === 0
                    ? <span style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No subjects yet — add subjects first.</span>
                    : subjects.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '.82rem', background: form.subjectIds.includes(s.id) ? '#e3f2fd' : 'var(--surface2)', borderRadius: 6, padding: '4px 10px', border: `1px solid ${form.subjectIds.includes(s.id) ? '#90caf9' : 'var(--border)'}` }}>
                        <input type="checkbox" checked={form.subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} style={{ margin: 0 }} />
                        {s.name}
                      </label>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Classes() {
  const { classes, subjects, schoolId, refresh } = useSchool();
  const [enrollCounts, setEnrollCounts] = useState({});
  const [editing,      setEditing]      = useState(null);
  const [showBulk,     setShowBulk]     = useState(false);
  const [bulkText,     setBulkText]     = useState('');
  const [bulkAdding,   setBulkAdding]   = useState(false);

  // Inline quick-add
  const [quickName,  setQuickName]  = useState('');
  const [quickLevel, setQuickLevel] = useState('');
  const [quickAdding,setQuickAdding]= useState(false);
  const nameRef = useRef();

  useEffect(() => {
    if (!schoolId) return;
    idbGetAll('enrollments', 'schoolId', schoolId).then(enrs => {
      const counts = {};
      enrs.filter(e => e.status === 'active').forEach(e => {
        counts[e.classId] = (counts[e.classId] || 0) + 1;
      });
      setEnrollCounts(counts);
    });
  }, [schoolId, classes]);

  async function saveClass(data) {
    const id     = data.id || uuidv4();
    const record = { id, schoolId, ...data, updatedAt: Date.now() };
    if (!data.id) record.createdAt = Date.now();
    await writeRecord('classes', id, record, schoolId);
    await refresh();
  }

  // Removing a class is a HARD delete (Firestore rules allow it for admins).
  // Safety check: warn if students are currently enrolled, since deleting
  // the class would leave their enrollment pointing at a class that no
  // longer exists. Admin must confirm explicitly to proceed anyway.
  async function handleRemoveClass(cls) {
    const enrolledCount = enrollCounts[cls.id] || 0;
    const warning = enrolledCount > 0
      ? `${cls.name} has ${enrolledCount} student(s) currently enrolled.\n\n` +
        `Deleting this class will NOT delete those students, but they will lose ` +
        `their class assignment. Their score history is preserved.\n\n` +
        `Are you sure you want to delete "${cls.name}"?`
      : `Delete class "${cls.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    try {
      await deleteRecord('classes', cls.id);
      await refresh();
    } catch (err) {
      alert('Failed to delete class: ' + err.message);
    }
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickAdding(true);
    try {
      await saveClass({ name: quickName.trim(), level: quickLevel.trim(), capacity: '', description: '', subjectIds: [] });
      setQuickName('');
      setQuickLevel('');
      nameRef.current?.focus();
    } catch (err) { alert(err.message); }
    finally { setQuickAdding(false); }
  }

  async function handleBulkAdd() {
    const names = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (names.length === 0) return;
    setBulkAdding(true);
    try {
      for (const name of names) {
        await saveClass({ name, level: '', capacity: '', description: '', subjectIds: [] });
      }
      setBulkText('');
      setShowBulk(false);
    } catch (err) { alert(err.message); }
    finally { setBulkAdding(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Classes <span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-lt)' }}>({classes.length})</span></h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowBulk(b => !b)}>
          {showBulk ? '✕ Cancel Bulk' : '📋 Bulk Add'}
        </button>
      </div>

      {/* Bulk add panel */}
      {showBulk && (
        <div className="card" style={{ marginBottom: 12, background: '#fffde7', border: '1px solid #f9a825' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--navy)' }}>Bulk Add Classes</div>
          <p style={{ fontSize: '.82rem', color: 'var(--text-mid)', marginBottom: 8 }}>One class name per line. Levels can be edited after.</p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder={"JHS 1A\nJHS 1B\nJHS 2A\nJHS 2B\nJHS 3"}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '.85rem', resize: 'vertical', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleBulkAdd} className="btn btn-primary" disabled={bulkAdding || !bulkText.trim()}>
              {bulkAdding ? 'Adding…' : `➕ Add ${bulkText.split('\n').filter(l => l.trim()).length} Classes`}
            </button>
            <button onClick={() => setShowBulk(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        {/* Quick-add inline row */}
        <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: 8, padding: '10px 0 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={nameRef}
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Class name, e.g. JHS 1A"
            style={{ flex: 2, minWidth: 160 }}
          />
          <input
            list="levels-list2"
            value={quickLevel}
            onChange={e => setQuickLevel(e.target.value)}
            placeholder="Level (optional)"
            style={{ flex: 1, minWidth: 120 }}
          />
          <datalist id="levels-list2">{LEVELS.map(l => <option key={l} value={l} />)}</datalist>
          <button type="submit" className="btn btn-primary btn-sm" disabled={quickAdding || !quickName.trim()}>
            {quickAdding ? '…' : '+ Add Class'}
          </button>
        </form>

        {classes.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏫</div>
            <p>No classes yet. Type a name above and press <strong>+ Add Class</strong>, or use <strong>Bulk Add</strong> to add many at once.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Class Name</th><th>Level</th>
                  <th>Subjects</th><th>Enrolled</th><th>Capacity</th><th></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c, i) => {
                  const classSubjects = subjects.filter(s => s.classIds?.includes(c.id) || c.subjectIds?.includes(s.id));
                  return (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-lt)', width: 32 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td style={{ color: 'var(--text-mid)', fontSize: '.84rem' }}>{c.level || '—'}</td>
                      <td>
                        {classSubjects.length === 0
                          ? <span className="badge badge-neutral" style={{ fontSize: '.72rem' }}>None assigned</span>
                          : <span style={{ fontSize: '.75rem', color: 'var(--text-mid)' }}>{classSubjects.map(s => s.name).join(', ')}</span>
                        }
                      </td>
                      <td>
                        <span className="badge badge-info">{enrollCounts[c.id] || 0}</span>
                      </td>
                      <td style={{ color: 'var(--text-lt)', fontSize: '.84rem' }}>{c.capacity || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveClass(c)}>Remove</button>
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
          cls={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={async (data) => { await saveClass(data); setEditing(null); }}
        />
      )}
    </div>
  );
}
