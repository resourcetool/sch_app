// src/pages/Students.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { getStudents, createStudent, updateStudent, enrollStudent, getEnrollments, importStudentsFromArray } from '../services/studentService';
import { importStudentsFromExcel } from '../services/backupService';

function StudentModal({ student, school, classes, onClose, onSave }) {
  const [form, setForm] = useState(student || {
    firstName: '', lastName: '', dateOfBirth: '', gender: 'Male',
    guardianName: '', guardianPhone: '', address: ''
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
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
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{student ? 'Edit Student' : 'Add New Student'}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
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
                <label>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select required value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Guardian Name</label>
                <input value={form.guardianName} onChange={e => setForm(f => ({ ...f, guardianName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Guardian Phone</label>
                <input value={form.guardianPhone} onChange={e => setForm(f => ({ ...f, guardianPhone: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EnrollModal({ student, school, classes, onClose, onSave }) {
  const [form, setForm] = useState({
    classId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1'
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.classId) { alert('Select a class'); return; }
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
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Enroll: {student.firstName} {student.lastName}</span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
            <button type="submit" className="btn btn-success" disabled={loading}>Enroll Student</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Students() {
  const { school, classes, schoolId } = useSchool();
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'enroll'
  const [selected, setSelected] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [s, e] = await Promise.all([
      getStudents(schoolId),
      getEnrollments(schoolId, { academicYear: school?.academicYear, term: school?.currentTerm })
    ]);
    setStudents(s.sort((a, b) => a.firstName.localeCompare(b.firstName)));
    setEnrollments(e);
    setLoading(false);
  }, [schoolId, school?.academicYear, school?.currentTerm]);

  useEffect(() => { load(); }, [load]);

  const enrollmentMap = Object.fromEntries(enrollments.map(e => [e.studentId, e]));

  const filtered = students.filter(s =>
    !search ||
    `${s.firstName} ${s.lastName} ${s.studentCode}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSaveStudent(form) {
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

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows = await importStudentsFromExcel(file, schoolId);
      const result = await importStudentsFromArray(schoolId, rows, school?.code || 'STU', students.length);
      alert(`Imported: ${result.success.length} students. Errors: ${result.errors.length}`);
      await load();
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  function getEnrollClass(studentId) {
    const enr = enrollmentMap[studentId];
    if (!enr) return null;
    return classes.find(c => c.id === enr.classId);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Students</h1>
        <div className="actions">
          <label className="btn btn-ghost">
            {importing ? 'Importing…' : '⬆ Import Excel'}
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>
            + Add Student
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <input placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
          <span style={{ marginLeft: 'auto', fontSize: '.82rem', color: 'var(--text-lt)', alignSelf: 'center' }}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <p>{search ? 'No students match your search.' : 'No students yet. Add your first student.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>D.O.B</th>
                  <th>Current Class</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const cls = getEnrollClass(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="td-mono">{s.studentCode}</td>
                      <td style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</td>
                      <td>{s.gender}</td>
                      <td>{s.dateOfBirth}</td>
                      <td>
                        {cls ? <span className="badge badge-info">{cls.name}</span>
                             : <span className="badge badge-neutral">Not Enrolled</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${s.status === 'active' ? 'success' : s.status === 'graduated' ? 'info' : 'neutral'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('edit'); }}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(s); setModal('enroll'); }}>Enroll</button>
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

      {(modal === 'add' || modal === 'edit') && (
        <StudentModal
          student={modal === 'edit' ? selected : null}
          school={school} classes={classes}
          onClose={() => setModal(null)}
          onSave={handleSaveStudent}
        />
      )}
      {modal === 'enroll' && selected && (
        <EnrollModal
          student={selected} school={school} classes={classes}
          onClose={() => setModal(null)}
          onSave={handleEnroll}
        />
      )}
    </div>
  );
}
