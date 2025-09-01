import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectHasRole } from '../store/slices/authSlice';

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
  </div>
);

// ProtectedRoute component
const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const currentUser = useSelector(selectCurrentUser);
  const hasRequiredRole = useSelector(selectHasRole(requiredRole));
  const isAuthenticated = !!currentUser;

  // If still loading, show spinner
  if (currentUser === undefined) {
    return <LoadingSpinner />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If specific role is required and user doesn't have it
  if (requiredRole && !hasRequiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // If everything is fine, render children
  return children;
};

export default ProtectedRoute;