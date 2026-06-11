// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SchoolProvider } from './contexts/SchoolContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { isSuperAdmin } from './services/superAdminService';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import RequestAccess from './pages/RequestAccess';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Scores from './pages/Scores';
import Reports from './pages/Reports';
import Promotion from './pages/Promotion';
import Analytics from './pages/Analytics';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import SuperAdmin from './pages/SuperAdmin';
import SubscriptionExpired from './pages/SubscriptionExpired';

// Blocks access when subscription is expired/suspended
// Super admin bypasses this since they need access to their own school too
function SubscriptionGuard({ children }) {
  const { status, loading } = useSubscription();
  const { userProfile } = useAuth();

  if (loading) return null;

  // Super admin always gets through
  if (isSuperAdmin(userProfile?.email)) return children;

  // Block on expired or suspended
  if (status === 'expired' || status === 'suspended') {
    return <SubscriptionExpired />;
  }

  return children;
}

function ProtectedRoute({ children, adminOnly }) {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && userProfile?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin(userProfile?.email)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
      <Route path="/request-access" element={<RequestAccess />} />

      {/* Super Admin — standalone, no school context needed */}
      <Route path="/superadmin" element={
        <SuperAdminRoute><SuperAdmin /></SuperAdminRoute>
      } />

      {/* Protected school routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <SchoolProvider>
            <SubscriptionProvider>
              <SubscriptionGuard>
                <Layout />
              </SubscriptionGuard>
            </SubscriptionProvider>
          </SchoolProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="students"  element={<Students />} />
        <Route path="teachers"  element={<Teachers />} />
        <Route path="classes"   element={<Classes />} />
        <Route path="subjects"  element={<Subjects />} />
        <Route path="scores"    element={<Scores />} />
        <Route path="reports"   element={<Reports />} />
        <Route path="promotion" element={<ProtectedRoute adminOnly><Promotion /></ProtectedRoute>} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="backup"    element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
        <Route path="settings"  element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
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
