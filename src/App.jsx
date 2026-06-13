// src/App.jsx
// CHANGED: Added /assessment-control route, fixed all navigation paths,
//          super admin routing fully separated from school app

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SchoolProvider } from './contexts/SchoolContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { isSuperAdmin } from './services/superAdminService';

import Layout           from './components/layout/Layout';
import Login            from './pages/Login';
import Register         from './pages/Register';
import RequestAccess    from './pages/RequestAccess';
import Dashboard        from './pages/Dashboard';
import Students         from './pages/Students';
import Teachers         from './pages/Teachers';
import Classes          from './pages/Classes';
import Subjects         from './pages/Subjects';
import Scores           from './pages/Scores';
import Reports          from './pages/Reports';
import Promotion        from './pages/Promotion';
import Analytics        from './pages/Analytics';
import Backup           from './pages/Backup';
import Settings         from './pages/Settings';
import AssessmentControl from './pages/AssessmentControl';
import SuperAdmin       from './pages/SuperAdmin';
import SubscriptionExpired from './pages/SubscriptionExpired';

// ── GUARDS ────────────────────────────────────────────────────────

function SubscriptionGuard({ children }) {
  const { status, loading } = useSubscription();
  const { userProfile }     = useAuth();
  if (loading) return null;
  if (isSuperAdmin(userProfile?.email)) return children;
  if (status === 'expired' || status === 'suspended') return <SubscriptionExpired />;
  return children;
}

function AdminOnly({ children }) {
  const { userProfile } = useAuth();
  if (userProfile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// ── SCHOOL APP WRAPPER ────────────────────────────────────────────
function SchoolApp() {
  return (
    <SchoolProvider>
      <SubscriptionProvider>
        <SubscriptionGuard>
          <Layout />
        </SubscriptionGuard>
      </SubscriptionProvider>
    </SchoolProvider>
  );
}

// ── ROUTE TREE ────────────────────────────────────────────────────
function AppRoutes() {
  const { user, userProfile } = useAuth();
  const isSA = user && isSuperAdmin(userProfile?.email);

  // Not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="*"               element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Super admin — completely isolated route tree
  if (isSA) {
    return (
      <Routes>
        <Route path="/superadmin"     element={<SuperAdmin />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="*"               element={<Navigate to="/superadmin" replace />} />
      </Routes>
    );
  }

  // Regular school user (admin or teacher)
  return (
    <Routes>
      <Route path="/login"          element={<Navigate to="/dashboard" replace />} />
      <Route path="/register"       element={<Navigate to="/dashboard" replace />} />
      <Route path="/request-access" element={<RequestAccess />} />

      <Route element={<SchoolApp />}>
        <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"           element={<Dashboard />} />
        <Route path="/students"            element={<Students />} />
        <Route path="/teachers"            element={<Teachers />} />
        <Route path="/classes"             element={<Classes />} />
        <Route path="/subjects"            element={<Subjects />} />
        <Route path="/scores"              element={<Scores />} />
        <Route path="/reports"             element={<Reports />} />
        <Route path="/analytics"           element={<Analytics />} />
        <Route path="/promotion"           element={<AdminOnly><Promotion /></AdminOnly>} />
        <Route path="/assessment-control"  element={<AdminOnly><AssessmentControl /></AdminOnly>} />
        <Route path="/backup"              element={<AdminOnly><Backup /></AdminOnly>} />
        <Route path="/settings"            element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="*"                    element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
