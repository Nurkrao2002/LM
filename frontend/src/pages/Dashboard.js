import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentUser, selectHasRole } from '../store/slices/authSlice';
import {
  selectLeaveBalances,
  selectMonthlyUsage,
  selectLeaveRequests,
  selectLeaveStatistics,
  selectLeaveLoading,
  fetchLeaveBalances,
  fetchMonthlyUsage,
  fetchLeaveRequests,
  fetchLeaveStatistics
} from '../store/slices/leaveSlice';
import {
  selectNotifications,
  selectUnreadCount,
  selectNotificationLoading,
  fetchNotifications,
  fetchUnreadCount
} from '../store/slices/notificationSlice';
import DashboardCharts from '../components/DashboardCharts';
import { CalendarDays, Clock, CheckCircle, XCircle, Users, TrendingUp, Plus, FileText, RefreshCw, BarChart3, ChevronDown, ChevronUp, Bell, X } from 'lucide-react';
import { NotificationContainer, NotificationManager } from 'react-notifications';
import 'react-notifications/lib/notifications.css';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // State declarations
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(120000); // 2 minutes
  const intervalRef = useRef(null);

  // Redux selectors (declared first)
  const currentUser = useSelector(selectCurrentUser);
  const isManager = useSelector(selectHasRole(['manager', 'admin']));
  const balances = useSelector(selectLeaveBalances);
  const monthlyUsage = useSelector(selectMonthlyUsage);

  console.log('🚨 DEBUG: Balance cards rendering - balances array:', balances);
  const leaveRequests = useSelector(selectLeaveRequests);
  const statistics = useSelector(selectLeaveStatistics);
  const isLoading = useSelector(selectLeaveLoading);
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const notificationLoading = useSelector(selectNotificationLoading);

  // Notification panel state
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // Memoize expensive calculations
  const recentLeaveRequests = useMemo(() => {
    return leaveRequests.slice(0, 5);
  }, [leaveRequests]);

  const pendingApprovalsCount = useMemo(() => {
    return leaveRequests.filter(req => req.status === 'pending').length;
  }, [leaveRequests]);

  // Function to fetch all dashboard data
  const fetchDashboardData = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Fetch leave balances
    dispatch(fetchLeaveBalances(currentYear));

    // Fetch monthly usage for current month
    dispatch(fetchMonthlyUsage({ year: currentYear, month: currentMonth }));

    // Fetch recent leave requests (limit to 5)
    dispatch(fetchLeaveRequests({ limit: 5 }));

    // Fetch notifications
    dispatch(fetchNotifications({ unread_only: false, limit: 10 }));
    dispatch(fetchUnreadCount());

    // Fetch statistics for advanced analytics
    if (isManager) {
      dispatch(fetchLeaveStatistics(currentYear));
    }

    setLastRefreshTime(new Date());
  }, [dispatch, isManager]);

  // Function to show browser notification
  const showBrowserNotification = (title, message, type = 'info') => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/favicon.ico' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body: message, icon: '/favicon.ico' });
        }
      });
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, [dispatch, isManager]);

  // Set up real-time updates
  useEffect(() => {
    intervalRef.current = setInterval(fetchDashboardData, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [dispatch, isManager, refreshInterval, fetchDashboardData]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'manager_approved': return 'bg-blue-100 text-blue-800';
      case 'admin_approved': return 'bg-green-100 text-green-800';
      case 'manager_rejected': return 'bg-red-100 text-red-800';
      case 'admin_rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'manager_approved':
      case 'admin_approved': return <CheckCircle className="w-4 h-4" />;
      case 'manager_rejected':
      case 'admin_rejected':
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-600';
      case 'manager_approved':
      case 'admin_approved': return 'bg-green-600';
      case 'manager_rejected':
      case 'admin_rejected':
      case 'cancelled': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusMessage = (request) => {
    switch (request.status) {
      case 'pending': return `${request.leaveType} leave request submitted`;
      case 'manager_approved': return `${request.leaveType} leave request approved by manager`;
      case 'admin_approved': return `${request.leaveType} leave request approved by admin`;
      case 'manager_rejected': return `${request.leaveType} leave request rejected by manager`;
      case 'admin_rejected': return `${request.leaveType} leave request rejected by admin`;
      case 'cancelled': return `${request.leaveType} leave request cancelled`;
      default: return `${request.leaveType} leave request ${request.status?.replace('_', ' ')}`;
    }
  };

  const getLeaveTypeColor = (leaveType) => {
    switch (leaveType?.toLowerCase()) {
      case 'annual': return 'text-green-600';
      case 'sick': return 'text-red-600';
      case 'personal': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  // Empty state component
  const EmptyState = ({ icon: Icon, title, description, children, small = false }) => (
    <div className={`text-center ${small ? 'py-6' : 'py-8'}`}>
      <Icon className={`mx-auto ${small ? 'h-8 w-8' : 'h-12 w-12'} text-gray-400`} />
      <h3 className={`mt-2 text-sm font-medium text-gray-900 ${small ? '' : 'font-medium'}`}>{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {children}
    </div>
  );

  // Format relative time for last refresh
  const formatLastRefresh = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  // Define quick actions array
  const quickActions = useMemo(() => {
    const actions = [
      {
        icon: CalendarDays,
        iconColor: 'text-blue-600',
        bgColor: 'bg-blue-50 hover:bg-blue-100',
        textColor: 'text-blue-900',
        subTextColor: 'text-blue-700',
        title: 'Request Leave',
        description: 'Submit a new leave request'
      },
      {
        icon: CheckCircle,
        iconColor: 'text-green-600',
        bgColor: 'bg-green-50 hover:bg-green-100',
        textColor: 'text-green-900',
        subTextColor: 'text-green-700',
        title: 'View Requests',
        description: 'Check your leave history'
      }
    ];

    if (isManager) {
      actions.push({
        icon: Users,
        iconColor: 'text-orange-600',
        bgColor: 'bg-orange-50 hover:bg-orange-100',
        textColor: 'text-orange-900',
        subTextColor: 'text-orange-700',
        title: 'Team Approvals',
        description: 'Review pending requests'
      });
    }

    return actions;
  }, [isManager]);

  if (isLoading && balances.length === 0 && leaveRequests.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {currentUser?.firstName}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's an overview of your leave management dashboard
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {formatLastRefresh(lastRefreshTime)}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[20px] h-5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {showNotificationPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                      <button
                        onClick={() => setShowNotificationPanel(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {notificationLoading ? 'Loading...' : 'No notifications'}
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                            !notification.is_read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start">
                            <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                              notification.type === 'approved' ? 'bg-green-400' :
                              notification.type === 'rejected' ? 'bg-red-400' : 'bg-blue-400'
                            }`} />
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="p-4 border-t">
                      <button
                        onClick={() => navigate('/notifications')}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                if (action.title === 'Request Leave') navigate('/leave-request');
                else if (action.title === 'View Requests') navigate('/leave-requests');
                else if (action.title === 'Team Approvals') navigate('/leave-approvals');
              }}
              className={`flex items-center p-4 rounded-lg hover:bg-opacity-80 transition-colors ${action.bgColor}`}
            >
              <action.icon className={`w-8 h-8 ${action.iconColor} mr-3`} />
              <div className="text-left">
                <h3 className={`font-medium ${action.textColor}`}>{action.title}</h3>
                <p className={`text-sm ${action.subTextColor}`}>{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {balances.length === 0 ? (
          <div className="col-span-3 bg-white shadow rounded-lg p-8">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No leave balances found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Your leave balances will appear here once they're configured.
              </p>
            </div>
          </div>
        ) : (
          // Filter out duplicate balances by name to prevent displaying the same leave type multiple times
          (() => {
            const uniqueBalances = balances.filter((balance, index, arr) => arr.findIndex(b => b.name === balance.name) === index);
            console.log('🚨 DEBUG: After deduplication, unique balances count:', uniqueBalances.length, 'from original:', balances.length);
            return uniqueBalances;
          })().map((balance, index) => {
            console.log('🚨 DEBUG: Rendering balance card:', index, balance);
            const utilized = parseFloat(balance.totalDays || 0) > 0 ? ((parseFloat(balance.usedDays || 0) / parseFloat(balance.totalDays || 0)) * 100).toFixed(1) : 0;

            return (
              <div key={balance.name + index} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold capitalize ${getLeaveTypeColor(balance.name)}`}>
                    {balance.name.includes('Leave') ? balance.name : `${balance.name} Leave`}
                  </h3>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Days</span>
                    <span className="font-medium">{balance.totalDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Used</span>
                    <span className="font-medium text-red-600">{balance.usedDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pending</span>
                    <span className="font-medium text-yellow-600">{balance.pendingDays}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining</span>
                    <span className="font-medium text-green-600">{balance.remainingDays}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${utilized}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {utilized}% utilized
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Monthly Usage Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Monthly Usage ({new Date().toLocaleString('default', { month: 'long', year: 'numeric' })})
          </h2>
          <div className="text-sm text-gray-500">
            Limits reset monthly • Max 1 day per leave type
          </div>
        </div>

        {monthlyUsage.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <EmptyState
                icon={CalendarDays}
                title="Loading monthly usage..."
                description=""
                small={true}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthlyUsage.map((usage) => (
              <div key={usage.leave_type} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 capitalize">
                    {usage.leave_type_name}
                  </h3>
                  <span className={`text-sm font-semibold ${
                    usage.used_days >= usage.max_allowed
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {usage.used_days}/{usage.max_allowed} used
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Days Used This Month</span>
                    <span className="font-medium">{usage.used_days}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Monthly Limit</span>
                    <span className="font-medium">{usage.max_allowed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining This Month</span>
                    <span className={`font-medium ${
                      usage.max_allowed - usage.used_days <= 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {Math.max(usage.max_allowed - usage.used_days, 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        usage.used_days >= usage.max_allowed
                          ? 'bg-red-500'
                          : usage.used_days > 0
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((usage.used_days / usage.max_allowed) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0 days</span>
                    <span>{usage.max_allowed} days limit</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Leave Requests */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Leave Requests</h2>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All
          </button>
        </div>

        {leaveRequests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description="You haven't submitted any leave requests yet."
          >
            <button
              onClick={() => navigate('/leave-request')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </button>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {leaveRequests.slice(0, 5).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(`/leave-request`)}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <CalendarDays className={`h-5 w-5 ${getLeaveTypeColor(request.leaveType)}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {request.leaveType} Leave
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(request.dates.start).toLocaleDateString()} - {new Date(request.dates.end).toLocaleDateString()} ({request.dates.totalDays} days)
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    <span className="ml-1 capitalize">{request.status?.replace('_', ' ')}</span>
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {leaveRequests.length > 5 && (
              <div className="text-center pt-2">
                <button
                  onClick={() => navigate(`/leave-requests`)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View all requests ({leaveRequests.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager/Approver Summary (for managers/admins) */}
      {isManager && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manager Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {leaveRequests.filter(req => req.status === 'pending').length}
              </div>
              <div className="text-sm text-yellow-800">Pending Approvals</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {leaveRequests.filter(req =>
                  req.status?.includes('approved') &&
                  new Date(req.createdAt).getMonth() === new Date().getMonth()
                ).length}
              </div>
              <div className="text-sm text-green-800">Approved This Month</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {statistics?.team_stats?.total_team_members || 0}
              </div>
              <div className="text-sm text-blue-800">Team Members</div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {leaveRequests.length > 0 ? (
            leaveRequests.slice(0, 5).map((request, index) => {
              return (
                <div key={request.id} className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${getStatusDotColor(request.status)}`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      {getStatusMessage(request)}
                      {request.dates && ` (${request.dates.start} - ${request.dates.end})`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.updatedAt || request.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={Clock}
              title="No recent activity"
              description=""
              small={true}
            />
          )}
        </div>

        {leaveRequests.length > 5 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/leave-requests')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all activity
            </button>
          </div>
        )}
      </div>

      {/* Advanced Analytics Toggle */}
      <div className="bg-white shadow rounded-lg p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left hover:bg-gray-50 px-4 py-2 rounded-md transition-colors"
        >
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">Advanced Analytics</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 border-t pt-4">
            <DashboardCharts
              statistics={statistics}
              leaveRequests={leaveRequests}
              balances={balances}
            />
          </div>
        )}
      </div>

      {/* Notification Container for react-notifications */}
      <NotificationContainer />
    </div>
  );
};

export default Dashboard;