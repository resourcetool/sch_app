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
                            <button className="btn btn-danger btn-sm" onClick={() => handleRemove(s)}>Remove</button>
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
