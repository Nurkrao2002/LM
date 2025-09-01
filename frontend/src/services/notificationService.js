import { api } from './authService';

// Notification API endpoints
const notificationService = {
  // Get user notifications
  getNotifications: async (params = {}) => {
    const queryParams = new URLSearchParams();

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryParams.append(key, params[key]);
      }
    });

    const response = await api.get(`/notifications?${queryParams.toString()}`);
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (id) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    const response = await api.put('/notifications/mark-all-read');
    return response.data;
  },

  // Delete notification
  deleteNotification: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  // Get unread notifications count
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  // Get notification statistics
  getNotificationStats: async () => {
    const response = await api.get('/notifications/stats');
    return response.data;
  }
};

export default notificationService;