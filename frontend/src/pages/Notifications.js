import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  CheckCheck,
  MessageSquare,
  Trash2,
  Filter,
  RefreshCw,
  Volume2,
  VolumeX,
  Download,
  Archive,
  Share2,
  Zap,
  Calendar,
  User,
  ArrowRight
} from 'lucide-react';
import notificationService from '../services/notificationService';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedType, setSelectedType] = useState(''); // Filter by type
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    read: 0
  });
  const [detailedStats, setDetailedStats] = useState({
    approval_count: 0,
    rejection_count: 0,
    request_count: 0,
    recent_count: 0
  });
  const [error, setError] = useState(null);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const pollingIntervalRef = useRef(null);
  const previousUnreadCount = useRef(0);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Real-time polling and initial data loading
  useEffect(() => {
    loadNotifications(true);
    loadNotificationStats();

    if (realTimeEnabled) {
      startRealTimePolling();
    }

    return () => {
      stopRealTimePolling();
    };
  }, [realTimeEnabled]);

  useEffect(() => {
    if (!realTimeEnabled) {
      stopRealTimePolling();
    }
  }, [realTimeEnabled]);

  const startRealTimePolling = () => {
    if (pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(() => {
      checkForNewNotifications();
      updateUnreadCount();
    }, 30000); // Poll every 30 seconds
  };

  const stopRealTimePolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const updateUnreadCount = async () => {
    try {
      const response = await notificationService.getUnreadCount();
      if (response.success) {
        const newUnreadCount = response.data.unread_count;
        // Show browser notification for new unread notifications
        if (newUnreadCount > previousUnreadCount.current && notificationPermission === 'granted') {
          showBrowserNotification(newUnreadCount - previousUnreadCount.current);
        }
        previousUnreadCount.current = newUnreadCount;
      }
    } catch (err) {
      console.error('Error updating unread count:', err);
    }
  };

  const loadNotifications = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const params = {};
      if (selectedType) params.type = selectedType;

      const response = await notificationService.getNotifications(params);

      if (response.success) {
        setNotifications(response.data.notifications || []);
        setLastUpdate(new Date());
      } else {
        throw new Error(response.message || 'Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(err.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationStats = async () => {
    try {
      const response = await notificationService.getNotificationStats();
      if (response.success) {
        const statsData = response.data.stats;
        setStats({
          total: statsData.total_notifications,
          unread: statsData.unread_count,
          read: statsData.total_notifications - statsData.unread_count
        });
        setDetailedStats(statsData);
      }
    } catch (err) {
      console.error('Error loading notification stats:', err);
    }
  };

  const checkForNewNotifications = async () => {
    try {
      const params = {};
      if (selectedType) params.type = selectedType;

      const response = await notificationService.getNotifications(params);
      if (response.success) {
        const currentIds = notifications.map(n => n.id).sort();
        const newIds = response.data.notifications.map(n => n.id).sort();

        const newNotificationCount = response.data.notifications.filter(n => !n.is_read).length;
        const oldNotificationCount = notifications.filter(n => !n.is_read).length;

        // Only update if there are actual changes
        if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
          setNotifications(response.data.notifications);
          setLastUpdate(new Date());

          // Check for new notifications and show toast
          if (newNotificationCount > oldNotificationCount) {
            showToast(`${newNotificationCount - oldNotificationCount} new notification(s)!`);
          }
        }
      }
    } catch (err) {
      console.error('Error checking for new notifications:', err);
    }
  };

  const showBrowserNotification = (newCount) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New Notifications`, {
        body: `You have ${newCount} new notification(s)`,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    }
  };

  const showToast = (message) => {
    // Create toast notification (you could use a proper toast library)
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'request_submitted':
      case 'manager_review':
      case 'admin_review':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'emergency_request':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'approved':
        return 'border-l-green-500 bg-green-50';
      case 'rejected':
        return 'border-l-red-500 bg-red-50';
      case 'request_submitted':
      case 'manager_review':
      case 'admin_review':
        return 'border-l-blue-500 bg-blue-50';
      case 'emergency_request':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getTypeDisplay = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      // Update local state on success
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
      // Update stats
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1
      }));
      setDetailedStats(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1)
      }));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');
    }
  };

  const quickMarkAsRead = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      // Update local state on success
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      // Update stats
      setStats(prev => ({
        ...prev,
        unread: 0,
        read: prev.total
      }));
      setDetailedStats(prev => ({
        ...prev,
        unread_count: 0
      }));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark all notifications as read');
    }
  };

  const bulkMarkAsRead = async () => {
    try {
      // Mark selected notifications as read
      await Promise.all(selectedNotifications.map(id => notificationService.markAsRead(id)));
      setNotifications(prev =>
        prev.map(notification =>
          selectedNotifications.includes(notification.id)
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setSelectedNotifications([]);
      await loadNotificationStats();
      setShowBulkActions(false);
    } catch (err) {
      console.error('Error bulk marking as read:', err);
      setError('Failed to mark selected notifications as read');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      // Update local state on success
      setNotifications(prev => prev.filter(notification => notification.id !== id));
      await loadNotificationStats();
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  };

  const bulkDeleteNotifications = async () => {
    try {
      await Promise.all(selectedNotifications.map(id => notificationService.deleteNotification(id)));
      setNotifications(prev => prev.filter(notification => !selectedNotifications.includes(notification.id)));
      setSelectedNotifications([]);
      await loadNotificationStats();
      setShowBulkActions(false);
    } catch (err) {
      console.error('Error bulk deleting notifications:', err);
      setError('Failed to delete selected notifications');
    }
  };

  const toggleNotificationSelection = (id) => {
    setSelectedNotifications(prev =>
      prev.includes(id)
        ? prev.filter(notificationId => notificationId !== id)
        : [...prev, id]
    );
  };

  const selectAllNotifications = () => {
    const visibleNotificationIds = filteredNotifications.map(n => n.id);
    if (selectedNotifications.length === visibleNotificationIds.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(visibleNotificationIds);
    }
  };

  const exportNotifications = () => {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const fileName = `notifications-${currentDate}.json`;

      const dataToExport = filteredNotifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        is_read: notification.is_read,
        created_at: notification.created_at,
        leave_request_id: notification.leave_request_id
      }));

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportFileDefaultName = fileName;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting notifications:', error);
      setError('Failed to export notifications');
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'read') return notification.is_read;
    return true;
  });

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Bell className="w-8 h-8 text-blue-600 mr-3" />
              Notifications
            </h1>
            <p className="text-gray-600 mt-1">
              Stay updated with your leave requests and approvals
            </p>
            <div className="text-sm text-gray-500 mt-2">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notification Permission */}
            {'Notification' in window && (
              <button
                onClick={requestNotificationPermission}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  notificationPermission === 'granted'
                    ? 'bg-green-100 text-green-800'
                    : notificationPermission === 'denied'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
                title={notificationPermission === 'granted' ? 'Browser notifications enabled' : 'Enable browser notifications'}
              >
                {notificationPermission === 'granted' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            {/* Real-time Toggle */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={realTimeEnabled}
                  onChange={(e) => setRealTimeEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <Zap className="w-4 h-4 mr-1 text-orange-500" />
                  Real-time updates
                </span>
              </label>
            </div>

            {/* Unread Badge */}
            <div className={`${stats.unread > 0 ? 'bg-red-50' : 'bg-green-50'} px-3 py-1 rounded-lg`}>
              <span className={`text-sm font-medium ${stats.unread > 0 ? 'text-red-800' : 'text-green-800'}`}>
                {stats.unread} unread
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
          <div className="flex items-center">
            <Bell className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
          <div className="flex items-center">
            <Clock className="w-6 h-6 text-red-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Unread</p>
              <p className="text-xl font-bold text-red-700">{stats.unread}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center">
            <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-xl font-bold text-green-700">{detailedStats.approval_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
          <div className="flex items-center">
            <Calendar className="w-6 h-6 text-purple-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-xl font-bold text-purple-700">{detailedStats.recent_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Filter Tabs */}
            <div className="flex space-x-4">
              {[
                { key: 'all', label: 'All', count: stats.total },
                { key: 'unread', label: 'Unread', count: stats.unread },
                { key: 'read', label: 'Read', count: stats.read }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                    filter === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {label}
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    filter === key ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              {/* Bulk Actions */}
              {selectedNotifications.length > 0 && (
                <div className="flex items-center space-x-2">

                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Bulk Actions ({selectedNotifications.length})
                  </button>

                  {showBulkActions && (
                    <div className="absolute mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                      <div className="p-2">
                        <button
                          onClick={bulkMarkAsRead}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                        >
                          <CheckCheck className="w-4 h-4 mr-2" />
                          Mark as Read
                        </button>
                        <button
                          onClick={bulkDeleteNotifications}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Selected
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              {stats.unread > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark All Read
                </button>
              )}

              <button
                onClick={exportNotifications}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>

              <button
                onClick={() => loadNotifications(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'unread'
                  ? 'All caught up! No unread notifications.'
                  : filter === 'read'
                  ? 'No read notifications yet.'
                  : 'You have no notifications yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {/* Select All Checkbox */}
              {filteredNotifications.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                      onChange={selectAllNotifications}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({selectedNotifications.length > 0 ? selectedNotifications.length : 0})
                    </span>
                  </label>
                </div>
              )}

              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50 bg-opacity-30' : ''
                  }`}
                  onClick={() => quickMarkAsRead(notification)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Checkbox and Icon */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleNotificationSelection(notification.id);
                        }}
                        className="rounded border-gray-300 text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-900 pr-4">
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                            {notification.message}
                          </p>

                          {/* Leave Request Details */}
                          {notification.leave_request && (
                            <div className="bg-blue-50 p-3 rounded-lg mb-3 border-l-4 border-blue-400">
                              <h5 className="text-sm font-medium text-blue-900 mb-1">Leave Request Details</h5>
                              <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                                <div>
                                  <span className="font-medium">Type:</span> {notification.leave_request.leave_type}
                                </div>
                                <div>
                                  <span className="font-medium">Status:</span> {notification.leave_request.status.replace('_', ' ')}
                                </div>
                                <div>
                                  <span className="font-medium">Days:</span> {notification.leave_request.total_days}
                                </div>
                                <div>
                                  <span className="font-medium">Period:</span> {notification.leave_request.start_date} - {notification.leave_request.end_date}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center text-xs text-gray-500">
                                <User className="w-3 h-3 mr-1" />
                                {new Date(notification.created_at).toLocaleDateString()} at{' '}
                                {new Date(notification.created_at).toLocaleTimeString()}
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getNotificationColor(notification.type)}`}>
                                {getTypeDisplay(notification.type)}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              {notification.leave_request_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log(`Navigate to ${notification.leave_request_id}`);
                                  }}
                                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200"
                                >
                                  <ArrowRight className="w-3 h-3 mr-1" />
                                  View
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="text-xs text-red-600 hover:text-red-500 font-medium p-1 hover:bg-red-50 rounded"
                                title="Delete notification"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
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

export default Notifications;