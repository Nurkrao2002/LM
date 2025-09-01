import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  selectCurrentUser,
  selectAuthLoading,
  logoutFromLocal
} from '../store/slices/authSlice';
import {
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);
  const isLoading = useSelector(selectAuthLoading);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Mock notifications - in real app, this would come from Redux
  useEffect(() => {
    // Simulate fetching notifications
    setNotifications([
      { id: 1, title: 'New Leave Request', message: 'You have a new leave request to review', unread: true },
      { id: 2, title: 'Leave Approved', message: 'Your annual leave has been approved', unread: false },
    ]);
  }, []);

  const handleLogout = () => {
    dispatch(logoutFromLocal());
    navigate('/login');
  };

  const unreadNotifications = notifications.filter(n => n.unread).length;

  if (isLoading) {
    return (
      <nav className="bg-white shadow-lg">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3">
              <img
                src="/pigeon_srisys_logo-removebg.png"
                alt="Pigeon SriSys Logo"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  e.target.style.display = 'none';
                  const fallbackDiv = document.createElement('div');
                  fallbackDiv.className = 'bg-blue-600 rounded-lg p-2';
                  fallbackDiv.innerHTML = `<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`;
                  e.target.parentNode.insertBefore(fallbackDiv, e.target.nextSibling);
                }}
              />
              <div className="hidden sm:flex flex-col">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Pigeon
                </h1>
                <p className="text-xs text-gray-600">
                  Leave Management
                </p>
              </div>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {/* Notifications */}
              <div className="relative">
                <button className="relative bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                  <Bell className="h-6 w-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
                  )}
                </button>
              </div>

              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                    id="user-menu-button"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {currentUser?.firstName?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      </div>
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {currentUser?.firstName} {currentUser?.lastName}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {currentUser?.role}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                </div>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Your Profile
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t">
            <div className="flex items-center px-3 py-2">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {currentUser?.firstName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">
                  {currentUser?.firstName} {currentUser?.lastName}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {currentUser?.role}
                </div>
              </div>
            </div>
            <Link
              to="/profile"
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <User className="mr-2 h-4 w-4" />
              Your Profile
            </Link>
            <Link
              to="/settings"
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;