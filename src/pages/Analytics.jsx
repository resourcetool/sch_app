// src/pages/Analytics.jsx
//
// Changes:
// - Teachers see charts filtered to their assigned classes only
// - Uses classesForUser from SchoolContext (same pattern as Scores)
// - Added subscription gate: analytics requires pro/premium; shows upgrade prompt otherwise
// - All existing charts preserved

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useSchool }        from '../contexts/SchoolContext';
import { useAuth }          from '../contexts/AuthContext';
import { useSubscription }  from '../contexts/SubscriptionContext';
import { idbGetAll }        from '../services/indexedDB';
import { getStudents }      from '../services/studentService';

const COLORS      = ['#0f3460','#e94560','#27ae60','#f5a623','#2980b9','#8e44ad','#16a085'];
const GRADE_COLORS = { A1:'#27ae60',B2:'#2196F3',B3:'#42A5F5',C4:'#f5a623',C5:'#FFA726',C6:'#FF7043',D7:'#ef5350',E8:'#e53935',F9:'#b71c1c' };

function ChartCard({ title, children, fullWidth }) {
  return (
    <div className="chart-card" style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="chart-title">{title}</div>
      {children}
    </div>
  );
}

function UpgradePrompt({ planNeeded }) {
  return (
    <div style={{
      minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', textAlign: 'center', padding: 32,
    }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📈</div>
      <h3 style={{ color: 'var(--navy)', marginBottom: 8 }}>Analytics requires {planNeeded}</h3>
      <p style={{ color: 'var(--text-mid)', fontSize: '.88rem', maxWidth: 360, marginBottom: 20 }}>
        Upgrade your subscription to unlock charts, grade distributions, subject comparisons,
        and individual student progress tracking.
      </p>
      <a
        href="https://wa.me/233549271528"
        target="_blank" rel="noreferrer"
        style={{
          background: '#25D366', color: '#fff', padding: '10px 24px',
          borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '.9rem',
        }}
      >
        📱 Upgrade via WhatsApp
      </a>
    </div>
  );
}

export default function Analytics() {
  const { school, classes, subjects, schoolId, classesForUser } = useSchool();
  const { userProfile } = useAuth();
  const { can, status }  = useSubscription();

  const isTeacher = userProfile?.role === 'teacher';

  const [filters, setFilters] = useState({
    classId: '', academicYear: school?.academicYear || '',
  });
  const [analytics,        setAnalytics]        = useState([]);
  const [allResults,       setAllResults]        = useState([]);
  const [students,         setStudents]          = useState([]);
  const [selectedStudentId,setSelectedStudentId] = useState('');
  const [loading,          setLoading]           = useState(false);

  // Analytics is a Pro/Premium feature
  const hasAnalytics = can('analytics');

  const load = useCallback(async () => {
    if (!schoolId || !hasAnalytics) return;
    setLoading(true);
    try {
      const [snaps, results, studs] = await Promise.all([
        idbGetAll('analytics', 'schoolId', schoolId),
        idbGetAll('results',   'schoolId', schoolId),
        getStudents(schoolId),
      ]);
      setAnalytics(snaps);
      setAllResults(results);
      setStudents(studs);
    } finally {
      setLoading(false);
    }
  }, [schoolId, hasAnalytics]);

  useEffect(() => { load(); }, [load]);

  // Teachers only see their assigned classes
  const availableClasses = classesForUser;

  // Filtered analytics
  const classAnalytics = analytics.filter(a =>
    (!filters.classId      || a.classId      === filters.classId) &&
    (!filters.academicYear || a.academicYear === filters.academicYear)
  ).sort((a, b) => Number(a.term) - Number(b.term));

  const trendData   = classAnalytics.map(a => ({ name: `Term ${a.term}`, 'Class Average': a.classAverage, Students: a.studentCount }));
  const latestSnap  = classAnalytics[classAnalytics.length - 1];
  const subjectData = latestSnap?.subjectAverages?.map(s => ({
    name: s.subjectName.length > 10 ? s.subjectName.substring(0, 10) + '…' : s.subjectName,
    fullName: s.subjectName, Average: s.average,
  })) || [];

  const gradeMap = {};
  classAnalytics.forEach(snap => {
    Object.entries(snap.gradeDistribution || {}).forEach(([g, c]) => { gradeMap[g] = (gradeMap[g] || 0) + c; });
  });
  const gradeData = Object.entries(gradeMap).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));

  const studentResults = allResults
    .filter(r => r.studentId === selectedStudentId && (!filters.classId || r.classId === filters.classId))
    .sort((a, b) => Number(a.term) - Number(b.term));
  const studentProgressData = studentResults.map(r => ({ name: `${r.academicYear} T${r.term}`, Average: r.average, Position: r.position }));

  const latestResults = allResults
    .filter(r => (!filters.classId || r.classId === filters.classId) && r.academicYear === filters.academicYear)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);
  const studentMap  = Object.fromEntries(students.map(s => [s.id, s]));
  const positionData = latestResults.map(r => {
    const s = studentMap[r.studentId];
    return { name: s ? `${s.firstName} ${s.lastName}`.substring(0, 12) : 'Unknown', Average: r.average, Position: r.position };
  });

  const classStudents = allResults.filter(r => r.classId === filters.classId).map(r => r.studentId).filter((v, i, a) => a.indexOf(v) === i);

  // ── SUBSCRIPTION GATE ─────────────────────────────────────────
  if (!hasAnalytics) {
    return (
      <div>
        <div className="page-header"><h1>Analytics Dashboard</h1></div>
        <div className="card"><UpgradePrompt planNeeded="Pro or Premium plan" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Analytics Dashboard</h1>
        <button onClick={load} className="btn btn-ghost btn-sm">↻ Refresh</button>
      </div>

      {isTeacher && (
        <div className="alert alert-info" style={{ marginBottom: 12, fontSize: '.83rem' }}>
          📊 Showing analytics for your assigned classes only.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar">
          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Class</label>
            <select value={filters.classId} onChange={e => setFilters(f => ({ ...f, classId: e.target.value }))}>
              <option value="">All Classes</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontSize: '.75rem' }}>Academic Year</label>
            <input value={filters.academicYear} onChange={e => setFilters(f => ({ ...f, academicYear: e.target.value }))} style={{ maxWidth: 130 }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="spinner-center"><div className="spinner" /></div>
      ) : analytics.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📈</div>
          <p>No analytics data yet. Generate results for at least one class/term first.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card accent">
              <span className="label">Snapshots</span>
              <span className="value">{classAnalytics.length}</span>
              <span className="change">Across terms</span>
            </div>
            {latestSnap && (
              <>
                <div className="stat-card green">
                  <span className="label">Latest Average</span>
                  <span className="value">{latestSnap.classAverage}%</span>
                  <span className="change">Term {latestSnap.term}</span>
                </div>
                <div className="stat-card blue">
                  <span className="label">Students Assessed</span>
                  <span className="value">{latestSnap.studentCount}</span>
                </div>
              </>
            )}
          </div>

          <div className="charts-grid">
            <ChartCard title="📈 Class Average Trend">
              {trendData.length < 2
                ? <p className="text-muted text-sm">Need results from at least 2 terms.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="Class Average" stroke="#0f3460" strokeWidth={2.5} dot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
              }
            </ChartCard>

            <ChartCard title="📚 Subject Performance">
              {subjectData.length === 0
                ? <p className="text-muted text-sm">Select a class to view subject averages.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={subjectData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val, _, p) => [val, p.payload?.fullName || 'Average']} />
                      <Bar dataKey="Average" radius={[4, 4, 0, 0]}>
                        {subjectData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </ChartCard>

            <ChartCard title="🎓 Grade Distribution">
              {gradeData.length === 0
                ? <p className="text-muted text-sm">No grade data available.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={gradeData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {gradeData.map((entry, i) => <Cell key={i} fill={GRADE_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
              }
            </ChartCard>

            <ChartCard title="🏆 Top 10 Students">
              {positionData.length === 0
                ? <p className="text-muted text-sm">Select a class and year to see ranking.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={positionData} layout="vertical" margin={{ top: 4, right: 30, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="Average" radius={[0, 4, 4, 0]}>
                        {positionData.map((_, i) => <Cell key={i} fill={i === 0 ? '#f5a623' : i === 1 ? '#8898aa' : i === 2 ? '#cd7f32' : '#0f3460'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </ChartCard>
          </div>

          <div className="chart-card" style={{ marginTop: 16 }}>
            <div className="chart-title">👤 Individual Student Progress</div>
            <div className="filter-bar" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label style={{ fontSize: '.75rem' }}>Select Student</label>
                <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} style={{ maxWidth: 280 }}>
                  <option value="">— Select Student —</option>
                  {students
                    .filter(s => !filters.classId || classStudents.includes(s.id))
                    .map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentCode})</option>)}
                </select>
              </div>
            </div>
            {!selectedStudentId
              ? <p className="text-muted text-sm">Select a student to view their progress across terms.</p>
              : studentProgressData.length === 0
                ? <p className="text-muted text-sm">No results found for this student.</p>
                : <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={studentProgressData} margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="avg" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="pos" orientation="right" reversed tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Line yAxisId="avg" type="monotone" dataKey="Average"  stroke="#0f3460" strokeWidth={2.5} dot={{ r: 5 }} />
                      <Line yAxisId="pos" type="monotone" dataKey="Position" stroke="#e94560" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
            }
          </div>
        </>
      )}
    </div>
  );
}
