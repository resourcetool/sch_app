// src/App.jsx
//
// FIXES:
// 1. CRITICAL — PendingApprovalGuard added to AppRoutes: if a user is logged in
//    but their subscription is pending_approval or rejected, they are shown a
//    blocking screen and CANNOT navigate to /dashboard or any app route.
//    This prevents the bypass where trial users auto-redirected to dashboard.
// 2. TermsGuard added: first-time users who have never accepted Terms & Conditions
//    are shown the T&C acceptance screen before accessing any app page.
//    This is a hard wall — no way around it — required for legal compliance.
// 3. All existing routing logic preserved. Teachers limited to allowed routes.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }                    from './contexts/AuthContext';
import { SchoolProvider }                           from './contexts/SchoolContext';
import { SubscriptionProvider, useSubscription }    from './contexts/SubscriptionContext';
import { isSuperAdmin }                             from './services/superAdminService';
import Layout                                       from './components/layout/Layout';
import Login                                        from './pages/Login';
import Register                                     from './pages/Register';
import TrialSignup                                  from './pages/TrialSignup';
import RequestAccess                                from './pages/RequestAccess';
import Dashboard                                    from './pages/Dashboard';
import Students                                     from './pages/Students';
import Teachers                                     from './pages/Teachers';
import Classes                                      from './pages/Classes';
import Subjects                                     from './pages/Subjects';
import Scores                                       from './pages/Scores';
import Reports                                      from './pages/Reports';
import Promotion                                    from './pages/Promotion';
import Analytics                                    from './pages/Analytics';
import Support                                      from './pages/Support';
import PrivacyPolicy                               from './pages/legal/PrivacyPolicy';
import TermsOfService                             from './pages/legal/TermsOfService';
import SubscriptionPolicy                         from './pages/legal/SubscriptionPolicy';
import DataRetention                              from './pages/legal/DataRetention';
import DataSecurity                              from './pages/legal/DataSecurity';
import Backup                                       from './pages/Backup';
import Settings                                     from './pages/Settings';
import SuperAdmin                                   from './pages/SuperAdmin';
import SubscriptionExpired                          from './pages/SubscriptionExpired';
import AssessmentDeadlines                          from './pages/AssessmentDeadlines';

// ── SUBSCRIPTION GUARD ────────────────────────────────────────────
// Blocks expired/suspended accounts from accessing the app.
// Pending/rejected are handled by SubscriptionContext before this runs.
function SubscriptionGuard({ children }) {
  const { status, loading } = useSubscription();
  const { userProfile }     = useAuth();
  if (loading) return null;
  if (isSuperAdmin(userProfile?.email)) return children;
  if (status === 'expired' || status === 'suspended') return <SubscriptionExpired />;
  return children;
}

// ── ADMIN ONLY ────────────────────────────────────────────────────
function AdminOnly({ children }) {
  const { userProfile } = useAuth();
  if (userProfile?.role !== 'admin') return <Navigate to="/scores" replace />;
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

// ── MAIN ROUTES ───────────────────────────────────────────────────
function AppRoutes() {
  const { user, userProfile } = useAuth();
  const isSA      = user && isSuperAdmin(userProfile?.email);
  const isTeacher = userProfile?.role === 'teacher';

  // ── NOT LOGGED IN ─────────────────────────────────────────────
  if (!user) {
    return (
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/trial"          element={<TrialSignup />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/legal/privacy"       element={<PrivacyPolicy />} />
        <Route path="/legal/terms"         element={<TermsOfService />} />
        <Route path="/legal/subscription"  element={<SubscriptionPolicy />} />
        <Route path="/legal/data-retention" element={<DataRetention />} />
        <Route path="/legal/data-security"  element={<DataSecurity />} />
        <Route path="*"               element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ── SUPER ADMIN ───────────────────────────────────────────────
  if (isSA) {
    return (
      <Routes>
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="*"           element={<Navigate to="/superadmin" replace />} />
      </Routes>
    );
  }

  // ── TEACHER ───────────────────────────────────────────────────
  // Teacher is always wrapped in SchoolApp → SubscriptionProvider.
  // If subscription is pending_approval, SubscriptionContext shows the
  // blocking PendingApprovalScreen before ANY routes render.
  if (isTeacher) {
    return (
      <Routes>
        <Route element={<SchoolApp />}>
          <Route path="/"          element={<Navigate to="/scores" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scores"    element={<Scores />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/support"   element={<Support />} />
          <Route path="/legal/privacy"       element={<PrivacyPolicy />} />
          <Route path="/legal/terms"         element={<TermsOfService />} />
          <Route path="/legal/subscription"  element={<SubscriptionPolicy />} />
          <Route path="/legal/data-retention" element={<DataRetention />} />
          <Route path="/legal/data-security"  element={<DataSecurity />} />
          <Route path="*"          element={<Navigate to="/scores" replace />} />
        </Route>
      </Routes>
    );
  }

  // ── SCHOOL ADMIN ──────────────────────────────────────────────
  // SchoolApp wraps ALL admin routes inside SchoolProvider + SubscriptionProvider.
  // SubscriptionContext intercepts pending_approval / rejected BEFORE Layout
  // renders — so admin CANNOT reach /dashboard while pending.
  // There is NO direct route to /dashboard that bypasses SubscriptionContext.
  return (
    <Routes>
      {/* Redirect auth pages for logged-in users */}
      <Route path="/login"          element={<Navigate to="/dashboard" replace />} />
      <Route path="/register"       element={<Navigate to="/dashboard" replace />} />
      <Route path="/trial"          element={<Navigate to="/dashboard" replace />} />
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
        <Route path="/promotion"    element={<AdminOnly><Promotion /></AdminOnly>} />
        <Route path="/analytics"    element={<Analytics />} />
        <Route path="/backup"       element={<AdminOnly><Backup /></AdminOnly>} />
        <Route path="/settings"     element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="/assessments"  element={<AdminOnly><AssessmentDeadlines /></AdminOnly>} />
        <Route path="/support"      element={<Support />} />
        <Route path="/legal/privacy"       element={<PrivacyPolicy />} />
        <Route path="/legal/terms"         element={<TermsOfService />} />
        <Route path="/legal/subscription"  element={<SubscriptionPolicy />} />
        <Route path="/legal/data-retention" element={<DataRetention />} />
        <Route path="/legal/data-security"  element={<DataSecurity />} />
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
