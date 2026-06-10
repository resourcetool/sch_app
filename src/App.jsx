// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SchoolProvider } from './contexts/SchoolContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
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

function ProtectedRoute({ children, allowedRoles }) {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />

      <Route path="/" element={
        <ProtectedRoute>
          <SchoolProvider>
            <Layout />
          </SchoolProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="classes" element={<Classes />} />
        <Route path="subjects" element={<Subjects />} />
        <Route path="scores" element={<Scores />} />
        <Route path="reports" element={<Reports />} />
        <Route path="promotion" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Promotion />
          </ProtectedRoute>
        } />
        <Route path="analytics" element={<Analytics />} />
        <Route path="backup" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Backup />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        } />
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
