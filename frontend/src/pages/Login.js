import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login, clearError } from '../store/slices/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isLoading, error } = useSelector(state => state.auth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [formErrors, setFormErrors] = useState({});

  // Clear any previous errors when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [navigate, location]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Extract only email and password for login
    const { email, password } = formData;
    const resultAction = await dispatch(login({ email, password }));

    if (login.fulfilled.match(resultAction)) {
      // Handle remember me
      if (formData.rememberMe) {
        localStorage.setItem('rememberLogin', 'true');
      }

      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  };

  const handleForgotPassword = () => {
    // Simple alert for now
    alert('Forgot password functionality would be implemented here');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md px-8 py-10">
          <div className="text-center mb-8">
            <img
              src="/pigeon_srisys_logo-removebg.png"
              alt="Company Logo"
              className="h-16 w-16 mx-auto object-contain"
            />
            <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
              Sign in to your account
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Forgot your password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>

              <div className="mt-4 text-center">
                <Link
                  to="/register"
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Create new account
                </Link>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
              </div>
            )}

            {formErrors.email && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="text-sm text-red-700 dark:text-red-400">{formErrors.email}</div>
              </div>
            )}

            {formErrors.password && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="text-sm text-red-700 dark:text-red-400">{formErrors.password}</div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;