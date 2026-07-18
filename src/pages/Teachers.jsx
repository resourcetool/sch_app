// src/pages/Teachers.jsx
//
// FIXES:
// 1. Teacher last login time is now displayed in the table — fetched from Firestore
//    users collection (lastLoginAt field updated by AuthContext on every login).
//    School admin can see at a glance when each teacher last signed in.
// 2. Atomic teacher creation — if Firestore profile write fails, Firebase Auth
//    account is deleted automatically (handled in teacherAuthService).
//    Admins can safely retry with the same email after a failure.
// 3. Activity logging when admin creates or removes a teacher — visible in
//    super admin's Activity Log panel.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool }    from '../contexts/SchoolContext';
import { useAuth }      from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { writeRecord, deleteRecord } from '../services/syncService';
import { idbGetAll }    from '../services/indexedDB';
import { createTeacherAccount } from '../services/teacherAuthService';
import { logActivity }  from '../services/superAdminService';
import { db }           from '../services/firebase';
import {
  collection, query, where, getDocs, updateDoc,
} from 'firebase/firestore';

// ── LAST LOGIN DISPLAY ────────────────────────────────────────────
function LastLoginBadge({ lastLoginAt }) {
  if (!lastLoginAt) {
    return <span style={{ fontSize: '.72rem', color: '#aaa', fontStyle: 'italic' }}>Never logged in</span>;
  }
  const date = new Date(lastLoginAt);
  const now  = Date.now();
  const diff = now - lastLoginAt;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  let relative;
  if (mins < 2)   relative = 'Just now';
  else if (mins < 60) relative = `${mins}m ago`;
  else if (hrs < 24)  relative = `${hrs}h ago`;
  else if (days === 1) relative = 'Yesterday';
  else if (days < 7)   relative = `${days}d ago`;
  else relative = date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });

  const fullTime = date.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short', hour12: true });

  return (
    <span title={fullTime} style={{
      fontSize: '.72rem', color: days < 3 ? '#2e7d32' : days < 14 ? '#e65100' : '#666',
      fontWeight: days < 3 ? 700 : 400,
    }}>
      {relative}
    </span>
  );
}

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

  // Checks both directions a subject can be linked to a class: subject.classIds
  // (set from the Subjects page) OR class.subjectIds (set from the Classes page).
  const selectedClassSubjects = subjects.filter(s =>
    form.assignedClasses.some(cid =>
      s.classIds?.includes(cid) || classes.find(c => c.id === cid)?.subjectIds?.includes(s.id)
    )
  );

  function assignClassSubjects() {
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
                <input value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="0549271528" />
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

            {/* CLASS ASSIGNMENT */}
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

            {/* SUBJECT ASSIGNMENT */}
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
  const { userProfile }                 = useAuth();
  const [teachers,   setTeachers]   = useState([]);
  const [loginTimes, setLoginTimes] = useState({}); // uid → lastLoginAt
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
    const sorted = data.sort((a, b) => a.lastName?.localeCompare(b.lastName || '') || 0);
    setTeachers(sorted);

    // Fetch lastLoginAt for all teachers from Firestore users collection
    // This is separate from IDB teachers collection — users doc is updated on login
    if (sorted.length > 0) {
      try {
        const q    = query(collection(db, 'users'), where('schoolId', '==', schoolId), where('role', '==', 'teacher'));
        const snap = await getDocs(q);
        const times = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.email) times[data.email] = data.lastLoginAt || null;
          if (data.teacherId) times[data.teacherId] = data.lastLoginAt || null;
        });
        setLoginTimes(times);
      } catch (err) {
        console.warn('[Teachers] Could not fetch login times:', err.message);
      }
    }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  async function saveTeacher(form) {
    const id = editing?.id || uuidv4();

    if (!editing) {
      if (!form.email || !form.password) throw new Error('Email and password are required to create a teacher account.');
      try {
        await createTeacherAccount(form.email, form.password, {
          schoolId,
          firstName:        form.firstName,
          lastName:         form.lastName,
          teacherId:        id,
          assignedClasses:  form.assignedClasses  || [],
          assignedSubjects: form.assignedSubjects || [],
        });
        // Log teacher creation for super admin visibility
        logActivity(schoolId, userProfile?.id || '', userProfile?.email || '', 'teacher_created', {
          teacherName:  `${form.firstName} ${form.lastName}`,
          teacherEmail: form.email,
        });
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') throw new Error('This email is already registered. Ask the teacher to log in instead.');
        throw err;
      }
    } else {
      // Update user profile in Firestore too (assignments may have changed)
      try {
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

  // Removing a teacher is now a PERMANENT hard delete — the teacher record
  // and their linked login profile (users doc) are deleted from Firestore
  // entirely. This cannot be undone. (Previously this soft-deleted by
  // setting status to 'inactive'; that behavior has been replaced per
  // admin requirements.) Note: the underlying Firebase Auth credential
  // itself can't be deleted from client code (no Admin SDK here) — but
  // without a users profile the account can no longer sign in to the app.
  async function handleRemoveTeacher(teacher) {
    if (!window.confirm(
      `Permanently delete ${teacher.firstName} ${teacher.lastName}?\n\n` +
      `This PERMANENTLY removes the teacher and their login profile from ` +
      `the system. This cannot be undone.`
    )) return;
    setError('');
    try {
      await deleteRecord('teachers', teacher.id);

      const q    = query(collection(db, 'users'), where('teacherId', '==', teacher.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteRecord('users', snap.docs[0].id);
      }

      logActivity(schoolId, userProfile?.id || '', userProfile?.email || '', 'teacher_removed', {
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
      });

      await load();
    } catch (err) {
      setError('Failed to remove teacher: ' + err.message);
    }
  }

  function getNames(ids, items) {
    return items.filter(i => ids?.includes(i.id)).map(i => i.name);
  }

  // ── DUPLICATE NAME DETECTION ────────────────────────────────────
  const duplicateTeacherGroups = (() => {
    const groups = {};
    teachers.filter(t => t.status !== 'inactive').forEach(t => {
      const key = `${(t.firstName || '').trim().toLowerCase()} ${(t.lastName || '').trim().toLowerCase()}`;
      (groups[key] = groups[key] || []).push(t);
    });
    return Object.values(groups).filter(g => g.length > 1);
  })();

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

      {duplicateTeacherGroups.length > 0 && (
        <div className="card" style={{ marginBottom: 10, border: '1.5px solid #e65100', background: '#fff8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#e65100', marginBottom: 8 }}>
            ⚠ Possible Duplicate Teachers Found
          </div>
          {duplicateTeacherGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #ffe0b2' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 4 }}>
                {group[0].firstName} {group[0].lastName} — {group.length} entries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                    border: '1px solid var(--border)', borderRadius: 6, background: '#fff', fontSize: '.72rem',
                  }}>
                    <span>{t.email}</span>
                    <button className="btn btn-danger btn-sm" style={{ fontSize: '.68rem', padding: '1px 6px' }} onClick={() => handleRemoveTeacher(t)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>
            Removing permanently deletes the teacher and their login profile from the system.
          </div>
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

      {/* Teacher Table */}
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
                  <th>Classes</th><th>Subjects</th><th>Last Login</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => {
                  const clsNames  = getNames(t.assignedClasses,  classes);
                  const subjNames = getNames(t.assignedSubjects, subjects);
                  // Look up login time by teacherId or email
                  const lastLogin = loginTimes[t.id] || loginTimes[t.email] || null;
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
                        <LastLoginBadge lastLoginAt={lastLogin} />
                      </td>
                      <td>
                        <span className={`badge badge-${t.status === 'inactive' ? 'neutral' : 'success'}`}>
                          {t.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(t); setShowModal(true); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveTeacher(t)}>Remove</button>
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
