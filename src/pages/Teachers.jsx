// src/pages/Teachers.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord } from '../services/syncService';
import { idbGetAll } from '../services/indexedDB';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

function TeacherModal({ teacher, classes, subjects, schoolId, onClose, onSave }) {
  const [form, setForm] = useState(teacher || {
    firstName: '', lastName: '', email: '', phone: '', staffId: '',
    assignedClasses: [], assignedSubjects: [], password: ''
  });
  const [loading, setLoading] = useState(false);

  function toggle(field, id) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id]
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{teacher ? 'Edit Teacher' : 'Add Teacher'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Staff ID</label>
                <input value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} />
              </div>
              {!teacher && (
                <div className="form-group">
                  <label>Password (for login)</label>
                  <input type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
              <div className="form-group full">
                <label>Assigned Classes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 0' }}>
                  {classes.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                      <input type="checkbox" checked={form.assignedClasses.includes(c.id)} onChange={() => toggle('assignedClasses', c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group full">
                <label>Assigned Subjects</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 0' }}>
                  {subjects.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                      <input type="checkbox" checked={form.assignedSubjects.includes(s.id)} onChange={() => toggle('assignedSubjects', s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Teachers() {
  const { classes, subjects, schoolId, refresh } = useSchool();
  const [teachers, setTeachers] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const data = await idbGetAll('teachers', 'schoolId', schoolId);
    setTeachers(data.sort((a, b) => a.firstName.localeCompare(b.firstName)));
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    const id = selected?.id || uuidv4();

    // Create Firebase Auth account for new teacher
    if (!selected && form.password && form.email) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const userProfile = {
          id: cred.user.uid,
          schoolId,
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: 'teacher',
          teacherId: id,
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'users', cred.user.uid), userProfile);
      } catch (err) {
        console.warn('Could not create auth account:', err.message);
      }
    }

    const { password, ...rest } = form;
    const record = {
      id, schoolId, ...rest,
      assignedClasses: form.assignedClasses || [],
      assignedSubjects: form.assignedSubjects || [],
      updatedAt: Date.now()
    };
    if (!selected) record.createdAt = Date.now();
    await writeRecord('teachers', id, record, schoolId);
    await load();
  }

  function getAssignedNames(ids, items) {
    return items.filter(i => ids?.includes(i.id)).map(i => i.name).join(', ') || '—';
  }

  return (
    <div>
      <div className="page-header">
        <h1>Teachers</h1>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModal(true); }}>+ Add Teacher</button>
      </div>
      <div className="card">
        {teachers.length === 0 ? (
          <div className="empty-state"><div className="icon">👨‍🏫</div><p>No teachers yet. Add your first teacher.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Staff ID</th><th>Name</th><th>Email</th><th>Classes</th><th>Subjects</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td className="td-mono">{t.staffId || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</td>
                    <td>{t.email}</td>
                    <td style={{ maxWidth: 180, fontSize: '.78rem' }}>{getAssignedNames(t.assignedClasses, classes)}</td>
                    <td style={{ maxWidth: 180, fontSize: '.78rem' }}>{getAssignedNames(t.assignedSubjects, subjects)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(t); setModal(true); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && (
        <TeacherModal
          teacher={selected} classes={classes} subjects={subjects} schoolId={schoolId}
          onClose={() => setModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
