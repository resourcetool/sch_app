// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';
import { idbGetAll } from '../services/indexedDB';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { school, classes, subjects, teachers, schoolId } = useSchool();
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ students: 0, enrollments: 0, results: 0, pendingSync: 0 });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (!schoolId) return;
    async function load() {
      const [students, enrollments, results, promotions, syncQueue] = await Promise.all([
        idbGetAll('students', 'schoolId', schoolId),
        idbGetAll('enrollments', 'schoolId', schoolId),
        idbGetAll('results', 'schoolId', schoolId),
        idbGetAll('promotions', 'schoolId', schoolId),
        idbGetAll('syncQueue')
      ]);
      setStats({
        students: students.length,
        enrollments: enrollments.filter(e => e.status === 'active').length,
        results: results.length,
        pendingSync: syncQueue.filter(s => s.status === 'pending').length
      });
      // Recent promotions as activity
      const recent = promotions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4).map(p => ({
        type: 'promotion',
        label: `Class promoted`,
        sub: `${p.summary?.total || 0} students · ${new Date(p.timestamp).toLocaleDateString()}`,
        icon: '🚀'
      }));
      setRecentActivity(recent);
    }
    load();
  }, [schoolId]);

  const quickActions = [
    { to: '/students', icon: '👥', label: 'Add Student', color: 'var(--navy)' },
    { to: '/scores',   icon: '✏️', label: 'Enter Scores', color: 'var(--accent)' },
    { to: '/reports',  icon: '📄', label: 'Generate Report', color: 'var(--success)' },
    { to: '/promotion',icon: '🚀', label: 'Run Promotion', color: 'var(--gold)' }
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: '.84rem', color: 'var(--text-lt)' }}>
          {school?.academicYear} · Term {school?.currentTerm}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <span className="label">Total Students</span>
          <span className="value">{stats.students}</span>
          <span className="change">Registered in system</span>
        </div>
        <div className="stat-card blue">
          <span className="label">Active Enrollments</span>
          <span className="value">{stats.enrollments}</span>
          <span className="change">Current term</span>
        </div>
        <div className="stat-card green">
          <span className="label">Results Generated</span>
          <span className="value">{stats.results}</span>
          <span className="change">Across all terms</span>
        </div>
        <div className="stat-card gold">
          <span className="label">Classes</span>
          <span className="value">{classes.length}</span>
          <span className="change">{subjects.length} subjects</span>
        </div>
        <div className="stat-card">
          <span className="label">Teachers</span>
          <span className="value">{teachers.length}</span>
          <span className="change">Active staff</span>
        </div>
        {stats.pendingSync > 0 && (
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)', borderLeftWidth: 4 }}>
            <span className="label">Pending Sync</span>
            <span className="value" style={{ color: 'var(--warning)' }}>{stats.pendingSync}</span>
            <span className="change">Will sync when online</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {quickActions.map(a => (
              (userProfile?.role === 'teacher' && a.to === '/promotion') ? null :
              <Link key={a.to} to={a.to}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '18px 12px', borderRadius: 'var(--radius)',
                  background: 'var(--surface2)', border: '1.5px solid var(--border)',
                  transition: 'border-color .15s', textDecoration: 'none', gap: 8
                }}>
                <span style={{ fontSize: 1.6 + 'rem' }}>{a.icon}</span>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: a.color }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* School Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">School Information</span>
            <Link to="/settings" className="btn btn-ghost btn-sm">Edit</Link>
          </div>
          {school ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['School Name', school.name],
                ['School Code', school.code],
                ['Academic Year', school.academicYear],
                ['Current Term', `Term ${school.currentTerm}`],
                ['Phone', school.phone || '—'],
                ['Address', school.address || '—']
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, fontSize: '.84rem', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-mid)', width: 120, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-muted">Loading school info…</p>}
        </div>

        {/* Recent Activity */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <p>No recent activity. Start by adding students and entering scores.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '1.3rem' }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.86rem' }}>{a.label}</div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text-lt)' }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
