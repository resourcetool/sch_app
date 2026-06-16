// src/pages/Teachers.jsx
// Redesigned for speed:
// - Inline quick-add row: name + email + password → teacher created immediately
// - Full edit modal: assign classes and subjects with pill toggles
// - Class/subject assignment shown inline as badges
// - Creating a teacher also creates their Firebase Auth account
// - All data written via writeRecord (IDB → Firestore)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool }    from '../contexts/SchoolContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord }  from '../services/syncService';
import { idbGetAll }    from '../services/indexedDB';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db }     from '../services/firebase';

// ── EDIT MODAL ────────────────────────────────────────────────────
function TeacherModal({ teacher, classes, subjects, schoolId, onClose, onSave }) {
  const [form, setForm] = useState(teacher || {
    firstName: '', lastName: '', email: '', phone: '', staffId: '',
    assignedClasses: [], assignedSubjects: [], password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function togglePill(field, id) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id)
        ? f[field].filter(x => x !== id)
        : [...f[field], id],
    }));
  }

  // When a class is toggled, also show its subjects for easy assignment
  const selectedClassSubjects = subjects.filter(s =>
    form.assignedClasses.some(cid => s.classIds?.includes(cid))
  );

  function assignClassSubjects() {
    // One-click: assign all subjects belonging to assigned classes
    const ids = selectedClassSubjects.map(s => s.id);
    setForm(f => ({ ...f, assignedSubjects: [...new Set([...f.assignedSubjects, ...ids])] }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{teacher ? `Edit — ${teacher.firstName} ${teacher.lastName}` : 'Add Teacher'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>First Name *</label>
                <input required value={form.firstName} onChange={e => up('firstName', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input required value={form.lastName} onChange={e => up('lastName', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email {!teacher && '*'}</label>
                <input type="email" required={!teacher} value={form.email} onChange={e => up('email', e.target.value)} disabled={!!teacher} />
                {teacher && <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Email cannot be changed after creation</span>}
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="024XXXXXXX" />
              </div>
              <div className="form-group">
                <label>Staff ID</label>
                <input value={form.staffId} onChange={e => up('staffId', e.target.value)} />
              </div>
              {!teacher && (
                <div className="form-group">
                  <label>Login Password *</label>
                  <input type="password" required minLength={6} value={form.password} onChange={e => up('password', e.target.value)} placeholder="Min 6 characters" />
                  <span style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>Teacher uses this to log in</span>
                </div>
              )}
            </div>

            {/* ── CLASS ASSIGNMENT ── */}
            <div style={{ margin: '14px 0 6px', fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem' }}>
              Assigned Classes
            </div>
            {classes.length === 0
              ? <p style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No classes yet — add classes first.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {classes.map(c => {
                    const on = form.assignedClasses.includes(c.id);
                    return (
                      <button
                        key={c.id} type="button" onClick={() => togglePill('assignedClasses', c.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.8rem',
                          border: `1.5px solid ${on ? 'var(--navy)' : 'var(--border)'}`,
                          background: on ? 'var(--navy)' : '#fff',
                          color: on ? '#fff' : 'var(--text-mid)',
                          cursor: 'pointer', fontWeight: on ? 700 : 400, transition: 'all .15s',
                        }}
                      >
                        {on ? '✓ ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
              )
            }

            {/* ── SUBJECT ASSIGNMENT ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 6px' }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem' }}>Assigned Subjects</div>
              {selectedClassSubjects.length > 0 && (
                <button type="button" onClick={assignClassSubjects} className="btn btn-ghost btn-sm" style={{ fontSize: '.72rem' }}>
                  ✓ Auto-assign from selected classes
                </button>
              )}
            </div>
            {subjects.length === 0
              ? <p style={{ fontSize: '.8rem', color: 'var(--text-lt)' }}>No subjects yet — add subjects first.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {subjects.map(s => {
                    const on          = form.assignedSubjects.includes(s.id);
                    const fromClasses = selectedClassSubjects.find(sc => sc.id === s.id);
                    return (
                      <button
                        key={s.id} type="button" onClick={() => togglePill('assignedSubjects', s.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.8rem',
                          border: `1.5px solid ${on ? '#2980b9' : fromClasses ? '#90caf9' : 'var(--border)'}`,
                          background: on ? '#2980b9' : fromClasses ? '#e3f2fd' : '#fff',
                          color: on ? '#fff' : 'var(--text-mid)',
                          cursor: 'pointer', fontWeight: on ? 700 : 400, transition: 'all .15s',
                        }}
                        title={fromClasses ? 'This subject is taught in your selected classes' : ''}
                      >
                        {on ? '✓ ' : ''}{s.name}
                      </button>
                    );
                  })}
                </div>
              )
            }
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : teacher ? 'Save Changes' : 'Create Teacher Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Teachers() {
  const { classes, subjects, schoolId } = useSchool();
  const [teachers,   setTeachers]   = useState([]);
  const [editing,    setEditing]    = useState(null);
  const [showModal,  setShowModal]  = useState(false);
  const [error,      setError]      = useState('');

  // Quick-add
  const [qFirst,    setQFirst]    = useState('');
  const [qLast,     setQLast]     = useState('');
  const [qEmail,    setQEmail]    = useState('');
  const [qPassword, setQPassword] = useState('');
  const [qAdding,   setQAdding]   = useState(false);
  const firstRef = useRef();

  const load = useCallback(async () => {
    if (!schoolId) return;
    const data = await idbGetAll('teachers', 'schoolId', schoolId);
    setTeachers(data.sort((a, b) => a.lastName?.localeCompare(b.lastName || '') || 0));
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function saveTeacher(form) {
    const id = editing?.id || uuidv4();

    // Create Firebase Auth account for new teachers
    if (!editing) {
      if (!form.email || !form.password) throw new Error('Email and password are required to create a teacher account.');
      try {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          id:         cred.user.uid,
          schoolId,
          email:      form.email,
          firstName:  form.firstName,
          lastName:   form.lastName,
          role:       'teacher',
          teacherId:  id,
          assignedClasses:  form.assignedClasses  || [],
          assignedSubjects: form.assignedSubjects || [],
          createdAt:  Date.now(),
        });
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') throw new Error('This email is already registered. Ask the teacher to log in instead.');
        throw err;
      }
    } else {
      // Update user profile in Firestore too (assignments may have changed)
      try {
        const { getDocs, query, collection, where, updateDoc } = await import('firebase/firestore');
        const q    = query(collection(db, 'users'), where('teacherId', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            firstName:        form.firstName,
            lastName:         form.lastName,
            phone:            form.phone || '',
            assignedClasses:  form.assignedClasses  || [],
            assignedSubjects: form.assignedSubjects || [],
            updatedAt:        Date.now(),
          });
        }
      } catch (err) {
        console.warn('Could not update Firestore user profile:', err.message);
      }
    }

    const { password, ...rest } = form;
    await writeRecord('teachers', id, {
      id, schoolId, ...rest,
      assignedClasses:  form.assignedClasses  || [],
      assignedSubjects: form.assignedSubjects || [],
      updatedAt:        Date.now(),
      ...(editing ? {} : { createdAt: Date.now() }),
    }, schoolId);

    await load();
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!qFirst.trim() || !qLast.trim() || !qEmail.trim() || !qPassword.trim()) return;
    setQAdding(true); setError('');
    try {
      await saveTeacher({
        firstName: qFirst.trim(), lastName: qLast.trim(),
        email: qEmail.trim(), password: qPassword,
        phone: '', staffId: '', assignedClasses: [], assignedSubjects: [],
      });
      setQFirst(''); setQLast(''); setQEmail(''); setQPassword('');
      firstRef.current?.focus();
    } catch (err) { setError(err.message); }
    finally { setQAdding(false); }
  }

  async function handleRemoveTeacher(teacher) {
    if (!window.confirm(
      `Remove ${teacher.firstName} ${teacher.lastName}?\n\nThis deactivates their account. They will no longer be able to log in. Their score records are preserved.`
    )) return;
    setError('');
    try {
      // Mark teacher record as inactive in IDB/Firestore
      await writeRecord('teachers', teacher.id, {
        ...teacher, status: 'inactive', deactivatedAt: Date.now(),
      }, schoolId);

      // Update their user document so they can't log in as this school's teacher
      const { getDocs, query, collection, where, updateDoc } = await import('firebase/firestore');
      const q    = query(collection(db, 'users'), where('teacherId', '==', teacher.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { status: 'inactive', role: 'inactive_teacher' });
      }
      await load();
    } catch (err) {
      setError('Failed to remove teacher: ' + err.message);
    }
  }

  function getNames(ids, items) {
    return items.filter(i => ids?.includes(i.id)).map(i => i.name);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Teachers <span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-lt)' }}>({teachers.length})</span></h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true); }}>
          + Full Add
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 10 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Quick-add */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', marginBottom: 8 }}>⚡ Quick Add Teacher</div>
        <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 110px' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>First Name *</div>
            <input ref={firstRef} required value={qFirst} onChange={e => setQFirst(e.target.value)} placeholder="Kwame" />
          </div>
          <div style={{ flex: '1 1 110px' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Last Name *</div>
            <input required value={qLast} onChange={e => setQLast(e.target.value)} placeholder="Mensah" />
          </div>
          <div style={{ flex: '2 1 180px' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Email (login) *</div>
            <input type="email" required value={qEmail} onChange={e => setQEmail(e.target.value)} placeholder="teacher@school.com" />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Password *</div>
            <input type="password" required minLength={6} value={qPassword} onChange={e => setQPassword(e.target.value)} placeholder="Min 6 chars" />
          </div>
          <button type="submit" className="btn btn-success btn-sm" disabled={qAdding || !qFirst || !qLast || !qEmail || !qPassword} style={{ alignSelf: 'flex-end', height: 36 }}>
            {qAdding ? '…' : '+ Add'}
          </button>
        </form>
        <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 5 }}>
          After adding, click <strong>Edit</strong> to assign their classes and subjects.
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {teachers.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👨‍🏫</div>
            <p>No teachers yet. Use Quick Add above or <strong>+ Full Add</strong> for more options.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Email</th><th>Phone</th>
                  <th>Classes</th><th>Subjects</th><th></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => {
                  const clsNames  = getNames(t.assignedClasses,  classes);
                  const subjNames = getNames(t.assignedSubjects, subjects);
                  return (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-lt)', width: 30 }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{t.lastName}, {t.firstName}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{t.email}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{t.phone || '—'}</td>
                      <td>
                        {clsNames.length === 0
                          ? <span className="badge badge-neutral" style={{ fontSize: '.7rem' }}>None</span>
                          : <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {clsNames.map(n => <span key={n} className="badge badge-info" style={{ fontSize: '.7rem' }}>{n}</span>)}
                            </div>
                        }
                      </td>
                      <td>
                        {subjNames.length === 0
                          ? <span className="badge badge-neutral" style={{ fontSize: '.7rem' }}>None</span>
                          : <span style={{ fontSize: '.75rem', color: 'var(--text-mid)' }}>{subjNames.join(', ')}</span>
                        }
                      </td>
                      <td>
                        <span className={`badge badge-${t.status === 'inactive' ? 'neutral' : 'success'}`}>
                          {t.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(t); setShowModal(true); }}>Edit</button>
                        {t.status !== 'inactive' ? (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveTeacher(t)}>Remove</button>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '.72rem' }}>Inactive</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <TeacherModal
          teacher={editing}
          classes={classes}
          subjects={subjects}
          schoolId={schoolId}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={async (form) => {
            setError('');
            try { await saveTeacher(form); setShowModal(false); setEditing(null); }
            catch (err) { setError(err.message); throw err; }
          }}
        />
      )}
    </div>
  );
}
