// src/pages/Backup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createBackupPackage, exportAsJSON, exportAsExcel,
  exportStudentsAsExcel, previewRestore, executeRestore,
  getBackupSchedule, saveBackupSchedule, shouldRunBackup
} from '../services/backupService';
import { getDBStats } from '../services/indexedDB';

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '.84rem' }}>
      <span style={{ color: 'var(--text-mid)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export default function Backup() {
  const { schoolId, school } = useSchool();
  const { userProfile } = useAuth();
  const [dbStats, setDbStats] = useState({});
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [schedule, setSchedule] = useState({ daily: true, weekly: true, monthly: true });
  const [tab, setTab] = useState('backup');
  const [logs, setLogs] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    loadStats();
    if (schoolId) {
      getBackupSchedule(schoolId).then(s => setSchedule(s));
    }
    // Load local backup log
    const stored = localStorage.getItem(`backup_log_${schoolId}`);
    if (stored) setLogs(JSON.parse(stored));
  }, [schoolId]);

  async function loadStats() {
    const s = await getDBStats();
    setDbStats(s);
  }

  function addLog(action, details) {
    const entry = { action, details, timestamp: Date.now(), adminId: userProfile?.id };
    const updated = [entry, ...logs].slice(0, 50);
    setLogs(updated);
    localStorage.setItem(`backup_log_${schoolId}`, JSON.stringify(updated));
  }

  async function handleManualBackupJSON() {
    setBackupLoading(true);
    try {
      const pkg = await createBackupPackage(schoolId);
      exportAsJSON(pkg, `${school?.code || 'school'}_backup_${new Date().toISOString().split('T')[0]}.json`);
      addLog('Manual Backup (JSON)', `${pkg.metadata.totalRecords} records`);
      // Update last backup time
      const s = { ...schedule, lastBackup: new Date().toISOString() };
      saveBackupSchedule(schoolId, s);
      setSchedule(s);
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleManualBackupExcel() {
    setBackupLoading(true);
    try {
      await exportAsExcel(schoolId, `${school?.code || 'school'}_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      addLog('Manual Backup (Excel)', 'All collections exported');
    } catch (err) {
      alert('Excel export failed: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleStudentsExport() {
    try {
      await exportStudentsAsExcel(schoolId);
      addLog('Students Export (Excel)', '');
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  }

  async function handleRestoreFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreFile(file);
    try {
      const preview = await previewRestore(file);
      setRestorePreview(preview);
    } catch (err) {
      alert('Invalid backup file: ' + err.message);
      setRestorePreview(null);
    }
  }

  async function handleExecuteRestore() {
    if (!restorePreview) return;
    if (!window.confirm(
      `RESTORE CONFIRMATION\n\nThis will import ${restorePreview.metadata?.totalRecords} records into your school.\n\nExisting records with the same IDs will be overwritten.\n\nProceed?`
    )) return;
    setRestoreLoading(true);
    try {
      const log = await executeRestore(restorePreview.pkg, schoolId, userProfile?.id);
      addLog('Restore', `${Object.values(log.details).reduce((s, v) => s + v, 0)} records restored`);
      alert('Restore completed successfully!');
      setRestorePreview(null);
      setRestoreFile(null);
      await loadStats();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoreLoading(false);
    }
  }

  function handleScheduleChange(key, val) {
    const updated = { ...schedule, [key]: val };
    setSchedule(updated);
    saveBackupSchedule(schoolId, updated);
  }

  const lastBackupDate = schedule.lastBackup
    ? new Date(schedule.lastBackup).toLocaleString()
    : 'Never';

  return (
    <div>
      <div className="page-header">
        <h1>Backup & Data Recovery</h1>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'backup' ? ' active' : ''}`} onClick={() => setTab('backup')}>Backup</button>
        <button className={`tab${tab === 'restore' ? ' active' : ''}`} onClick={() => setTab('restore')}>Restore</button>
        <button className={`tab${tab === 'export' ? ' active' : ''}`} onClick={() => setTab('export')}>Export</button>
        <button className={`tab${tab === 'schedule' ? ' active' : ''}`} onClick={() => setTab('schedule')}>Schedule</button>
        <button className={`tab${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>Audit Log</button>
      </div>

      {/* ── BACKUP ── */}
      {tab === 'backup' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Database Status</span></div>
            <StatRow label="Students" value={dbStats.students || 0} />
            <StatRow label="Enrollments" value={dbStats.enrollments || 0} />
            <StatRow label="Teachers" value={dbStats.teachers || 0} />
            <StatRow label="Classes" value={dbStats.classes || 0} />
            <StatRow label="Subjects" value={dbStats.subjects || 0} />
            <StatRow label="Scores" value={dbStats.scores || 0} />
            <StatRow label="Results" value={dbStats.results || 0} />
            <StatRow label="Promotions" value={dbStats.promotions || 0} />
            <StatRow label="Analytics" value={dbStats.analytics || 0} />
            <div style={{ marginTop: 14, fontSize: '.78rem', color: 'var(--text-lt)' }}>
              Last backup: {lastBackupDate}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Create Backup</span></div>
            <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 20 }}>
              Download a complete backup of all school data. Store this file in a safe location.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleManualBackupJSON} className="btn btn-primary" disabled={backupLoading}>
                {backupLoading ? 'Creating…' : '💾 Download JSON Backup'}
              </button>
              <button onClick={handleManualBackupExcel} className="btn btn-ghost" disabled={backupLoading}>
                {backupLoading ? 'Creating…' : '📊 Download Excel Backup'}
              </button>
            </div>

            <div className="alert alert-info" style={{ marginTop: 18 }}>
              <strong>JSON backup</strong> is recommended — it preserves all data relationships and can be fully restored. Excel is for viewing/archiving.
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE ── */}
      {tab === 'restore' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Restore from Backup</span></div>

          <div className="alert alert-warning">
            ⚠️ Restoring will import records from the backup file. Existing records with matching IDs will be overwritten. Always create a current backup before restoring.
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              📂 Select Backup File (.json)
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestoreFileSelect} />
            </label>
            {restoreFile && (
              <span style={{ marginLeft: 12, fontSize: '.84rem', color: 'var(--text-mid)' }}>{restoreFile.name}</span>
            )}
          </div>

          {restorePreview && (
            <div>
              <div className="alert alert-success">
                ✓ Valid backup file detected. Backup from: <strong>{restorePreview.pkg.createdAt}</strong>
              </div>

              <h3 style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Restore Preview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 20 }}>
                {Object.entries(restorePreview.metadata?.counts || {}).map(([col, count]) => (
                  <div key={col} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-lt)', textTransform: 'uppercase', fontWeight: 600 }}>{col}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy)' }}>{count}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setRestorePreview(null); setRestoreFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={handleExecuteRestore} className="btn btn-danger" disabled={restoreLoading}>
                  {restoreLoading ? 'Restoring…' : '⚠️ Execute Restore'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPORT ── */}
      {tab === 'export' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Data Export</span></div>
          <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 20 }}>
            Export specific datasets for external use, reporting, or archival.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: '👥 Export Students List (Excel)', action: handleStudentsExport, desc: 'Student names, IDs, guardian info' },
              { label: '📊 Full Database Export (Excel)', action: handleManualBackupExcel, desc: 'All collections in separate sheets' },
              { label: '💾 Full Database Export (JSON)', action: handleManualBackupJSON, desc: 'Complete backup for restore' },
            ].map(item => (
              <div key={item.label} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '.88rem' }}>{item.label}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-lt)', marginBottom: 12 }}>{item.desc}</div>
                <button onClick={item.action} className="btn btn-ghost btn-sm" disabled={backupLoading}>Export</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>MS Access Compatibility</h3>
            <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 12 }}>
              Export data as Excel (.xlsx) for import into Microsoft Access. This is intended for migration and archival only — MS Access should not be used as a live database.
            </p>
            <button onClick={handleManualBackupExcel} className="btn btn-ghost">
              📋 Export for MS Access
            </button>
          </div>
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {tab === 'schedule' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div className="card-header"><span className="card-title">Backup Schedule</span></div>
          <p style={{ fontSize: '.84rem', color: 'var(--text-mid)', marginBottom: 20 }}>
            Configure automatic backup reminders. The system will notify you when a scheduled backup is due.
          </p>

          {[
            { key: 'daily',   label: 'Daily Backup',   desc: 'Reminder every day' },
            { key: 'weekly',  label: 'Weekly Backup',  desc: 'Reminder every 7 days' },
            { key: 'monthly', label: 'Monthly Backup', desc: 'Reminder every 30 days' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{item.label}</div>
                <div style={{ fontSize: '.76rem', color: 'var(--text-lt)' }}>{item.desc}</div>
              </div>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedule[item.key] || false}
                  onChange={e => handleScheduleChange(item.key, e.target.checked)}
                />
              </label>
            </div>
          ))}

          <div style={{ marginTop: 16, fontSize: '.8rem', color: 'var(--text-mid)' }}>
            Last backup: <strong>{lastBackupDate}</strong>
          </div>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            For production deployments, configure server-side automated backups using Firebase scheduled Cloud Functions for true automation.
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'log' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Backup Audit Log</span>
            <button onClick={() => { setLogs([]); localStorage.removeItem(`backup_log_${schoolId}`); }} className="btn btn-ghost btn-sm">Clear</button>
          </div>
          {logs.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>No backup activity logged yet.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Timestamp</th><th>Action</th><th>Details</th><th>Admin</th></tr></thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '.78rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{log.action}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--text-mid)' }}>{log.details}</td>
                      <td className="td-mono" style={{ fontSize: '.75rem' }}>{log.adminId?.substring(0, 10)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
