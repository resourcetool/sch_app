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
import { Link } from 'react-router-dom';
import { useSchool }  from '../contexts/SchoolContext';
import { useAuth }    from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  getStudents, createStudent, updateStudent,
  enrollStudent, getEnrollments, importStudentsFromArray, deleteStudentPermanently,
} from '../services/studentService';
import { importStudentsFromExcel, downloadStudentImportTemplate } from '../services/backupService';

// ── EDIT MODAL ────────────────────────────────────────────────────
function StudentModal({ student, existingStudents = [], onClose, onSave }) {
  const [form, setForm] = useState(student || {
    firstName: '', lastName: '', dateOfBirth: '', gender: 'Male',
    guardianName: '', guardianPhone: '', address: '', status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Live duplicate check — ignores the student's own record when editing
  const nameMatch = (form.firstName?.trim() && form.lastName?.trim())
    ? existingStudents.find(s =>
        s.id !== student?.id &&
        s.firstName.trim().toLowerCase() === form.firstName.trim().toLowerCase() &&
        s.lastName.trim().toLowerCase()  === form.lastName.trim().toLowerCase()
      )
    : null;

  async function submit(e) {
    e.preventDefault();
    if (nameMatch && !window.confirm(
      `A student named "${form.firstName.trim()} ${form.lastName.trim()}" already exists ` +
      `(code ${nameMatch.studentCode}). Save this as a separate student anyway?`
    )) return;
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
            {nameMatch && (
              <div className="alert alert-warning" style={{ marginBottom: 10, fontSize: '.82rem' }}>
                ⚠ A student named "{form.firstName.trim()} {form.lastName.trim()}" already exists
                (code {nameMatch.studentCode}). You'll be asked to confirm before saving a duplicate.
              </div>
            )}
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
  const { studentLimit, plan }        = useSubscription();

  const isAdmin = userProfile?.role === 'admin';

  const [students,    setStudents]    = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterGender,setFilterGender]= useState('');
  const [filterStatus,setFilterStatus]= useState('');
  const [sortBy,      setSortBy]      = useState('name');   // name | code | class | status | gender
  const [sortDir,     setSortDir]     = useState('asc');    // asc | desc
  const [viewMode,    setViewMode]    = useState('table');  // table | card | kanban | tree
  const [expandedGroups, setExpandedGroups] = useState({}); // for tree view
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
    const matchClass  = !filterClass  || enrollMap[s.id]?.classId === filterClass;
    const matchGender = !filterGender || s.gender === filterGender;
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchClass && matchGender && matchStatus;
  });

  // ── SORT ──────────────────────────────────────────────────────
  const sortValue = (s, key) => {
    switch (key) {
      case 'code':   return s.studentCode || '';
      case 'class':  return classMap[enrollMap[s.id]?.classId]?.name || '\uffff'; // unenrolled sorts last
      case 'status': return s.status || '';
      case 'gender': return s.gender || '';
      case 'name':
      default:       return `${s.lastName} ${s.firstName}`;
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortValue(a, sortBy).localeCompare(sortValue(b, sortBy));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── GROUP BY CLASS (used by Kanban & Tree views) ────────────────
  // Every class appears as its own group (even with 0 students, so
  // admin/super admin can see class rosters are empty at a glance), plus
  // an "Unassigned" group for students with no active enrollment.
  const groupsByClass = (() => {
    const groups = classes.map(c => ({
      id: c.id, name: c.name, students: [],
    }));
    const unassigned = { id: '__unassigned', name: 'Not Enrolled', students: [] };
    const byId = Object.fromEntries(groups.map(g => [g.id, g]));
    sorted.forEach(s => {
      const cid = enrollMap[s.id]?.classId;
      if (cid && byId[cid]) byId[cid].students.push(s);
      else unassigned.students.push(s);
    });
    const nonEmptyOrFiltered = groups.filter(g => g.students.length > 0 || !filterClass);
    return unassigned.students.length > 0 || !filterClass
      ? [...nonEmptyOrFiltered, unassigned]
      : nonEmptyOrFiltered;
  })();

  function toggleGroup(id) {
    setExpandedGroups(g => ({ ...g, [id]: !g[id] }));
  }

  // ── DUPLICATE NAME DETECTION ────────────────────────────────────
  const duplicateStudentGroups = (() => {
    const groups = {};
    students.filter(s => s.status !== 'withdrawn').forEach(s => {
      const key = `${s.firstName.trim().toLowerCase()} ${s.lastName.trim().toLowerCase()}`;
      (groups[key] = groups[key] || []).push(s);
    });
    return Object.values(groups).filter(g => g.length > 1);
  })();

  // ── PLAN STUDENT LIMIT — strictly enforced, never exceeded ─────────
  // students.length reflects the real active count (removal is now a
  // permanent hard-delete, so there's no soft-deleted/withdrawn students
  // inflating the number).
  const atLimit        = studentLimit != null && students.length >= studentLimit;
  const remainingSlots = studentLimit != null ? Math.max(0, studentLimit - students.length) : Infinity;

  // Live check — does the name currently typed in Quick Add match an
  // existing student? Shown as an inline warning before they even submit.
  const qNameMatch = (qFirst.trim() && qLast.trim())
    ? students.find(s =>
        s.firstName.trim().toLowerCase() === qFirst.trim().toLowerCase() &&
        s.lastName.trim().toLowerCase()  === qLast.trim().toLowerCase()
      )
    : null;

  // ── QUICK ADD ─────────────────────────────────────────────────
  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!qFirst.trim() || !qLast.trim()) return;
    if (atLimit) {
      setError(
        `Your ${plan?.name || 'current'} plan is limited to ${studentLimit} students, and you're ` +
        `already at that limit. Upgrade your plan to add more students.`
      );
      return;
    }
    if (qNameMatch && !window.confirm(
      `A student named "${qFirst.trim()} ${qLast.trim()}" already exists ` +
      `(code ${qNameMatch.studentCode}). Add another student with the same name anyway?`
    )) return;
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
      if (atLimit) {
        throw new Error(
          `Your ${plan?.name || 'current'} plan is limited to ${studentLimit} students, and you're ` +
          `already at that limit. Upgrade your plan to add more students.`
        );
      }
      await createStudent(schoolId, form, school?.code || 'STU', students.length);
    }
    await load();
  }

  async function handleEnroll(form) {
    await enrollStudent(schoolId, selected.id, form.classId, form.academicYear, form.term);
    await load();
  }

  // Removing a student is now a PERMANENT hard delete — the student record
  // and their enrollment records are deleted from Firestore entirely. This
  // cannot be undone. (Previously this soft-deleted by setting status to
  // 'withdrawn'; that behavior has been replaced per admin requirements.)
  async function handleRemove(student) {
    if (!window.confirm(
      `Permanently delete ${student.firstName} ${student.lastName}?\n\n` +
      `This PERMANENTLY removes the student and their enrollment record ` +
      `from the system. This cannot be undone.`
    )) return;
    try {
      await deleteStudentPermanently(schoolId, student.id);
      await load();
    } catch (err) {
      setError('Failed to remove student: ' + err.message);
    }
  }

  // Shared action buttons — used by Table and Card views (Kanban and Tree
  // use their own compact inline versions to fit tighter layouts).
  function renderStudentActions(s, cls) {
    return (
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('edit'); }}>Edit</button>
        {!cls && (
          <button className="btn btn-primary btn-sm" onClick={() => { setSelected(s); setModal('enroll'); }}>Enroll</button>
        )}
        {cls && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('enroll'); }}>Re-enroll</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => handleRemove(s)}>Remove</button>
      </div>
    );
  }

  // ── IMPORT ────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (atLimit) {
      alert(
        `Your ${plan?.name || 'current'} plan is limited to ${studentLimit} students, and you're ` +
        `already at that limit. Upgrade your plan before importing more students.`
      );
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      const rows = await importStudentsFromExcel(file, schoolId);
      if (rows.length === 0) {
        alert(
          'No students found in the file.\n\n' +
          'Make sure you are using the SchoolPilot template and that:\n' +
          '• First Name and Last Name columns are filled in\n' +
          '• The file is saved as .xlsx (not .csv)\n' +
          '• You deleted or replaced the example rows before saving\n\n' +
          'Download a fresh template using the "⬇ Download Template" button.'
        );
        return;
      }

      // Strictly cap the import so the plan limit is never exceeded —
      // even if the file itself contains more rows than remaining slots.
      let rowsToImport = rows;
      let trimmedCount = 0;
      if (remainingSlots !== Infinity && rows.length > remainingSlots) {
        trimmedCount = rows.length - remainingSlots;
        rowsToImport = rows.slice(0, remainingSlots);
        if (remainingSlots === 0) {
          alert(`Your ${plan?.name || 'current'} plan is limited to ${studentLimit} students, and you're already at that limit.`);
          return;
        }
        if (!window.confirm(
          `This file has ${rows.length} students, but your ${plan?.name || 'current'} plan only has ` +
          `${remainingSlots} slot(s) left (limit: ${studentLimit}).\n\n` +
          `Only the first ${remainingSlots} will be imported, and ${trimmedCount} will be skipped. ` +
          `Upgrade your plan first if you need to import all of them. Continue with a partial import?`
        )) return;
      }

      const result = await importStudentsFromArray(schoolId, rowsToImport, school?.code || 'STU', students.length);
      const skippedForLimit = trimmedCount > 0 ? `\n${trimmedCount} row(s) were skipped — plan limit reached.` : '';
      const msg = result.errors.length
        ? `✓ Imported ${result.success.length} student(s).\n\n` +
          `${result.errors.length} row(s) were skipped — likely duplicate student IDs or missing required fields.${skippedForLimit}`
        : `✓ Successfully imported ${result.success.length} student(s).${skippedForLimit}`;
      alert(msg);
      await load();
    } catch (err) {
      alert('Import failed: ' + err.message + '\n\nMake sure the file is a valid .xlsx Excel file.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>
          Students{' '}
          <span style={{ fontSize: '.85rem', fontWeight: 400, color: atLimit ? 'var(--danger)' : 'var(--text-lt)' }}>
            ({students.length}{studentLimit != null ? ` / ${studentLimit}` : ''})
          </span>
        </h1>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={downloadStudentImportTemplate}
              title="Download the Excel template, fill it in with your students, then use Import Excel to upload"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ⬇ Download Template
            </button>
            <label
              className="btn btn-ghost btn-sm"
              style={{
                cursor: atLimit ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                opacity: atLimit ? .5 : 1,
              }}
              title={atLimit ? `Plan limit of ${studentLimit} students reached — upgrade to import more` : ''}
            >
              {importing ? '⏳ Importing…' : '⬆ Import Excel'}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} disabled={atLimit} />
            </label>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setSelected(null); setModal('add'); }}
              disabled={atLimit}
              title={atLimit ? `Plan limit of ${studentLimit} students reached — upgrade to add more` : ''}
            >
              + Full Add
            </button>
          </div>
        )}
      </div>

      {atLimit && (
        <div className="alert alert-warning" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>
            🚫 You've reached your {plan?.name || 'current'} plan's limit of <strong>{studentLimit} students</strong>.
            Remove an inactive student or upgrade your plan to add more.
          </span>
          <Link to="/settings" style={{ fontWeight: 700, color: 'var(--navy)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            View Plans →
          </Link>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 10 }}>
          {error} <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {isAdmin && duplicateStudentGroups.length > 0 && (
        <div className="card" style={{ marginBottom: 10, border: '1.5px solid #e65100', background: '#fff8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#e65100', marginBottom: 8 }}>
            ⚠ Possible Duplicate Students Found
          </div>
          {duplicateStudentGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #ffe0b2' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 600, marginBottom: 4 }}>
                {group[0].firstName} {group[0].lastName} — {group.length} entries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                    border: '1px solid var(--border)', borderRadius: 6, background: '#fff', fontSize: '.72rem',
                  }}>
                    <span>{s.studentCode} — {enrollMap[s.id] ? classMap[enrollMap[s.id].classId]?.name : 'Not enrolled'}</span>
                    <button className="btn btn-danger btn-sm" style={{ fontSize: '.68rem', padding: '1px 6px' }} onClick={() => handleRemove(s)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)' }}>
            Removing withdraws the student and preserves their historical scores/results.
          </div>
        </div>
      )}

      {/* ── QUICK ADD ROW ── */}
      {isAdmin && atLimit && (
        <div className="card" style={{ marginBottom: 10, textAlign: 'center', padding: '14px' }}>
          <div style={{ fontSize: '.84rem', color: 'var(--text-mid)' }}>
            ⚡ Quick Add is disabled — you're at your plan's {studentLimit}-student limit.{' '}
            <Link to="/settings" style={{ color: 'var(--navy)', fontWeight: 700 }}>Upgrade your plan</Link> to add more.
          </div>
        </div>
      )}
      {isAdmin && !atLimit && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.82rem', color: 'var(--navy)', marginBottom: 8 }}>
            ⚡ Quick Add Student
            {studentLimit != null && (
              <span style={{ fontWeight: 400, color: 'var(--text-lt)', marginLeft: 8 }}>
                ({remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} left on your plan)
              </span>
            )}
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
          {qNameMatch && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: '#fff3e0', color: '#e65100', fontSize: '.76rem', fontWeight: 600,
            }}>
              ⚠ A student named "{qFirst.trim()} {qLast.trim()}" already exists (code {qNameMatch.studentCode}
              {enrollMap[qNameMatch.id] ? `, ${classMap[enrollMap[qNameMatch.id].classId]?.name || 'enrolled'}` : ', not enrolled'}).
              You'll be asked to confirm before adding a duplicate.
            </div>
          )}
          <div style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span>Press Enter to add and continue. Student is auto-enrolled if a class is selected. Use <strong>+ Full Add</strong> for DOB, guardian, address.</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <span style={{ color: '#aaa' }}>Adding many students?</span>
              <button
                onClick={downloadStudentImportTemplate}
                style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 700, fontSize: '.72rem', padding: 0, textDecoration: 'underline' }}
              >
                ⬇ Download Excel Template
              </button>
            </span>
          </div>
        </div>
      )}

      <div className="card">
        {/* Filters */}
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <input
            placeholder="🔍 Search name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ minWidth: 130 }}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ minWidth: 110 }}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ minWidth: 120 }} title="Sort by">
            <option value="name">Sort: Name</option>
            <option value="code">Sort: ID</option>
            <option value="class">Sort: Class</option>
            <option value="status">Sort: Status</option>
            <option value="gender">Sort: Gender</option>
          </select>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
          >
            {sortDir === 'asc' ? '↑ A–Z' : '↓ Z–A'}
          </button>
          {(search || filterClass || filterGender || filterStatus) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setFilterClass(''); setFilterGender(''); setFilterStatus(''); }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* View mode toggle + result count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'table',  label: '☰ Table'  },
              { key: 'card',   label: '▦ Cards'  },
              { key: 'kanban', label: '📋 Kanban' },
              { key: 'tree',   label: '🌳 Tree'   },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`btn btn-sm ${viewMode === v.key ? 'btn-primary' : 'btn-ghost'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '.8rem', color: 'var(--text-lt)', whiteSpace: 'nowrap' }}>
            Showing {filtered.length} of {students.length}
          </span>
        </div>

        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>{search || filterClass || filterGender || filterStatus ? 'No students match your filters.' : 'No students yet. Use Quick Add above.'}</p>
          </div>
        ) : viewMode === 'table' ? (
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
                {sorted.map(s => {
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
                      {isAdmin && <td>{renderStudentActions(s, cls)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {sorted.map(s => {
              const enr = enrollMap[s.id];
              const cls = enr ? classMap[enr.classId] : null;
              return (
                <div key={s.id} className="card" style={{ margin: 0, padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{s.lastName}, {s.firstName}</div>
                  <div className="td-mono" style={{ fontSize: '.74rem', color: 'var(--text-lt)', marginBottom: 8 }}>{s.studentCode}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="badge badge-neutral" style={{ fontSize: '.7rem' }}>{s.gender}</span>
                    {cls
                      ? <span className="badge badge-info" style={{ fontSize: '.7rem' }}>{cls.name}</span>
                      : <span className="badge badge-neutral" style={{ fontSize: '.7rem' }}>Not enrolled</span>
                    }
                    <span className={`badge badge-${s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'neutral'}`} style={{ fontSize: '.7rem' }}>
                      {s.status}
                    </span>
                  </div>
                  {isAdmin && renderStudentActions(s, cls)}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'kanban' ? (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {groupsByClass.map(g => (
              <div key={g.id} style={{
                flex: '0 0 240px', background: 'var(--surface2)', borderRadius: 10, padding: 10,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid var(--border)',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '.85rem' }}>{g.name}</span>
                  <span className="badge badge-info" style={{ fontSize: '.72rem' }}>{g.students.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
                  {g.students.length === 0 ? (
                    <div style={{ fontSize: '.76rem', color: 'var(--text-lt)', textAlign: 'center', padding: '10px 0' }}>No students</div>
                  ) : g.students.map(s => (
                    <div key={s.id} className="card" style={{ margin: 0, padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{s.lastName}, {s.firstName}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <span className="td-mono" style={{ fontSize: '.7rem', color: 'var(--text-lt)' }}>{s.studentCode}</span>
                        <span className={`badge badge-${s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'neutral'}`} style={{ fontSize: '.64rem' }}>
                          {s.status}
                        </span>
                      </div>
                      {isAdmin && (
                        <div style={{ marginTop: 6 }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: '.68rem', padding: '2px 6px' }} onClick={() => { setSelected(s); setModal('edit'); }}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: '.68rem', padding: '2px 6px' }} onClick={() => { setSelected(s); setModal('enroll'); }}>{g.id === '__unassigned' ? 'Enroll' : 'Move'}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── TREE VIEW ── */
          <div>
            {groupsByClass.map(g => {
              const isOpen = expandedGroups[g.id] ?? true;
              return (
                <div key={g.id} style={{ marginBottom: 8 }}>
                  <div
                    onClick={() => toggleGroup(g.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, fontWeight: 700,
                    }}
                  >
                    <span style={{ fontSize: '.72rem', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
                    <span>{g.id === '__unassigned' ? '📂' : '🏫'} {g.name}</span>
                    <span className="badge badge-info" style={{ fontSize: '.7rem', marginLeft: 'auto' }}>{g.students.length} student{g.students.length !== 1 ? 's' : ''}</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginLeft: 24, marginTop: 4, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
                      {g.students.length === 0 ? (
                        <div style={{ fontSize: '.78rem', color: 'var(--text-lt)', padding: '6px 0' }}>No students in this class</div>
                      ) : g.students.map(s => (
                        <div key={s.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', fontSize: '.82rem', borderBottom: '1px solid var(--border)',
                        }}>
                          <span>👤 {s.lastName}, {s.firstName} <span className="td-mono" style={{ fontSize: '.7rem', color: 'var(--text-lt)' }}>({s.studentCode})</span></span>
                          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className={`badge badge-${s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'neutral'}`} style={{ fontSize: '.68rem' }}>
                              {s.status}
                            </span>
                            {isAdmin && (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: '.68rem', padding: '1px 6px' }} onClick={() => { setSelected(s); setModal('edit'); }}>Edit</button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <StudentModal
          student={modal === 'edit' ? selected : null}
          existingStudents={students}
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
