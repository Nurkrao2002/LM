import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import notificationService from '../../services/notificationService';

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  stats: {},
  isLoading: false,
  error: null,
  pagination: {
    current_page: 1,
    total_pages: 1,
    total_notifications: 0,
    per_page: 10
  }
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params, { rejectWithValue }) => {
    try {
      const response = await notificationService.getNotifications(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch notifications'
      );
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationService.getUnreadCount();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch unread count'
      );
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id, { rejectWithValue }) => {
    try {
      await notificationService.markAsRead(id);
      return { id };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to mark notification as read'
      );
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationService.markAllAsRead();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to mark all as read'
      );
    }
  }
);

export const fetchNotificationStats = createAsyncThunk(
  'notifications/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationService.getNotificationStats();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch notification stats'
      );
    }
  }
);

// Redux slice
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
    resetState: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.stats = {};
      state.pagination = initialState.pagination;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.notifications = action.payload.notifications;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch unread count
      .addCase(fetchUnreadCount.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unread_count;
        state.error = null;
      })
      .addCase(fetchUnreadCount.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Mark as read
      .addCase(markNotificationAsRead.pending, (state) => {
        state.error = null;
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        state.error = null;
        // Update unread count
        if (state.unreadCount > 0) {
          state.unreadCount -= 1;
        }
        // Update notification in list
        const notification = state.notifications.find(n => n.id === action.payload.id);
        if (notification) {
          notification.is_read = true;
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Mark all as read
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.error = null;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state, action) => {
        state.error = null;
        state.unreadCount = 0;
        // Update all notifications as read
        state.notifications.forEach(notification => {
          notification.is_read = true;
        });
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Fetch stats
      .addCase(fetchNotificationStats.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchNotificationStats.fulfilled, (state, action) => {
        state.stats = action.payload.stats;
        state.error = null;
      })
      .addCase(fetchNotificationStats.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearError, updateUnreadCount, resetState } = notificationSlice.actions;

// Selectors
export const selectNotifications = (state) => state.notifications.notifications;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationStats = (state) => state.notifications.stats;
export const selectNotificationLoading = (state) => state.notifications.isLoading;
export const selectNotificationError = (state) => state.notifications.error;
export const selectNotificationPagination = (state) => state.notifications.pagination;

export default notificationSlice.reducer;