import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectHasRole } from '../store/slices/authSlice';
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Users,
  BarChart3,
  Bell,
  Settings,
  User
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const currentUser = useSelector(selectCurrentUser);
  const isManager = useSelector(selectHasRole(['manager', 'admin']));
  const userRole = currentUser?.role;

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Leave Request',
      href: '/leave-request',
      icon: FileText,
      show: true,
    },
    {
      name: 'My Requests',
      href: '/leave-requests',
      icon: FileText,
      show: true,
    },
    {
      name: 'Approvals',
      href: '/approvals',
      icon: CheckCircle,
      show: isManager,
    },
    {
      name: 'Users',
      href: '/users',
      icon: Users,
      show: isManager,
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
      show: isManager,
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      show: true,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      show: true,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      show: true,
    },
  ];

  const filteredNavItems = navigationItems.filter(item => item.show);

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-gray-800">
      <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center justify-center flex-shrink-0 px-4">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Pigeon OffSync
            </span>
          </div>


          {/* Navigation */}
          <nav className="mt-8 flex-1 px-2 bg-white">
            <ul className="space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-gray-100 text-gray-900 border-r-2 border-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 flex-shrink-0 h-5 w-5 ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                      />
                      {item.name}
                      {item.name === 'Approvals' && (
                        <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                          3
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Quick Stats */}
        {userRole && (
          <div className="flex-shrink-0 flex bg-gray-50 p-4">
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Stats
              </h4>
              <dl className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-gray-500">Pending Requests</dt>
                  <dd className="text-xs font-medium text-gray-900">2</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-gray-500">Approved</dt>
                  <dd className="text-xs font-medium text-green-600">12</dd>
                </div>
                {isManager && (
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-gray-500">Team Size</dt>
                    <dd className="text-xs font-medium text-gray-900">8</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;