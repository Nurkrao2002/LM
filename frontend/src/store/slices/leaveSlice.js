import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import leaveService from '../../services/leaveService';

// Initial state
const initialState = {
  requests: [],
  balances: [],
  types: [],
  statistics: {},
  monthlyUsage: [],
  currentRequest: null,
  pendingApprovals: [],
  isLoading: false,
  error: null,
  pagination: {
    current_page: 1,
    total_pages: 1,
    total_requests: 0,
    per_page: 10
  }
};

// Async thunks
export const fetchLeaveRequests = createAsyncThunk(
  'leave/fetchRequests',
  async (params, { rejectWithValue }) => {
    try {
      const response = await leaveService.getLeaveRequests(params);
      console.log('[DEBUG THUNK] fetchLeaveRequests - response:', response);
      console.log('[DEBUG THUNK] fetchLeaveRequests - response.data:', response?.data);
      console.log('[DEBUG THUNK] fetchLeaveRequests - response.data?.data:', response?.data?.data);
      console.log('[DEBUG THUNK] fetchLeaveRequests - response.data?.data?.requests:', response?.data?.data?.requests);
      return {
        requests: response.data.data.requests,
        pagination: response.data.data.pagination
      };
    } catch (error) {
      console.error('[DEBUG THUNK] fetchLeaveRequests - error:', error);
      console.error('[DEBUG THUNK] fetchLeaveRequests - error.response:', error?.response);
      console.error('[DEBUG THUNK] fetchLeaveRequests - error.response?.data:', error?.response?.data);
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch requests'
      );
    }
  }
);

export const fetchLeaveRequestById = createAsyncThunk(
  'leave/fetchRequestById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await leaveService.getLeaveRequestById(id);
      return response.data.data.request;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch request details'
      );
    }
  }
);

export const createLeaveRequest = createAsyncThunk(
  'leave/createRequest',
  async (requestData, { rejectWithValue }) => {
    console.log('[DEBUG] createLeaveRequest called with data:', requestData);
    console.log('[DEBUG] Leave type ID type:', typeof requestData.leave_type_id, 'value:', requestData.leave_type_id);
    console.log('[DEBUG] Dates - start:', requestData.start_date, 'end:', requestData.end_date);
    console.log('[DEBUG] Frontend total_days calculated:', requestData.total_days);
    console.log('[DEBUG] Emergency value:', requestData.emergency, 'type:', typeof requestData.emergency);
    try {
      const response = await leaveService.createLeaveRequest(requestData);
      console.log('[DEBUG] createLeaveRequest API response:', response);
      console.log('[DEBUG] createLeaveRequest response.data:', response.data);
      console.log('[DEBUG] createLeaveRequest response.data.data:', response.data?.data);

      // Try both response formats to handle API inconsistency
      const data = response.data?.data || response.data;
      console.log('[DEBUG] createLeaveRequest final data:', data);

      // Validate the critical fields are present
      if (!data) {
        throw new Error('No data returned from server');
      }
      if (!data.id) {
        console.warn('[DEBUG] Response data missing id field:', data);
      }

      return data;
    } catch (error) {
      console.error('[ERROR] createLeaveRequest failed:', error);
      console.error('[ERROR] Error response:', error.response);
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create request'
      );
    }
  }
);

export const createLeaveRequestOld = createAsyncThunk(
  'leave/createRequest',
  async (requestData, { rejectWithValue }) => {
    try {
      const response = await leaveService.createLeaveRequest(requestData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to create request'
      );
    }
  }
);

export const updateLeaveRequest = createAsyncThunk(
  'leave/updateRequest',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await leaveService.updateLeaveRequest(id, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to update request'
      );
    }
  }
);

export const cancelLeaveRequest = createAsyncThunk(
  'leave/cancelRequest',
  async (id, { rejectWithValue }) => {
    try {
      await leaveService.cancelLeaveRequest(id);
      return { id };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to cancel request'
      );
    }
  }
);

export const fetchLeaveBalances = createAsyncThunk(
  'leave/fetchBalances',
  async (year, { rejectWithValue }) => {
    try {
      console.log('[DEBUG] Fetching leave balances for year:', year);
      const response = await leaveService.getLeaveBalances(year);

      if (!response || !response.data) {
        console.warn('[BALANCE DEBUG] Fallback: Missing response or response.data');
        return [
          {
            name: 'Casual Leave',
            remaining_days: 12,
            used_days: 0,
            total_days: 12,
            pending_days: 0
          },
          {
            name: 'Health Leave',
            remaining_days: 12,
            used_days: 0,
            total_days: 12,
            pending_days: 0
          }
        ];
      }

      // Check for balances in the expected location based on backend structure
      if (!response.data.balances) {
        console.warn('[BALANCE DEBUG] Fallback: Missing response.data.balances');
        return [
          {
            name: 'Casual Leave',
            remaining_days: 12,
            used_days: 0,
            total_days: 12,
            pending_days: 0
          },
          {
            name: 'Health Leave',
            remaining_days: 12,
            used_days: 0,
            total_days: 12,
            pending_days: 0
          }
        ];
      }

      console.log('[DEBUG] Returning balances from API, count:', response.data.balances?.length ?? 'undefined');
      return response.data.balances;
    } catch (error) {
      console.warn('[BALANCE DEBUG] Error in fetchLeaveBalances:', error?.message);

      // Return fallback data on any error
      return [
        {
          name: 'Casual Leave',
          remaining_days: 12,
          used_days: 0,
          total_days: 12,
          pending_days: 0
        },
        {
          name: 'Health Leave',
          remaining_days: 12,
          used_days: 0,
          total_days: 12,
          pending_days: 0
        }
      ];
    }
  }
);

export const fetchLeaveTypes = createAsyncThunk(
  'leave/fetchTypes',
  async (_, { rejectWithValue }) => {
    try {
      console.log('DEBUG: Fetching leave types...');
      const response = await leaveService.getLeaveTypes();

      console.log('DEBUG: Raw leave types response:', response);

      if (!response?.data?.leave_types) {
        console.warn('DEBUG: API returned no leave types, using fallback data');
        // Return fallback leave types if API doesn't have data
        return [
          { id: 'fallback-casual', type: 'casual', name: 'Casual Leave', annual_days: 12, description: 'General personal or short-term absences' },
          { id: 'fallback-health', type: 'health', name: 'Health Leave', annual_days: 12, description: 'Medical or health-related absences' }
        ];
      }

      console.log('DEBUG: Returning API leave types');
      return response.data.leave_types;
    } catch (error) {
      console.warn('DEBUG: Error fetching leave types, using fallback:', error?.message);

      // Return fallback data on any error
      return [
        { id: 'fallback-casual', type: 'casual', name: 'Casual Leave', annual_days: 12, description: 'General personal or short-term absences' },
        { id: 'fallback-health', type: 'health', name: 'Health Leave', annual_days: 12, description: 'Medical or health-related absences' }
      ];
    }
  }
);

export const approveLeaveRequest = createAsyncThunk(
  'leave/approveRequest',
  async ({ id, level, comments }, { rejectWithValue }) => {
    try {
      let response;
      if (level === 'manager') {
        response = await leaveService.approveByManager(id, comments);
      } else if (level === 'admin') {
        response = await leaveService.approveByAdmin(id, comments);
      }
      return { id, level, ...response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to approve request'
      );
    }
  }
);

export const rejectLeaveRequest = createAsyncThunk(
  'leave/rejectRequest',
  async ({ id, level, comments }, { rejectWithValue }) => {
    try {
      let response;
      if (level === 'manager') {
        response = await leaveService.rejectByManager(id, comments);
      } else if (level === 'admin') {
        response = await leaveService.rejectByAdmin(id, comments);
      }
      return { id, level, ...response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to reject request'
      );
    }
  }
);

export const fetchPendingApprovals = createAsyncThunk(
  'leave/fetchPendingApprovals',
  async (_, { rejectWithValue }) => {
    try {
      const response = await leaveService.getPendingApprovals();
      return {
        approvals: response.data.data.requests,
        count: response.data.data.count
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch approvals'
      );
    }
  }
);

export const fetchLeaveStatistics = createAsyncThunk(
  'leave/fetchStatistics',
  async (year, { rejectWithValue }) => {
    try {
      const response = await leaveService.getLeaveStatistics(year);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch statistics'
      );
    }
  }
);

export const fetchMonthlyUsage = createAsyncThunk(
  'leave/fetchMonthlyUsage',
  async ({ year, month }, { rejectWithValue }) => {
    try {
      const response = await leaveService.getMonthlyUsage(year, month);
      return response.data.data.usage;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch monthly usage'
      );
    }
  }
);

// Redux slice
const leaveSlice = createSlice({
  name: 'leave',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentRequest: (state) => {
      state.currentRequest = null;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    resetState: (state) => {
      state.requests = [];
      state.balances = [];
      state.types = [];
      state.statistics = {};
      state.currentRequest = null;
      state.pendingApprovals = [];
      state.pagination = initialState.pagination;
    },
    updateLeaveBalanceLocally: (state, action) => {
      const { leaveType, type, days } = action.payload; // type: 'used', 'pending'
      const balanceIndex = state.balances.findIndex(
        balance => balance.type === leaveType
      );
      if (balanceIndex !== -1) {
        if (type === 'used') {
          state.balances[balanceIndex].used_days += days;
          state.balances[balanceIndex].remaining_days -= days;
        } else if (type === 'pending') {
          state.balances[balanceIndex].pending_days += days;
        }
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch requests
      .addCase(fetchLeaveRequests.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLeaveRequests.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.requests = action.payload.requests;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchLeaveRequests.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch single request
      .addCase(fetchLeaveRequestById.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchLeaveRequestById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.currentRequest = action.payload;
      })
      .addCase(fetchLeaveRequestById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Create request
      .addCase(createLeaveRequest.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createLeaveRequest.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        // Add to beginning of requests list with proper structure
        state.requests.unshift({
          ...action.payload,
          status: action.payload.status,
          created_at: action.payload.created_at,
          updated_at: action.payload.updated_at
        });
      })
      .addCase(createLeaveRequest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Update request
      .addCase(updateLeaveRequest.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateLeaveRequest.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        const index = state.requests.findIndex(req => req.id === action.payload.id);
        if (index !== -1) {
          state.requests[index] = action.payload;
        }
        if (state.currentRequest?.id === action.payload.id) {
          state.currentRequest = action.payload;
        }
      })
      .addCase(updateLeaveRequest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Cancel request
      .addCase(cancelLeaveRequest.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(cancelLeaveRequest.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        // Update status to cancelled
        const index = state.requests.findIndex(req => req.id === action.payload.id);
        if (index !== -1) {
          state.requests[index].status = 'cancelled';
        }
      })
      .addCase(cancelLeaveRequest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch balances
      .addCase(fetchLeaveBalances.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchLeaveBalances.fulfilled, (state, action) => {
        console.log('[DEBUG] Balances loaded successfully, count:', action.payload?.length ?? 'undefined');
        state.isLoading = false;
        state.error = null;
        state.balances = action.payload;
      })
      .addCase(fetchLeaveBalances.rejected, (state, action) => {
        console.log('[DEBUG] Balances fetch failed:', action.payload);
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch types
      .addCase(fetchLeaveTypes.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchLeaveTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.types = action.payload;
      })
      .addCase(fetchLeaveTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Approve request
      .addCase(approveLeaveRequest.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(approveLeaveRequest.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        const { id, level } = action.payload;
        const statusMap = {
          manager: 'manager_approved',
          admin: 'admin_approved'
        };

        // Update in requests list
        const index = state.requests.findIndex(req => req.id === id);
        if (index !== -1) {
          state.requests[index].status = statusMap[level];
          state.requests[index].updatedAt = new Date().toISOString();
        }
      })
      .addCase(approveLeaveRequest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Reject request
      .addCase(rejectLeaveRequest.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(rejectLeaveRequest.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        const { id, level } = action.payload;
        const statusMap = {
          manager: 'manager_rejected',
          admin: 'admin_rejected'
        };

        // Update in requests list
        const index = state.requests.findIndex(req => req.id === id);
        if (index !== -1) {
          state.requests[index].status = statusMap[level];
          state.requests[index].updatedAt = new Date().toISOString();
        }
      })
      .addCase(rejectLeaveRequest.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch pending approvals
            .addCase(fetchPendingApprovals.pending, (state) => {
              state.isLoading = true;
            })
            .addCase(fetchPendingApprovals.fulfilled, (state, action) => {
              state.isLoading = false;
              state.error = null;
              state.pendingApprovals = action.payload.approvals;
            })
            .addCase(fetchPendingApprovals.rejected, (state, action) => {
              state.isLoading = false;
              state.error = action.payload;
            })
      
            // Fetch statistics
            .addCase(fetchLeaveStatistics.pending, (state) => {
              state.isLoading = true;
            })
            .addCase(fetchLeaveStatistics.fulfilled, (state, action) => {
              state.isLoading = false;
              state.error = null;
              state.statistics = action.payload;
            })
            .addCase(fetchLeaveStatistics.rejected, (state, action) => {
              state.isLoading = false;
              state.error = action.payload;
            })

            // Fetch monthly usage
            .addCase(fetchMonthlyUsage.pending, (state) => {
              state.isLoading = true;
            })
            .addCase(fetchMonthlyUsage.fulfilled, (state, action) => {
              state.isLoading = false;
              state.error = null;
              state.monthlyUsage = action.payload;
            })
            .addCase(fetchMonthlyUsage.rejected, (state, action) => {
              state.isLoading = false;
              state.error = action.payload;
            });
  },
});

export const { clearError, clearCurrentRequest, setLoading, resetState, updateLeaveBalanceLocally } = leaveSlice.actions;

// Selectors
export const selectLeaveRequests = (state) => state.leave.requests;
export const selectLeaveBalances = (state) => state.leave.balances;
export const selectLeaveTypes = (state) => state.leave.types;
export const selectLeaveStatistics = (state) => state.leave.statistics;
export const selectMonthlyUsage = (state) => state.leave.monthlyUsage;
export const selectCurrentLeaveRequest = (state) => state.leave.currentRequest;
export const selectPendingApprovals = (state) => state.leave.pendingApprovals;
export const selectLeaveLoading = (state) => state.leave.isLoading;
export const selectLeaveError = (state) => state.leave.error;
export const selectLeavePagination = (state) => state.leave.pagination;

export default leaveSlice.reducer;