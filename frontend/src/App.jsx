import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './utils/clientLogger';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import HeadDashboard from './pages/HeadDashboard';
import AdminOfficerDashboard from './pages/AdminOfficerDashboard';
import AssistantDashboard from './pages/AssistantDashboard';
import Layout from './components/Layout';
import Login from './pages/Login';
import NotificationsPage from './pages/NotificationsPage';
import BugReportPage from './pages/BugReportPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
};

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            !user ? <Navigate to="/login" replace /> :
              user.role === 'ADMIN' ? <Navigate to="/admin" replace /> :
                user.role === 'ADMIN_OFFICER' ? <Navigate to="/admin-officer" replace /> :
                  user.role === 'HEAD' ? <Navigate to="/head" replace /> :
                    <Navigate to="/assistant" replace />
          }
        />

        {/* Admin Routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Admin Officer Routes */}
        <Route path="/admin-officer/*" element={
          <ProtectedRoute allowedRoles={['ADMIN_OFFICER']}>
            <AdminOfficerDashboard />
          </ProtectedRoute>
        } />

        {/* Head Routes */}
        <Route path="/head/*" element={
          <ProtectedRoute allowedRoles={['HEAD']}>
            <HeadDashboard />
          </ProtectedRoute>
        } />

        {/* Assistant Routes */}
        <Route path="/assistant/*" element={
          <ProtectedRoute allowedRoles={['ASSISTANT']}>
            <AssistantDashboard />
          </ProtectedRoute>
        } />

        {/* Notifications — all roles */}
        <Route path="/notifications" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'ADMIN_OFFICER', 'HEAD', 'ASSISTANT']}>
            <NotificationsPage />
          </ProtectedRoute>
        } />

        {/* Bug Reports — all roles */}
        <Route path="/report-bug" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'ADMIN_OFFICER', 'HEAD', 'ASSISTANT']}>
            <BugReportPage />
          </ProtectedRoute>
        } />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
