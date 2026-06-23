// src/components/layout/Layout.jsx
//
// Changes:
// - Added "Assessment Deadlines" nav item (admin-only) under the Results section.
// - All existing functionality preserved.

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth }         from '../../contexts/AuthContext';
import { useSchool }       from '../../contexts/SchoolContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { onSyncStatusChange } from '../../services/syncService';

// Full nav for admins
const ADMIN_NAV = [
  { section: 'Overview' },
  { to: '/dashboard',   icon: '📊', label: 'Dashboard'  },
  { section: 'Academic' },
  { to: '/students',    icon: '👥', label: 'Students'   },
  { to: '/teachers',    icon: '👨‍🏫', label: 'Teachers'   },
  { to: '/classes',     icon: '🏫', label: 'Classes'    },
  { to: '/subjects',    icon: '📚', label: 'Subjects'   },
  { to: '/scores',      icon: '✏️', label: 'Score Entry' },
  { section: 'Results' },
  { to: '/reports',     icon: '📄', label: 'Reports'    },
  { to: '/promotion',   icon: '🚀', label: 'Promotion'  },
  { to: '/analytics',   icon: '📈', label: 'Analytics', feature: 'analytics' },
  { section: 'Admin' },
  { to: '/assessments', icon: '📅', label: 'Deadlines'  },
  { to: '/backup',      icon: '💾', label: 'Backup',    feature: 'backup' },
  { to: '/settings',    icon: '⚙️', label: 'Settings'   },
  { section: 'Help' },
  { to: '/support',     icon: '🆘', label: 'Help & Support' },
];

// Restricted nav for teachers
const TEACHER_NAV = [
  { section: 'My Work' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard'  },
  { to: '/scores',    icon: '✏️', label: 'Score Entry' },
  { to: '/reports',   icon: '📄', label: 'Reports'    },
  { to: '/analytics', icon: '📈', label: 'Analytics'  },
  { section: 'Help' },
  { to: '/support',   icon: '🆘', label: 'Help & Support' },
];

const NAV = ADMIN_NAV; // default; actual selection done below

export default function Layout() {
  const { userProfile, logout } = useAuth();
  const { school }              = useSchool();
  const { plan, status, days, can } = useSubscription();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus);
    return unsub;
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const isAdmin   = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';
  const NAV_ITEMS = isTeacher ? TEACHER_NAV : ADMIN_NAV;

  const syncInfo = {
    synced:  { label: '● Synced',          cls: 'synced'  },
    syncing: { label: '↻ Syncing…',        cls: 'syncing' },
    offline: { label: '📴 Offline',         cls: 'offline' },
    error:   { label: '⚠ Sync Error',      cls: 'offline' },
    online:  { label: '↻ Syncing…',        cls: 'syncing' },
  };
  const sync = syncInfo[syncStatus] || syncInfo.synced;

  // Show a tooltip/title that explains the offline state
  const syncTitle = {
    synced:  'All data saved to database',
    syncing: 'Saving data to database…',
    offline: 'No internet — data saved locally, will sync when reconnected',
    error:   'Sync error — will retry automatically when connection improves',
    online:  'Back online — syncing queued data…',
  }[syncStatus] || '';

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99, display: 'none' }}
          className="mobile-overlay"
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2>{school?.name || 'SchoolMS'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ color: 'rgba(255,255,255,.45)', fontSize: '.72rem' }}>
                  {school?.code || ''} · {userProfile?.role}
                </span>
                {plan && (
                  <span style={{
                    background: plan.id === 'premium' ? '#e94560' : plan.id === 'pro' ? '#2980b9' : '#64748b',
                    color: '#fff', fontSize: '.6rem', fontWeight: 700,
                    padding: '1px 6px', borderRadius: 8, textTransform: 'uppercase',
                  }}>
                    {plan.name}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
                fontSize: '1.2rem', cursor: 'pointer', display: 'none',
              }}
              className="sidebar-close"
            >✕</button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="sidebar-section">
                  <span className="sidebar-section-label">{item.section}</span>
                </div>
              );
            }
            if (item.adminOnly && !isAdmin && !isTeacher) return null;
            const locked = item.feature && !can(item.feature);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}${locked ? ' locked' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
                {locked && <span style={{ marginLeft: 'auto', fontSize: '.65rem', opacity: .6 }}>⭐</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="sidebar-bottom">
          {status && status !== 'active' && (
            <div style={{
              background: status === 'expiring' ? 'rgba(245,166,35,.2)' : 'rgba(233,69,96,.2)',
              borderRadius: 8, padding: '7px 10px', marginBottom: 8, fontSize: '.72rem',
              color: status === 'expiring' ? '#fbbf24' : '#ff8fa3',
            }}>
              {status === 'expiring'
                ? `⏰ ${days} days left — renew soon`
                : '🔒 Subscription expired'}
            </div>
          )}
          <div style={{ padding: '0 4px 10px', lineHeight: 1.6 }}>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '.8rem', fontWeight: 600 }}>
              {userProfile?.firstName} {userProfile?.lastName}
            </div>
            <div style={{ color: 'rgba(255,255,255,.35)', fontSize: '.72rem', wordBreak: 'break-all' }}>
              {userProfile?.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{ width: '100%', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)' }}
          >
            <span className="icon">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button
            onClick={() => setMobileOpen(true)}
            className="mobile-menu-btn"
            style={{
              background: 'none', border: 'none', fontSize: '1.3rem',
              cursor: 'pointer', color: 'var(--navy)', display: 'none', marginRight: 12,
            }}
          >☰</button>
          <span className="topbar-title">{school?.name || 'School Management'}</span>
          <div className="topbar-right">
            <span className={`sync-badge ${sync.cls}`} title={syncTitle}>{sync.label}</span>
          </div>
        </header>

        {/* Subscription warning banners */}
        {status === 'expiring' && (
          <div style={{
            background: '#fffbeb', borderBottom: '2px solid #f59e0b',
            padding: '8px 20px', fontSize: '.82rem', fontWeight: 600,
            color: '#92400e', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>⏰</span>
            <span>
              Your subscription expires in <strong>{days} day{days !== 1 ? 's' : ''}</strong>.
              Contact 024XXXXXXX to renew.
            </span>
            <a
              href="https://wa.me/233240000000" target="_blank" rel="noreferrer"
              style={{
                marginLeft: 'auto', background: '#f59e0b', color: '#fff',
                padding: '3px 12px', borderRadius: 20, fontSize: '.76rem',
                fontWeight: 700, textDecoration: 'none',
              }}
            >
              Renew →
            </a>
          </div>
        )}
        {status === 'grace' && (
          <div style={{
            background: '#fef2f2', borderBottom: '2px solid #ef4444',
            padding: '8px 20px', fontSize: '.82rem', fontWeight: 600,
            color: '#991b1b', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>🔒</span>
            <span>Subscription expired — system is in read-only mode.</span>
            <a
              href="https://wa.me/233240000000" target="_blank" rel="noreferrer"
              style={{
                marginLeft: 'auto', background: '#ef4444', color: '#fff',
                padding: '3px 12px', borderRadius: 20, fontSize: '.76rem',
                fontWeight: 700, textDecoration: 'none',
              }}
            >
              Contact Us →
            </a>
          </div>
        )}

        <main className="page-content">
          {/* Offline banner — shown whenever connectivity is lost */}
          {(syncStatus === 'offline' || syncStatus === 'error') && (
            <div style={{
              background: syncStatus === 'error' ? '#fff3e0' : '#e3f2fd',
              border: `1px solid ${syncStatus === 'error' ? '#ff9800' : '#90caf9'}`,
              borderRadius: 8, padding: '8px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: '.8rem',
            }}>
              <span style={{ fontSize: '1rem' }}>{syncStatus === 'error' ? '⚠️' : '📴'}</span>
              <div>
                {syncStatus === 'offline'
                  ? <><strong>You\'re offline.</strong> Data is saved locally and will sync automatically when you reconnect. You can keep working.</>
                  : <><strong>Sync error.</strong> Your last save may not have reached the database. We\'ll retry automatically. If this persists, contact support.</>
                }
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
