import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { VolunteerDashboard } from './views/VolunteerDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { LoginView } from './views/LoginView';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { useCampaign } from './context/CampaignContext';
import { useAuth } from './context/AuthContext';
import './index.css';

function App() {
  const { isAuthenticated, role } = useAuth();

  // Custom Home component to redirect based on role
  const HomeRedirect = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'DEVELOPER') return <Navigate to="/admin" replace />;
    return <Navigate to="/volunteer" replace />;
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />

      {/* Protected Routes inside Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomeRedirect />} />

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DEVELOPER']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Volunteer Routes */}
        <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'VOLUNTEER']} />}>
          <Route path="/volunteer" element={<VolunteerDashboard />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
