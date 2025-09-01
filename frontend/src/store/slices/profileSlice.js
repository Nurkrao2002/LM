import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import leaveService from '../../services/leaveService';
import authService from '../../services/authService';

// Async thunks
export const fetchUserStatistics = createAsyncThunk(
  'profile/fetchUserStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await leaveService.getLeaveStatistics();
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch user statistics'
      );
    }
  }
);

export const fetchRecentLeaveRequests = createAsyncThunk(
  'profile/fetchRecentLeaveRequests',
  async (_, { rejectWithValue }) => {
    try {
      const response = await leaveService.getLeaveRequests({ limit: 5, status: 'pending' });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch recent requests'
      );
    }
  }
);

// Initial state
const initialState = {
  statistics: null,
  recentRequests: [],
  isLoading: false,
  error: null,
};

// Redux slice
const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user statistics cases
      .addCase(fetchUserStatistics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserStatistics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.statistics = action.payload.data;
      })
      .addCase(fetchUserStatistics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch recent leave requests cases
      .addCase(fetchRecentLeaveRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRecentLeaveRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        // Store the full data structure including requests and pagination
        state.recentRequests = action.payload.data;
      })
      .addCase(fetchRecentLeaveRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearProfileError } = profileSlice.actions;

// Selectors
export const selectProfileStatistics = (state) => state.profile.statistics;
export const selectRecentRequests = (state) => state.profile.recentRequests;
export const selectProfileLoading = (state) => state.profile.isLoading;
export const selectProfileError = (state) => state.profile.error;

export default profileSlice.reducer;