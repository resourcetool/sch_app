// src/App.jsx
//
// Changes:
// - Added /assessments route pointing to the new AssessmentDeadlines page (admin-only).
// - isSuperAdmin now correctly uses the updated multi-email helper.
// - All existing routes preserved.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }             from './contexts/AuthContext';
import { SchoolProvider }                    from './contexts/SchoolContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { isSuperAdmin }                      from './services/superAdminService';
import Layout                                from './components/layout/Layout';
import Login                                 from './pages/Login';
import Register                              from './pages/Register';
import RequestAccess                         from './pages/RequestAccess';
import Dashboard                             from './pages/Dashboard';
import Students                              from './pages/Students';
import Teachers                              from './pages/Teachers';
import Classes                               from './pages/Classes';
import Subjects                              from './pages/Subjects';
import Scores                                from './pages/Scores';
import Reports                               from './pages/Reports';
import Promotion                             from './pages/Promotion';
import Analytics                             from './pages/Analytics';
import Backup                                from './pages/Backup';
import Settings                              from './pages/Settings';
import SuperAdmin                            from './pages/SuperAdmin';
import SubscriptionExpired                   from './pages/SubscriptionExpired';
import AssessmentDeadlines                   from './pages/AssessmentDeadlines';

function SubscriptionGuard({ children }) {
  const { status, loading } = useSubscription();
  const { userProfile }     = useAuth();
  if (loading) return null;
  if (isSuperAdmin(userProfile?.email)) return children;
  if (status === 'expired' || status === 'suspended') return <SubscriptionExpired />;
  return children;
}

function ProtectedRoute({ children, adminOnly }) {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

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

function AppRoutes() {
  const { user, userProfile } = useAuth();
  const isSA = user && isSuperAdmin(userProfile?.email);

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

  if (isSA) {
    return (
      <Routes>
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/login"      element={<Navigate to="/superadmin" replace />} />
        <Route path="*"           element={<Navigate to="/superadmin" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login"          element={<Navigate to="/dashboard" replace />} />
      <Route path="/register"       element={<Navigate to="/dashboard" replace />} />
      <Route path="/request-access" element={<RequestAccess />} />

      <Route element={<SchoolApp />}>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/students"     element={<Students />} />
        <Route path="/teachers"     element={<Teachers />} />
        <Route path="/classes"      element={<Classes />} />
        <Route path="/subjects"     element={<Subjects />} />
        <Route path="/scores"       element={<Scores />} />
        <Route path="/reports"      element={<Reports />} />
        <Route path="/promotion"    element={<ProtectedRoute adminOnly><Promotion /></ProtectedRoute>} />
        <Route path="/analytics"    element={<Analytics />} />
        <Route path="/backup"       element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
        <Route path="/settings"     element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        <Route path="/assessments"  element={<ProtectedRoute adminOnly><AssessmentDeadlines /></ProtectedRoute>} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
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
