// src/pages/Reports.jsx
//
// Changes:
// - Added 🎨 Customise button that opens ReportCustomizer modal
// - Admin can set report colors, fonts, border style, signatures from here
// - Subscription gate: reports with watermark on starter/trial; full PDF on pro/premium
// - All existing functionality preserved

import React, { useState, useEffect, useCallback } from 'react';
import { useSchool }       from '../contexts/SchoolContext';
import { useAuth }         from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getEnrollments, getStudents } from '../services/studentService';
import {
  getResultsForClass, generateResults,
  finalizeResults, defaultGradingScale,
} from '../services/scoreService';
import {
  generateStudentReportPDF, generateClassReportPDF, downloadPDF,
} from '../services/reportService';
import ReportCustomizer from '../components/ReportCustomizer';

export default function Reports() {
  const { school, classes, subjects, schoolId } = useSchool();
  const { userProfile } = useAuth();
  const { can, watermark } = useSubscription();

  const isAdmin = userProfile?.role === 'admin';

  const [filters, setFilters] = useState({
    classId: '', academicYear: school?.academicYear || '', term: school?.currentTerm || '1',
  });
  const [results,         setResults]         = useState([]);
  const [students,        setStudents]         = useState([]);
  const [loading,         setLoading]          = useState(false);
  const [generating,      setGenerating]       = useState(false);
  const [finalizing,      setFinalizing]       = useState(false);
  const [printing,        setPrinting]         = useState(false);
  const [showCustomizer,  setShowCustomizer]   = useState(false);

  const load = useCallback(async () => {
    if (!filters.classId || !schoolId) return;
    setLoading(true);
    try {
      const [res, studs] = await Promise.all([
        getResultsForClass(schoolId, filters.classId, filters.academicYear, filters.term),
        getStudents(schoolId),
      ]);
      setResults(res.sort((a, b) => a.position - b.position));
      setStudents(studs);
    } finally { setLoading(false); }
  }, [filters, schoolId]);

  useEffect(() => { load(); }, [load]);

  const studentMap    = Object.fromEntries(students.map(s => [s.id, s]));
  const selectedClass = classes.find(c => c.id === filters.classId);

  async function handleGenerateResults() {
    if (!filters.classId) { alert('Select a class'); return; }
    if (!window.confirm(`Generate results for ${selectedClass?.name}?`)) return;
    setGenerating(true);
    try {
      const scale = school?.gradingScale?.length ? school.gradingScale : defaultGradingScale();
      await generateResults(schoolId, filters.classId, filters.academicYear, filters.term, scale);
      await load();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setGenerating(false); }
  }

  async function handleFinalize() {
    if (!window.confirm('Finalize results? This locks scores for promotion.')) return;
    setFinalizing(true);
    try { await finalizeResults(schoolId, filters.classId, filters.academicYear, filters.term); await load(); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setFinalizing(false); }
  }

  // Builds the real, current data shown on every report card.
  // No placeholders — every field is sourced from actual admin/teacher input.
  // className is the TRUE class name the admin created (replaces "MEC").
  // totalStudents is the actual number of students in this class/term
  // (used for "RAW SCORE: X out of totalStudents").
  function buildExtraInfo() {
    return {
      classTeacher:   school?.classTeacher   || '',
      counsellor:     school?.counsellor     || '',
      academicHead:   school?.academicHead   || '',
      administrator:  school?.administrator  || '',
      nextTermBegins: school?.nextTermBegins
        ? new Date(school.nextTermBegins).toLocaleDateString('en-GH', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '',
      className:     selectedClass?.name || '',
      totalStudents: results.length,
    };
  }

  async function downloadStudentReport(result) {
    const student = studentMap[result.studentId];
    if (!student) { alert('Student not found'); return; }
    const schoolWithWatermark = watermark ? { ...school, reportStyle: { ...(school?.reportStyle || {}), showWatermark: true } } : school;
    const doc = await generateStudentReportPDF(
      student, { classId: filters.classId },
      { ...result, totalStudents: results.length },
      selectedClass, schoolWithWatermark,
      filters.term, filters.academicYear, buildExtraInfo(),
    );
    downloadPDF(doc, `report_${student.studentCode || student.firstName}_term${filters.term}.pdf`);
  }

  async function handlePrintAll() {
    if (results.length === 0) { alert('No results to print'); return; }
    if (!window.confirm(`Print ${results.length} report cards?`)) return;
    setPrinting(true);
    try {
      const extraInfo = buildExtraInfo();
      const schoolWithWatermark = watermark ? { ...school, reportStyle: { ...(school?.reportStyle || {}), showWatermark: true } } : school;
      for (const result of results) {
        const student = studentMap[result.studentId];
        if (!student) continue;
        const doc = await generateStudentReportPDF(
          student, { classId: filters.classId },
          { ...result, totalStudents: results.length },
          selectedClass, schoolWithWatermark,
          filters.term, filters.academicYear, extraInfo,
        );
        downloadPDF(doc, `report_${student.studentCode || student.firstName}_term${filters.term}.pdf`);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) { alert('Print error: ' + err.message); }
    finally { setPrinting(false); }
  }

  async function downloadClassReport() {
    if (results.length === 0) { alert('No results to export'); return; }
    const doc = await generateClassReportPDF(selectedClass, results, students, school, filters.academicYear, filters.term);
    downloadPDF(doc, `class_report_${selectedClass?.name}_term${filters.term}.pdf`);
  }

  const isFinalized = results.length > 0 && results.every(r => r.isFinalized);
  const hasResults  = results.length > 0;

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setShowCustomizer(true)} className="btn btn-ghost">
              🎨 Customise
            </button>
          )}
          {hasResults && (
            <>
              <button onClick={downloadClassReport} className="btn btn-ghost">📄 Class PDF</button>
              <button onClick={handlePrintAll} className="btn btn-ghost" disabled={printing}>
                {printing ? '⏳ Printing…' : '🖨 Print All'}
              </button>
              {isAdmin && !isFinalized && (
                <button onClick={handleFinalize} className="btn btn-accent" disabled={finalizing}>
                  {finalizing ? 'Finalizing…' : '🔒 Finalize'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {watermark && (
        <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: '.83rem' }}>
          ⚠ PDFs will include a watermark on your current plan. Upgrade to Pro or Premium for clean reports.
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="filter-bar">
          <div className="form-group" style={{ minWidth: 180 }}>
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
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
          {isAdmin && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button onClick={handleGenerateResults} className="btn btn-primary" disabled={generating || !filters.classId}>
                {generating ? 'Generating…' : '⚡ Generate Results'}
              </button>
            </div>
          )}
        </div>
        {isFinalized && (
          <div className="alert alert-success" style={{ marginTop: 10, marginBottom: 0 }}>
            ✓ Results finalized. Ready for promotion.
          </div>
        )}
        {isAdmin && !school?.classTeacher && hasResults && (
          <div className="alert alert-warning" style={{ marginTop: 10, marginBottom: 0 }}>
            ⚠ Signatories not set. Go to <strong>Settings → Report Card</strong> or click <strong>🎨 Customise</strong>.
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="card">
        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : !filters.classId ? (
          <div className="empty-state"><div className="icon">📄</div><p>Select a class to view results.</p></div>
        ) : results.length === 0 ? (
          <div className="empty-state"><div className="icon">📊</div><p>No results yet. Enter scores then click Generate Results.</p></div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: 12 }}>
              <div className="stat-card accent">
                <span className="label">Students</span>
                <span className="value">{results.length}</span>
              </div>
              <div className="stat-card green">
                <span className="label">Class Average</span>
                <span className="value">{(results.reduce((s, r) => s + r.average, 0) / results.length).toFixed(1)}%</span>
              </div>
              <div className="stat-card blue">
                <span className="label">Highest</span>
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
                    <th>Pos</th><th>ID</th><th>Name</th>
                    {results[0]?.subjectResults?.map(sr => <th key={sr.subjectId}>{sr.subjectName}</th>)}
                    <th>Total</th><th>Average</th><th>Status</th><th>Report</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => {
                    const student = studentMap[result.studentId];
                    return (
                      <tr key={result.id}>
                        <td style={{ fontWeight: 800, color: result.position <= 3 ? 'var(--gold)' : 'var(--navy)', width: 32 }}>
                          {result.position}
                        </td>
                        <td className="td-mono">{student?.studentCode || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</td>
                        {result.subjectResults?.map(sr => (
                          <td key={sr.subjectId}>
                            <span style={{ fontWeight: 600 }}>{sr.total}</span>
                            <span style={{ fontSize: '.72rem', color: 'var(--text-lt)', marginLeft: 3 }}>({sr.grade})</span>
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
                          <button className="btn btn-primary btn-sm" onClick={() => downloadStudentReport(result)}>
                            📄 Print
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

      {showCustomizer && <ReportCustomizer onClose={() => setShowCustomizer(false)} />}
    </div>
  );
}
