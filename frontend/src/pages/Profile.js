import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectCurrentUser,
  fetchProfile,
  updateProfile,
  selectAuthLoading,
  selectAuthError
} from '../store/slices/authSlice';
import { fetchLeaveBalances, selectLeaveBalances } from '../store/slices/leaveSlice';
import {
  fetchUserStatistics,
  fetchRecentLeaveRequests,
  selectProfileStatistics,
  selectRecentRequests,
  selectProfileLoading,
  selectProfileError
} from '../store/slices/profileSlice';
import { selectHasRole } from '../store/slices/authSlice';
import {
  User,
  Calendar,
  Shield,
  AlertTriangle,
  Edit3,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Clock as PendingClock,
  Download,
  Activity,
  TrendingUp,
  Award
} from 'lucide-react';

const Profile = () => {
  const dispatch = useDispatch();

  // All useSelector hooks first (in consistent order)
  const currentUser = useSelector(selectCurrentUser);
  const leaveBalances = useSelector(selectLeaveBalances);
  const authLoading = useSelector(selectAuthLoading);
  const profileLoading = useSelector(selectProfileLoading);
  const authError = useSelector(selectAuthError);
  const profileError = useSelector(selectProfileError);
  const profileStats = useSelector(selectProfileStatistics);
  const recentRequests = useSelector(selectRecentRequests);
  const isAdmin = useSelector(selectHasRole('admin'));

  // Computed values after hooks
  const isLoading = authLoading || profileLoading;
  const error = authError || profileError;

  const [successMessage, setSuccessMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: '',
    lastName: '',
    department: '',
    employeeId: ''
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5" />;
      case 'manager':
        return <User className="w-5 h-5" />;
      case 'employee':
        return <User className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getRequestStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <PendingClock className="w-4 h-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRequestStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    // Fetch real fresh profile data from backend
    dispatch(fetchProfile());

    // Fetch leave balances
    dispatch(fetchLeaveBalances());

    // Fetch profile statistics
    dispatch(fetchUserStatistics());

    // Fetch recent leave requests
    dispatch(fetchRecentLeaveRequests());
  }, [dispatch]);

  useEffect(() => {
    // Initialize edit data when currentUser changes
    if (currentUser) {
      setEditData({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        department: currentUser.department || '',
        employeeId: currentUser.employeeId || ''
      });
    }
  }, [currentUser]);

  // Handle profile update
  const handleUpdateProfile = async () => {
    try {
      await dispatch(updateProfile(editData));
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({
      firstName: currentUser?.firstName || '',
      lastName: currentUser?.lastName || '',
      department: currentUser?.department || '',
      employeeId: currentUser?.employeeId || ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <User className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                <p className="text-gray-600 mt-1">Advanced profile management with real-time backend data</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Information - Main Content */}
          <div className="lg:col-span-3 space-y-6">

            {/* Basic Information */}
            <div className="bg-white shadow-sm rounded-xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                    <p className="text-gray-600">Real-time data from backend</p>
                  </div>
                </div>
                {currentUser?.updated_at && (
                  <div className="text-sm text-gray-500">
                    Last updated: {new Date(currentUser.updated_at).toLocaleString()}
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading fresh profile data...</p>
                </div>
              ) : currentUser ? (
                <div className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {currentUser?.firstName?.charAt(0) || '?'}{currentUser?.lastName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-medium text-gray-900">
                        {currentUser?.firstName || 'Not set'} {currentUser?.lastName || 'Not set'}
                      </h3>
                      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(currentUser?.role)}`}>
                        {getRoleIcon(currentUser?.role)}
                        <span className="capitalize">{currentUser?.role || 'Employee'}</span>
                      </div>
                    </div>
                  </div>

                  {!isEditing ? (
                    /* View Mode */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{currentUser?.firstName || 'Not provided'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{currentUser?.lastName || 'Not provided'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{currentUser?.email || 'Not provided'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{currentUser?.department || 'Not specified'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span>{currentUser?.employeeId || 'Not assigned'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                        <div className="flex items-center space-x-2 text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {currentUser?.dateOfJoining
                              ? new Date(currentUser.dateOfJoining).toLocaleDateString()
                              : 'Not available'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                          <input
                            type="text"
                            value={editData.firstName}
                            onChange={(e) => setEditData({...editData, firstName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                          <input
                            type="text"
                            value={editData.lastName}
                            onChange={(e) => setEditData({...editData, lastName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                          <input
                            type="text"
                            value={editData.department}
                            onChange={(e) => setEditData({...editData, department: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                          <input
                            type="text"
                            value={editData.employeeId}
                            onChange={(e) => setEditData({...editData, employeeId: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={handleUpdateProfile}
                          disabled={authLoading}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {authLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400" />
                  <p className="mt-4 text-gray-600">Unable to load profile data from backend</p>
                </div>
              )}
            </div>

            {/* Profile Statistics */}
            {profileStats && currentUser && (
              <div className="bg-white shadow-sm rounded-xl p-8">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Profile Statistics</h2>
                    <p className="text-gray-600">Your leave activity overview</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600">{profileStats?.overall?.totalRequests || 0}</div>
                    <div className="text-sm text-gray-500">Total Requests</div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{profileStats?.overall?.approvedRequests || 0}</div>
                    <div className="text-sm text-gray-500">Approved</div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{profileStats?.overall?.pendingRequests || 0}</div>
                    <div className="text-sm text-gray-500">Pending</div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Leave Requests */}
            {recentRequests && recentRequests.requests && recentRequests.requests.length > 0 && (
              <div className="bg-white shadow-sm rounded-xl p-8">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Recent Leave Requests</h2>
                    <p className="text-gray-600">Your latest leave activity</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {recentRequests.requests.map((request, index) => (
                    <div key={request.id || index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${getRequestStatusColor(request.status)}`}>
                          {getRequestStatusIcon(request.status)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {request.leave_type_name} Request
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                            {request.reason && ` • ${request.reason}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRequestStatusColor(request.status)}`}>
                          <span className="capitalize">{request.status?.replace('_', ' ')}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {request.total_days} day{request.total_days !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Advanced Features */}
          <div className="lg:col-span-1 space-y-6">
            {/* Professional Summary */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-medium text-gray-900">Professional Summary</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Role</span>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(currentUser?.role)}`}>
                    <span className="capitalize">{currentUser?.role || 'Employee'}</span>
                  </div>
                </div>

                {currentUser?.department && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Department</span>
                    <span className="text-sm font-medium text-gray-900">{currentUser.department}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Employee ID</span>
                  <span className="text-sm font-medium text-gray-900">{currentUser?.employeeId || 'Not set'}</span>
                </div>

                {currentUser?.dateOfJoining && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Joined</span>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(currentUser.dateOfJoining).getFullYear()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Leave Balance Summary - Enhanced */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-medium text-gray-900">Leave Balances</h3>
              </div>

              {leaveBalances && leaveBalances.length > 0 ? (
                <div className="space-y-4">
                  {leaveBalances.map((balance, index) => (
                    <div key={balance.name || index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {balance.name || `Leave Type ${index + 1}`}
                        </span>
                        <span className="text-sm text-gray-500">
                          {Math.floor(balance.remainingDays || 0)}/{balance.totalDays || 0}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(((balance.remainingDays || 0) / (balance.totalDays || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Used: {Math.floor(((balance.totalDays || 0) - (balance.remainingDays || 0)))}</span>
                        <span>Pending: {Math.floor(balance.pendingDays || 0)}</span>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 mt-3 border-t border-gray-200">
                    <button className="w-full flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                      <Calendar className="w-4 h-4 mr-2" />
                      Apply for Leave
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Loading leave balances...</p>
                </div>
              )}
            </div>

            {/* Activity Summary */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Activity Summary</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Requests Approved</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {profileStats?.overall?.approvedRequests || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Pending Requests</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {profileStats?.overall?.pendingRequests || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Total Requests</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {profileStats?.overall?.totalRequests || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/leave-request'}
                  className="w-full flex items-center px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  New Leave Request
                </button>

                <button className="w-full flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Statistics
                </button>

                <button className="w-full flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </button>
              </div>
            </div>

            {/* System Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">System Info</h3>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Account Status:</span>
                  <span className="font-medium text-green-600">
                    {currentUser?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>User Status:</span>
                  <span className="font-medium text-blue-600 capitalize">
                    {currentUser?.status || 'Active'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Last Login:</span>
                  <span className="font-medium">
                    {currentUser?.lastLogin ? new Date(currentUser.lastLogin).toLocaleDateString() : 'Today'}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    Profile last updated: {currentUser?.updated_at ? new Date(currentUser.updated_at).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;