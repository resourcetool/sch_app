// src/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { onSyncStatusChange } from '../../services/syncService';

const NAV = [
  { section: 'Overview' },
  { to: '/',           icon: '📊', label: 'Dashboard'  },
  { section: 'Academic' },
  { to: '/students',   icon: '👥', label: 'Students'   },
  { to: '/teachers',   icon: '👨‍🏫', label: 'Teachers'   },
  { to: '/classes',    icon: '🏫', label: 'Classes'    },
  { to: '/subjects',   icon: '📚', label: 'Subjects'   },
  { to: '/scores',     icon: '✏️', label: 'Score Entry' },
  { section: 'Reports & Ops' },
  { to: '/reports',    icon: '📄', label: 'Reports'    },
  { to: '/promotion',  icon: '🚀', label: 'Promotion'  },
  { to: '/analytics',  icon: '📈', label: 'Analytics'  },
  { section: 'Admin' },
  { to: '/backup',     icon: '💾', label: 'Backup'     },
  { to: '/settings',   icon: '⚙️', label: 'Settings'   }
];

export default function Layout() {
  const { userProfile, logout } = useAuth();
  const { school } = useSchool();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState(navigator.onLine ? 'synced' : 'offline');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { unsub(); clearInterval(timer); };
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const syncLabel = { synced: '● Synced', syncing: '↻ Syncing...', offline: '⚠ Offline', error: '✕ Sync Error', online: '↻ Online' };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>{school?.name || 'SchoolMS'}</h2>
          <p>{school?.code || ''} · {userProfile?.role}</p>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section"><span className="sidebar-section-label">{item.section}</span></div>;
            }
            // Role-based restriction: teachers can't access promotion, backup, settings
            if (userProfile?.role === 'teacher' && ['/promotion', '/backup', '/settings'].includes(item.to)) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: '.75rem', padding: '0 4px 8px' }}>
            {userProfile?.firstName} {userProfile?.lastName}<br />
            <span style={{ opacity: .6 }}>{userProfile?.email}</span>
          </div>
          <button onClick={handleLogout} className="sidebar-link" style={{ width: '100%', border: 'none', cursor: 'pointer' }}>
            <span className="icon">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{school?.name}</span>
          <div className="topbar-right">
            <span style={{ fontSize: '.78rem', color: 'var(--text-lt)' }}>
              {currentTime.toLocaleDateString('en-GH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <span className={`sync-badge ${syncStatus === 'synced' ? 'synced' : syncStatus === 'offline' ? 'offline' : 'syncing'}`}>
              {syncLabel[syncStatus] || '● Ready'}
            </span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
