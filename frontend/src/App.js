import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { useSelector } from 'react-redux';
import { ThemeProvider } from './utils/themeUtils';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LeaveRequest from './pages/LeaveRequest';
import LeaveRequests from './pages/LeaveRequests';
import LeaveApprovals from './pages/LeaveApprovals';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

// Main Layout Component
const Layout = ({ children }) => {
  const { currentUser } = useSelector(state => state.auth);

  if (!currentUser) {
    return children;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-0 md:ml-64">
        <Navbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
};

// App Component
function App() {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <Router>
          <div className="App">
            <Layout>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />

                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />

                <Route path="/leave-request" element={
                  <ProtectedRoute>
                    <LeaveRequest />
                  </ProtectedRoute>
                } />

                <Route path="/leave-requests" element={
                  <ProtectedRoute>
                    <LeaveRequests />
                  </ProtectedRoute>
                } />

                <Route path="/approvals" element={
                  <ProtectedRoute>
                    <LeaveApprovals />
                  </ProtectedRoute>
                } />

                <Route path="/users" element={
                  <ProtectedRoute requiredRole={['manager', 'admin']}>
                    <Users />
                  </ProtectedRoute>
                } />

                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />

                <Route path="/reports" element={
                  <ProtectedRoute requiredRole={['manager', 'admin']}>
                    <Reports />
                  </ProtectedRoute>
                } />

                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />

                {/* Default redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </div>
        </Router>
      </Provider>
    </ThemeProvider>
  );
}

export default App;