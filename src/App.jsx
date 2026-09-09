import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';
import BugReportModal from './components/BugReportModal';
import Snowfall from './components/Snowfall';

// Custom wrapper for private routes
function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

// Custom wrapper for admin-only routes
function AdminRoute({ children }) {
  const { currentUser, isAdmin } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Subtle, gentle background snowfall */}
        <Snowfall />

        {/* Global Floating Bug Report Tab & Modal */}
        <BugReportModal />

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
