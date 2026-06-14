// src/pages/Students.jsx
// Redesigned for speed:
// - Inline quick-add row: type name + select class → student created AND enrolled in one step
// - Bulk import from Excel preserved
// - Enrollment happens immediately on creation (no separate Enroll step needed)
// - Separate "Enroll" button still available for existing unenrolled students
// - Edit modal opens as a side panel with all fields
// - Search filters by name, ID, class
// - Status badges and class shown inline

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSchool }  from '../contexts/SchoolContext';
import { useAuth }    from '../contexts/AuthContext';
import {
  getStudents, createStudent, updateStudent,
  enrollStudent, getEnrollments, importStudentsFromArray,
} from '../services/studentService';
import { importStudentsFromExcel } from '../services/backupService';

// ── EDIT MODAL ────────────────────────────────────────────────────
function StudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState(student || {
    firstName: '', lastName: '', dateOfBirth: '', gender: 'Male',
    guardianName: '', guardianPhone: '', address: '', status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{student ? `Edit — ${student.firstName} ${student.lastName}` : 'Add Student'}</span>
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
                <label>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => up('dateOfBirth', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={e => up('gender', e.target.value)}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Guardian Name</label>
                <input value={form.guardianName} onChange={e => up('guardianName', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Guardian Phone</label>
                <input value={form.guardianPhone} onChange={e => up('guardianPhone', e.target.value)} />
              </div>
              <div className="form-group full">
                <label>Address</label>
                <input value={form.address} onChange={e => up('address', e.target.value)} />
              </div>
              {student && (
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => up('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduated">Graduated</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : student ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ENROLL MODAL ──────────────────────────────────────────────────
function EnrollModal({ student, school, classes, onClose, onSave }) {
  const [form, setForm] = useState({
    classId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.classId) { setError('Select a class'); return; }
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Enroll — {student.firstName} {student.lastName}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Class *</label>
                <select required value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Academic Year *</label>
                <input required value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Term *</label>
                <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))}>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving}>
              {saving ? 'Enrolling…' : 'Enroll Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────
export default function Students() {
  const { school, classes, schoolId } = useSchool();
  const { userProfile }               = useAuth();

  const isAdmin = userProfile?.role === 'admin';

  const [students,    setStudents]    = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [modal,       setModal]       = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [error,       setError]       = useState('');

  // Quick-add state
  const [qFirst,    setQFirst]    = useState('');
  const [qLast,     setQLast]     = useState('');
  const [qGender,   setQGender]   = useState('Male');
  const [qClass,    setQClass]    = useState('');
  const [qAdding,   setQAdding]   = useState(false);
  const firstRef = useRef();

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [s, e] = await Promise.all([
      getStudents(schoolId),
      getEnrollments(schoolId, { academicYear: school?.academicYear, term: school?.currentTerm }),
    ]);
    setStudents(s.sort((a, b) => a.lastName.localeCompare(b.lastName)));
    setEnrollments(e);
    setLoading(false);
  }, [schoolId, school?.academicYear, school?.currentTerm]);

  useEffect(() => { load(); }, [load]);

  // Maps for fast lookup
  const enrollMap = {};
  enrollments.forEach(e => { enrollMap[e.studentId] = e; });
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

  // Filtered list
  const filtered = students.filter(s => {
    const matchSearch = !search ||
      `${s.firstName} ${s.lastName} ${s.studentCode}`.toLowerCase().includes(search.toLowerCase());
    const matchClass = !filterClass || enrollMap[s.id]?.classId === filterClass;
    return matchSearch && matchClass;
  });

  // ── QUICK ADD ─────────────────────────────────────────────────
  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!qFirst.trim() || !qLast.trim()) return;
    setQAdding(true); setError('');
    try {
      const student = await createStudent(
        schoolId,
        { firstName: qFirst.trim(), lastName: qLast.trim(), gender: qGender, status: 'active' },
        school?.code || 'STU',
        students.length,
      );
      // Auto-enroll if class selected
      if (qClass) {
        await enrollStudent(schoolId, student.id, qClass, school?.academicYear || '', school?.currentTerm || '1');
      }
      setQFirst(''); setQLast(''); setQGender('Male'); // keep class selection for next student
      firstRef.current?.focus();
      await load();
    } catch (err) { setError(err.message); }
    finally { setQAdding(false); }
  }

  // ── SAVE / ENROLL ─────────────────────────────────────────────
  async function handleSave(form) {
    if (selected) {
      await updateStudent(schoolId, selected.id, form);
    } else {
      await createStudent(schoolId, form, school?.code || 'STU', students.length);
    }
    await load();
  }

  async function handleEnroll(form) {
    await enrollStudent(schoolId, selected.id, form.classId, form.academicYear, form.term);
    await load();
  }

  // ── IMPORT ────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows   = await importStudentsFromExcel(file, schoolId);
      const result = await importStudentsFromArray(schoolId, rows, school?.code || 'STU', students.length);
      alert(`✓ Imported ${result.success.length} students.${result.errors.length ? `\n${result.errors.length} errors — check console.` : ''}`);
      await load();
    } catch (err) { alert('Import failed: ' + err.message); }
    finally { setImporting(false); e.target.value = ''; }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Students <span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-lt)' }}>({students.length})</span></h1>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              {importing ? '⏳ Importing…' : '⬆ Import Excel'}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal('add'); }}>
              + Full Add
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 10 }}>
          {error} <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── QUICK ADD ROW ── */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', marginBottom: 8 }}>
            ⚡ Quick Add Student
          </div>
          <form onSubmit={handleQuickAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>First Name *</div>
              <input
                ref={firstRef}
                required
                value={qFirst}
                onChange={e => setQFirst(e.target.value)}
                placeholder="e.g. Kwame"
                onKeyDown={e => e.key === 'Tab' && !qLast && e.preventDefault() && document.getElementById('qlast')?.focus()}
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Last Name *</div>
              <input
                id="qlast"
                required
                value={qLast}
                onChange={e => setQLast(e.target.value)}
                placeholder="e.g. Mensah"
              />
            </div>
            <div style={{ flex: '0 0 90px' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Gender</div>
              <select value={qGender} onChange={e => setQGender(e.target.value)}>
                <option>Male</option><option>Female</option>
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginBottom: 3 }}>Enroll in Class (optional)</div>
              <select value={qClass} onChange={e => setQClass(e.target.value)}>
                <option value="">— No class yet —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-success btn-sm"
              disabled={qAdding || !qFirst.trim() || !qLast.trim()}
              style={{ alignSelf: 'flex-end', height: 36 }}
            >
              {qAdding ? '…' : '+ Add'}
            </button>
          </form>
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 6 }}>
            Press Enter to add and continue. Student is auto-enrolled if a class is selected.
            Use <strong>+ Full Add</strong> for DOB, guardian, address.
          </div>
        </div>
      )}

      <div className="card">
        {/* Filters */}
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="🔍 Search name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ alignSelf: 'center', fontSize: '.8rem', color: 'var(--text-lt)', whiteSpace: 'nowrap' }}>
            {filtered.length} / {students.length}
          </span>
        </div>

        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>{search || filterClass ? 'No students match your filter.' : 'No students yet. Use Quick Add above.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Class</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const enr = enrollMap[s.id];
                  const cls = enr ? classMap[enr.classId] : null;
                  return (
                    <tr key={s.id}>
                      <td className="td-mono" style={{ fontSize: '.78rem' }}>{s.studentCode}</td>
                      <td style={{ fontWeight: 600 }}>{s.lastName}, {s.firstName}</td>
                      <td style={{ fontSize: '.82rem', color: 'var(--text-mid)' }}>{s.gender}</td>
                      <td>
                        {cls
                          ? <span className="badge badge-info">{cls.name}</span>
                          : <span className="badge badge-neutral" style={{ fontSize: '.7rem' }}>Not enrolled</span>
                        }
                      </td>
                      <td>
                        <span className={`badge badge-${s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'neutral'}`}>
                          {s.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('edit'); }}>Edit</button>
                            {!cls && (
                              <button className="btn btn-primary btn-sm" onClick={() => { setSelected(s); setModal('enroll'); }}>Enroll</button>
                            )}
                            {cls && (
                              <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('enroll'); }}>Re-enroll</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <StudentModal
          student={modal === 'edit' ? selected : null}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={async (form) => { await handleSave(form); await load(); }}
        />
      )}
      {modal === 'enroll' && selected && (
        <EnrollModal
          student={selected} school={school} classes={classes}
          onClose={() => { setModal(null); setSelected(null); }}
          onSave={handleEnroll}
        />
      )}
    </div>
  );
}
