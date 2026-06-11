// src/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { onSyncStatusChange } from '../../services/syncService';
import { isSuperAdmin } from '../../services/superAdminService';
import SubscriptionBanner from '../common/SubscriptionBanner';

const NAV = [
  { section: 'Overview' },
  { to: '/',           icon: '📊', label: 'Dashboard'   },
  { section: 'Academic' },
  { to: '/students',   icon: '👥', label: 'Students'    },
  { to: '/teachers',   icon: '👨‍🏫', label: 'Teachers'    },
  { to: '/classes',    icon: '🏫', label: 'Classes'     },
  { to: '/subjects',   icon: '📚', label: 'Subjects'    },
  { to: '/scores',     icon: '✏️', label: 'Score Entry'  },
  { section: 'Reports & Ops' },
  { to: '/reports',    icon: '📄', label: 'Reports'     },
  { to: '/promotion',  icon: '🚀', label: 'Promotion',  adminOnly: true },
  { to: '/analytics',  icon: '📈', label: 'Analytics',  feature: 'analytics' },
  { section: 'Admin' },
  { to: '/backup',     icon: '💾', label: 'Backup',     adminOnly: true, feature: 'backup' },
  { to: '/settings',   icon: '⚙️', label: 'Settings',   adminOnly: true },
];

export default function Layout() {
  const { userProfile, logout } = useAuth();
  const { school } = useSchool();
  const { plan, status, days, can } = useSubscription();
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

  const syncLabel = {
    synced: '● Synced', syncing: '↻ Syncing...', offline: '⚠ Offline', error: '✕ Error', online: '↻ Online'
  };

  const isAdmin = userProfile?.role === 'admin';
  const isSA = isSuperAdmin(userProfile?.email);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>{school?.name || 'SchoolMS'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,.45)', fontSize: '.72rem' }}>{school?.code} · {userProfile?.role}</span>
            {plan && (
              <span style={{
                background: plan.id === 'premium' ? '#e94560' : plan.id === 'pro' ? '#2980b9' : '#8898aa',
                color: '#fff', fontSize: '.62rem', fontWeight: 700,
                padding: '1px 6px', borderRadius: 8
              }}>{plan.badge}</span>
            )}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section"><span className="sidebar-section-label">{item.section}</span></div>;
            }
            if (item.adminOnly && !isAdmin) return null;

            const locked = item.feature && !can(item.feature);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                style={locked ? { opacity: .5 } : {}}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
                {locked && <span style={{ marginLeft: 'auto', fontSize: '.65rem', opacity: .7 }}>⭐</span>}
              </NavLink>
            );
          })}

          {/* Super Admin link */}
          {isSA && (
            <>
              <div className="sidebar-section"><span className="sidebar-section-label">Super Admin</span></div>
              <NavLink to="/superadmin" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                style={{ background: 'rgba(233,69,96,.15)' }}>
                <span className="icon">⚡</span> Super Admin
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: '.73rem', padding: '0 4px 8px', lineHeight: 1.5 }}>
            {userProfile?.firstName} {userProfile?.lastName}<br />
            <span style={{ opacity: .6 }}>{userProfile?.email}</span>
          </div>
          {/* Subscription status in sidebar */}
          {status && status !== 'active' && (
            <div style={{ background: 'rgba(233,69,96,.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: '.72rem', color: '#ff8fa3' }}>
              {status === 'expiring' ? `⏰ ${days} days left` : status === 'grace' ? '🔒 Expired' : `⚠ ${status}`}
            </div>
          )}
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

        {/* Subscription banner — shows when trial/expiring/expired */}
        <SubscriptionBanner />

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
