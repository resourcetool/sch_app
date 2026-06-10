// src/pages/Reports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { getEnrollments, getStudents } from '../services/studentService';
import { getResultsForClass, generateResults, finalizeResults, defaultGradingScale } from '../services/scoreService';
import { generateStudentReportPDF, generateClassReportPDF, downloadPDF } from '../services/reportService';
import { exportResultsAsExcel } from '../services/backupService';

export default function Reports() {
  const { school, classes, subjects, schoolId } = useSchool();
  const [filters, setFilters] = useState({
    classId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1'
  });
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState('results'); // 'results' | 'generate'

  const load = useCallback(async () => {
    if (!filters.classId || !schoolId) return;
    setLoading(true);
    try {
      const [res, studs] = await Promise.all([
        getResultsForClass(schoolId, filters.classId, filters.academicYear, filters.term),
        getStudents(schoolId)
      ]);
      setResults(res.sort((a, b) => a.position - b.position));
      setStudents(studs);
    } finally {
      setLoading(false);
    }
  }, [filters, schoolId]);

  useEffect(() => { load(); }, [load]);

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const selectedClass = classes.find(c => c.id === filters.classId);

  async function handleGenerateResults() {
    if (!filters.classId) { alert('Select a class'); return; }
    if (!window.confirm(`Generate results for ${selectedClass?.name} — ${filters.academicYear} Term ${filters.term}?\n\nThis will compute all positions and averages.`)) return;
    setGenerating(true);
    try {
      await generateResults(schoolId, filters.classId, filters.academicYear, filters.term, defaultGradingScale());
      await load();
      alert('Results generated successfully!');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalize() {
    if (!window.confirm('Finalize results? This locks the results and enables promotion.')) return;
    setFinalizing(true);
    try {
      await finalizeResults(schoolId, filters.classId, filters.academicYear, filters.term);
      await load();
      alert('Results finalized!');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setFinalizing(false);
    }
  }

  async function downloadStudentReport(result) {
    const student = studentMap[result.studentId];
    if (!student) { alert('Student not found'); return; }
    const doc = await generateStudentReportPDF(
      student,
      { classId: filters.classId },
      { ...result, totalStudents: results.length },
      selectedClass,
      school,
      filters.term,
      filters.academicYear
    );
    downloadPDF(doc, `report_${student.studentCode}_term${filters.term}.pdf`);
  }

  async function downloadClassReport() {
    if (results.length === 0) { alert('No results to export'); return; }
    const doc = await generateClassReportPDF(selectedClass, results, students, school, filters.academicYear, filters.term);
    downloadPDF(doc, `class_report_${selectedClass?.name}_term${filters.term}.pdf`);
  }

  async function handleExcelExport() {
    await exportResultsAsExcel(schoolId, filters.classId, filters.academicYear, filters.term);
  }

  const isFinalized = results.length > 0 && results.every(r => r.isFinalized);
  const hasResults = results.length > 0;

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        {hasResults && (
          <div className="actions">
            <button onClick={handleExcelExport} className="btn btn-ghost">⬇ Excel</button>
            <button onClick={downloadClassReport} className="btn btn-ghost">📄 Class PDF</button>
            {!isFinalized && (
              <button onClick={handleFinalize} className="btn btn-accent" disabled={finalizing}>
                {finalizing ? 'Finalizing…' : '🔒 Finalize Results'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar">
          <div className="form-group" style={{ minWidth: 200 }}>
            <label style={{ fontSize: '.75rem' }}>Class</label>
            <select value={filters.classId} onChange={e => setFilters(f => ({ ...f, classId: e.target.value }))}>
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Academic Year</label>
            <input value={filters.academicYear} onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} style={{ maxWidth: 130 }} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Term</label>
            <select value={filters.term} onChange={e => setFilters(f => ({ ...f, term: e.target.value }))} style={{ maxWidth: 100 }}>
              <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={handleGenerateResults} className="btn btn-primary" disabled={generating || !filters.classId}>
              {generating ? 'Generating…' : '⚡ Generate Results'}
            </button>
          </div>
        </div>

        {isFinalized && (
          <div className="alert alert-success" style={{ marginTop: 12, marginBottom: 0 }}>
            ✓ Results are finalized. Promotion is now available for this class/term.
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="card">
        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : !filters.classId ? (
          <div className="empty-state">
            <div className="icon">📄</div>
            <p>Select a class to view or generate results.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📊</div>
            <p>No results yet. Enter scores first, then click "Generate Results".</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card accent">
                <span className="label">Students</span>
                <span className="value">{results.length}</span>
              </div>
              <div className="stat-card green">
                <span className="label">Class Average</span>
                <span className="value">
                  {results.length > 0 ? (results.reduce((s, r) => s + r.average, 0) / results.length).toFixed(1) : 0}%
                </span>
              </div>
              <div className="stat-card blue">
                <span className="label">Highest Average</span>
                <span className="value">{results[0]?.average ?? 0}%</span>
              </div>
              <div className="stat-card gold">
                <span className="label">Status</span>
                <span className="value" style={{ fontSize: '1rem' }}>{isFinalized ? '🔒 Final' : '📝 Draft'}</span>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Student ID</th>
                    <th>Name</th>
                    {results[0]?.subjectResults?.map(sr => <th key={sr.subjectId}>{sr.subjectName}</th>)}
                    <th>Total</th>
                    <th>Average</th>
                    <th>Status</th>
                    <th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => {
                    const student = studentMap[result.studentId];
                    return (
                      <tr key={result.id}>
                        <td style={{ fontWeight: 800, color: result.position <= 3 ? 'var(--gold)' : 'var(--navy)', width: 36 }}>
                          {result.position}
                        </td>
                        <td className="td-mono">{student?.studentCode || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</td>
                        {result.subjectResults?.map(sr => (
                          <td key={sr.subjectId}>
                            <span style={{ fontWeight: 600 }}>{sr.total}</span>
                            <span style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginLeft: 4 }}>({sr.grade})</span>
                          </td>
                        ))}
                        <td style={{ fontWeight: 800 }}>{result.totalScore}</td>
                        <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{result.average}%</td>
                        <td>
                          <span className={`badge badge-${result.isFinalized ? 'success' : 'warning'}`}>
                            {result.isFinalized ? 'Final' : 'Draft'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => downloadStudentReport(result)}>
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
