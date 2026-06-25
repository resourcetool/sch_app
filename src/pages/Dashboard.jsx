// src/pages/Dashboard.jsx
//
// Fix: results count was reading raw idbGetAll('results', ...) without
// deduplication. Since old duplicate result records (from the
// generateResults bug) may still exist in IDB/Firestore from before the
// fix, this page now deduplicates by enrollmentId+classId+academicYear+term
// the same way scoreService.getResultsForClass() does, so the dashboard
// never shows an inflated "results" count.

import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth }   from '../contexts/AuthContext';
import { idbGetAll } from '../services/indexedDB';
import { Link }      from 'react-router-dom';
import TrialBanner         from '../components/TrialBanner';
import ExpiryNotification  from '../components/ExpiryNotification';

// Deduplicate result records by enrollmentId, keeping only the most recent
// per enrollment within the same class/year/term. Mirrors the logic in
// scoreService.getResultsForClass() so dashboard counts always match Reports.
function dedupeResults(results) {
  const groups = {};
  results.forEach(r => {
    const key = `${r.enrollmentId}_${r.classId}_${r.academicYear}_${r.term}`;
    if (!groups[key] || (r.generatedAt || 0) > (groups[key].generatedAt || 0)) {
      groups[key] = r;
    }
  });
  return Object.values(groups);
}

export default function Dashboard() {
  const { school, classes, subjects, teachers, schoolId } = useSchool();
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ students: 0, enrollments: 0, results: 0, pendingSync: 0 });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (!schoolId) return;
    async function load() {
      const [students, enrollments, rawResults, promotions, syncQueue] = await Promise.all([
        idbGetAll('students',    'schoolId', schoolId),
        idbGetAll('enrollments', 'schoolId', schoolId),
        idbGetAll('results',     'schoolId', schoolId),
        idbGetAll('promotions',  'schoolId', schoolId),
        idbGetAll('syncQueue'),
      ]);

      const results = dedupeResults(rawResults);

      setStats({
        students:    students.length,
        enrollments: enrollments.filter(e => e.status === 'active').length,
        results:     results.length,
        pendingSync: syncQueue.filter(s => s.status === 'pending').length,
      });

      const recent = promotions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 4)
        .map(p => ({
          type:  'promotion',
          label: `Class promoted`,
          sub:   `${p.summary?.total || 0} students · ${new Date(p.timestamp).toLocaleDateString()}`,
          icon:  '🚀',
        }));
      setRecentActivity(recent);
    }
    load();
  }, [schoolId]);

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div>
      <TrialBanner />
      <ExpiryNotification />
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card accent">
          <span className="label">Students</span>
          <span className="value">{stats.students}</span>
          <span className="change">{stats.enrollments} actively enrolled</span>
        </div>
        <div className="stat-card blue">
          <span className="label">Classes</span>
          <span className="value">{classes.length}</span>
        </div>
        <div className="stat-card green">
          <span className="label">Subjects</span>
          <span className="value">{subjects.length}</span>
        </div>
        <div className="stat-card gold">
          <span className="label">Results Generated</span>
          <span className="value">{stats.results}</span>
        </div>
        {isAdmin && (
          <div className="stat-card">
            <span className="label">Teachers</span>
            <span className="value">{teachers.length}</span>
          </div>
        )}
        {stats.pendingSync > 0 && (
          <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
            <span className="label">Pending Sync</span>
            <span className="value">{stats.pendingSync}</span>
            <span className="change">Will sync when online</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Quick Links</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/scores"  className="btn btn-primary">✏️ Enter Scores</Link>
          <Link to="/reports" className="btn btn-ghost">📄 View Reports</Link>
          {isAdmin && <Link to="/students" className="btn btn-ghost">👥 Manage Students</Link>}
          {isAdmin && <Link to="/teachers" className="btn btn-ghost">👨‍🏫 Manage Teachers</Link>}
        </div>
      </div>

      {recentActivity.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
          </div>
          {recentActivity.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '1.3rem' }}>{a.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{a.label}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-lt)' }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
