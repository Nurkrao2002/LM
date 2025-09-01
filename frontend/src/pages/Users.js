 import React, { useState, useEffect } from 'react';
 import { useDispatch, useSelector } from 'react-redux';
 import { useNavigate } from 'react-router-dom';
 import {
   selectCurrentUser,
   selectHasRole
 } from '../store/slices/authSlice';
 import userService from '../services/userService';
 import {
   UserCheck,
   UserX,
   Search,
   Filter,
   RefreshCw,
   Download,
   Building,
   Users as UsersIcon
 } from 'lucide-react';
 import LoadingSpinner from '../components/common/LoadingSpinner';
 import EmptyState from '../components/common/EmptyState';
 import ProgressBar from '../components/common/ProgressBar';

const Users = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = useSelector(selectHasRole('admin'));
  const isManager = useSelector(selectHasRole('manager'));
  const isHrManager = useSelector(selectHasRole('hr_manager'));

  // Temporary fix for admin approval permissions
  const canApproveUsers = isAdmin || isManager || isHrManager ||
    (currentUser && ['admin', 'manager', 'hr_manager'].includes(currentUser.role));
  const canManageUsers = isAdmin || isManager || isHrManager;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_users: 0,
    per_page: 10
  });
  const [filters, setFilters] = useState({
    role: '',
    department: '',
    status: 'active',
    approvalStatus: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [processingUser, setProcessingUser] = useState(null);
  const [departmentStats, setDepartmentStats] = useState({});

  useEffect(() => {
    let intervalId;
    if (isRealTimeEnabled && canManageUsers) {
      intervalId = setInterval(() => {
        loadUsers();
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRealTimeEnabled, filters, canManageUsers]);

  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
    }
  }, [filters, canManageUsers]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pagination.current_page,
        limit: pagination.per_page,
        ...filters,
        approvalStatus: filters.approvalStatus || undefined
      };

      const response = await userService.getUsers(params);

      if (response.success) {
        const { users: userData, pagination: paginationData } = response.data;

        setUsers(userData);
        setPagination({
          current_page: paginationData.current_page,
          total_pages: paginationData.total_pages,
          total_users: paginationData.total_users,
          per_page: paginationData.per_page,
          has_next: paginationData.has_next,
          has_prev: paginationData.has_prev
        });
      } else {
        throw new Error(response.message || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate department statistics
  const calculateDepartmentStats = () => {
    const stats = {};

    // Count users by department
    users.forEach(user => {
      const department = user.department || 'Unassigned';

      if (!stats[department]) {
        stats[department] = {
          total: 0,
          active: 0,
          pending: 0,
          approved: 0,
          rejected: 0
        };
      }

      stats[department].total += 1;

      if (user.is_active) {
        stats[department].active += 1;
      }

      if (user.status === 'pending') {
        stats[department].pending += 1;
      } else if (user.status === 'approved') {
        stats[department].approved += 1;
      } else if (user.status === 'rejected') {
        stats[department].rejected += 1;
      }
    });

    setDepartmentStats(stats);
  };

  // Recalculate stats when users data changes
  useEffect(() => {
    if (users.length > 0 && canManageUsers) {
      calculateDepartmentStats();
    }
  }, [users, canManageUsers]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      role: '',
      department: '',
      status: 'active',
      approvalStatus: '',
      search: ''
    });
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      const isSelected = prev.includes(userId);
      if (isSelected) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers([]);
      setSelectAll(false);
    } else {
      const allUserIds = users.map(user => user.id);
      setSelectedUsers(allUserIds);
      setSelectAll(true);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApproveUser = async (userId) => {
    if (window.confirm('Are you sure you want to approve this user?')) {
      setProcessingUser(userId);
      try {
        // First verify the user is logged in
        if (!currentUser) {
          throw new Error('You must be logged in to approve users');
        }

        console.log('🔍 APPROVAL DEBUG:', {
          email: currentUser.email,
          role: currentUser.role,
          isAdmin,
          isManager,
          isHrManager,
          canApproveUsers
        });

        // Check if userId is valid
        if (!userId || typeof userId !== 'string' || userId.length !== 36) {
          throw new Error('Invalid user ID format');
        }

        console.log('🔍 APPROVAL REQUEST:', {
          userId,
          currentEmail: currentUser.email,
          currentRole: currentUser.role,
          canApproveUsers,
          userBeingApproved: userId
        });

        // Skip client-side permission check and let backend handle it
        console.log('Approval request sent to backend...');
        const response = await userService.approveUser(userId);
        console.log('Approve response:', response);

        if (response.success) {
          console.log('User approved successfully');
          await loadUsers(); // Refresh the list
        } else {
          throw new Error(response.message || 'Approval failed');
        }

      } catch (err) {
        console.error('Error approving user:', err);
        console.error('Error response:', err.response?.data);

        let errorMessage = 'Failed to approve user';
        if (err.response?.status === 401) {
          errorMessage = 'Session expired. Please refresh the page and log in again.';
        } else if (err.response?.status === 403) {
          errorMessage = 'You do not have permission to approve users.';
        } else if (err.response?.status === 404) {
          errorMessage = 'User not found.';
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        alert(`${errorMessage}\n\nError details: ${JSON.stringify(err.response?.data || err.message)}`);
      } finally {
        setProcessingUser(null);
      }
    }
  };

  const handleRejectUser = async (userId) => {
    if (window.confirm('Are you sure you want to reject this user?')) {
      setProcessingUser(userId);
      try {
        await userService.rejectUser(userId);
        await loadUsers(); // Refresh the list
      } catch (err) {
        console.error('Error rejecting user:', err);
        setError('Failed to reject user');
      } finally {
        setProcessingUser(null);
      }
    }
  };

  useEffect(() => {
    if (users.length > 0) {
      const allSelected = users.every(user => selectedUsers.includes(user.id));
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [users, selectedUsers]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'hr_manager':
        return 'bg-purple-100 text-purple-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExportCsv = () => {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `users-${currentDate}.csv`;

      const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Employee ID', 'Role', 'Department'];

      const csvData = users.map(user => [
        user.id,
        user.first_name,
        user.last_name,
        user.email,
        user.employee_id || '',
        user.role,
        user.department || 'N/A'
      ]);

      const csvContent = [headers, ...csvData];
      const csvString = csvContent.map(row =>
        row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setError('Failed to export user data');
    }
  };

  if (!canManageUsers) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <UserX className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <div className="mt-2 text-sm text-red-700">
                You don't have permission to access user management. Only admins, managers and HR managers can view this page.
              </div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-800 mb-4">Current Login Status:</h3>
          <div className="space-y-2">
            <p><strong>Email:</strong> {currentUser?.email || 'Not logged in'}</p>
            <p><strong>Role:</strong> {currentUser?.role || 'N/A'}</p>
            <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
            <p><strong>Is Manager:</strong> {isManager ? 'Yes' : 'No'}</p>
            <p><strong>Is HR Manager:</strong> {isHrManager ? 'Yes' : 'No'}</p>
            <p><strong>Can Approve Users:</strong> {canApproveUsers ? 'Yes ✅' : 'No ❌'}</p>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">🚨 Permission Issue Detected</h4>
            <p className="text-sm text-yellow-700 mb-3">
              You're not logged in as an admin. To test user approval:
            </p>
            <div className="space-y-1 text-sm">
              <p><strong>Logout & Login as Admin:</strong></p>
              <p><strong>Email:</strong> admintest@company.com</p>
              <p><strong>Password:</strong> Test123!</p>
              <p><strong>OR as HR Manager:</strong> sarah.johnson@company.com</p>
              <p><strong>Password:</strong> Password123!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Debug Info - Always visible for admins/managers */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Current User Info:</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Email:</strong> {currentUser?.email || 'Not logged in'}</p>
          <p><strong>Role:</strong> {currentUser?.role || 'N/A'}</p>
          <p><strong>Can Approve:</strong> {canApproveUsers ? 'Yes ✅' : 'No ❌'}</p>
        </div>
        {!canManageUsers && (
          <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">
              Login as admin: admintest@company.com / Test123!<br/>
              OR as HR Manager: sarah.johnson@company.com / Password123!
            </p>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src="/pigeon_srisys_logo-removebg.png"
              alt="Company Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
            </div>
          </div>

          <div className="flex space-x-4">
            <div className="bg-blue-50 px-4 py-2 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {pagination.total_users} user{pagination.total_users !== 1 ? 's' : ''}
              </span>
            </div>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              title="Export to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>

            {/* Real-time Controls */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isRealTimeEnabled}
                  onChange={(e) => setIsRealTimeEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  <RefreshCw className="w-4 h-4 inline mr-1" />
                  Real-time updates
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Department Statistics Dashboard - Only for Admin and HR Managers */}
      {canManageUsers && Object.keys(departmentStats).length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Department Overview
            </h2>
            <p className="text-sm text-gray-600">User distribution across departments</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.entries(departmentStats).map(([department, stats]) => (
              <div key={department} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-100 rounded-lg p-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {department}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-blue-600 font-medium">
                          {stats.total} user{stats.total !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Users</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-semibold text-green-600">{stats.active}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pending Approval</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-semibold text-yellow-600">{stats.pending}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Approved</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-semibold text-blue-600">{stats.approved}</span>
                    </div>
                  </div>

                  {stats.rejected > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Rejected</span>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-red-600">{stats.rejected}</span>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <ProgressBar
                    value={stats.active}
                    maxValue={stats.total}
                    label="Active Rate"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-2 mr-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Active Users</p>
                  <p className="text-xl font-bold text-green-900">
                    {Object.values(departmentStats).reduce((sum, dept) => sum + dept.active, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center">
                <div className="bg-yellow-100 rounded-lg p-2 mr-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Pending Approval</p>
                  <p className="text-xl font-bold text-yellow-900">
                    {Object.values(departmentStats).reduce((sum, dept) => sum + dept.pending, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-2 mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Departments</p>
                  <p className="text-xl font-bold text-blue-900">{Object.keys(departmentStats).length}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center">
                <div className="bg-purple-100 rounded-lg p-2 mr-3">
                  <UsersIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-800">Total Users</p>
                  <p className="text-xl font-bold text-purple-900">{pagination.total_users}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>

            {users.length > 0 && canManageUsers && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Select All</span>
                {selectedUsers.length > 0 && (
                  <span className="text-sm text-gray-500">({selectedUsers.length})</span>
                )}
              </div>
            )}
          </div>

          {showFilters && (
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    name="role"
                    value={filters.role}
                    onChange={handleFilterChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="hr_manager">HR Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={filters.department}
                    onChange={handleFilterChange}
                    placeholder="Filter by department"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activation Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="">All Activation Statuses</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Approval Status</label>
                  <select
                    name="approvalStatus"
                    value={filters.approvalStatus}
                    onChange={handleFilterChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">All Approval Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Search users..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedUsers.length > 0 && canManageUsers && (
          <div className="px-6 py-4 bg-blue-50 border-t border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Clear selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="px-6 py-4">
          {loading ? (
            <LoadingSpinner text="Loading users..." />
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UserX}
              title="No users found"
              description="No users match your current filters."
              action={clearFilters}
              actionText="Clear Filters"
            />
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {canManageUsers && (
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                      )}
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500">{user.email}</span>
                          {user.employee_id && (
                            <span className="text-sm text-gray-500">ID: {user.employee_id}</span>
                          )}
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role}
                          </div>
                          {user.status && (
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </div>
                          )}
                        </div>
                      </div>
                      {canApproveUsers && user.status === 'pending' && user.id !== currentUser.id && (
                        <div className="flex space-x-2 ml-auto">
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingUser === user.id ? (
                              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <UserCheck className="w-3 h-3 mr-1" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectUser(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <UserX className="w-3 h-3 mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Users;