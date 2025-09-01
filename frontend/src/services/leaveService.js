import { api } from './authService';

// Leave Request API endpoints with retry logic and better error handling
const leaveService = {

  // Retry wrapper for API calls
  withRetry: async (apiCall, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        if (attempt === maxRetries || error.response?.status < 500) {
          throw error;
        }
        console.log(`API call failed, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  },

  // Get leave requests with filtering and improved error handling
  getLeaveRequests: async (params = {}) => {
    return leaveService.withRetry(async () => {
      const queryParams = new URLSearchParams();

      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      });

      const response = await api.get(`/leaves?${queryParams.toString()}`);
      return response.data;
    });
  },

  // Get leave request by ID with improved error handling
  getLeaveRequestById: async (id) => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.get(`/leaves/${id}`);
      return response.data;
    });
  },

  // Create new leave request with validation
  createLeaveRequest: async (requestData) => {
    if (!requestData) throw new Error('Request data is required');

    // Client-side validation
    const requiredFields = ['leave_type_id', 'start_date', 'end_date'];
    for (const field of requiredFields) {
      if (!requestData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    return leaveService.withRetry(async () => {
      const response = await api.post('/leaves', requestData);
      return response.data;
    });
  },

  // Update leave request (if needed)
  updateLeaveRequest: async (id, updateData) => {
    if (!id || !updateData) throw new Error('ID and update data are required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}`, updateData);
      return response.data;
    });
  },

  // Cancel leave request with reason support
  cancelLeaveRequest: async (id, reason = '') => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}/cancel`, { reason });
      return response.data;
    });
  },

  // Get leave balances with retry logic and monthly usage
  getLeaveBalances: async (year) => {
    const yearParam = year || new Date().getFullYear();

    return leaveService.withRetry(async () => {
      const response = await api.get(`/leaves/balances?year=${yearParam}`);
      return response.data;
    });
  },

  // Get monthly usage information for current user
  getMonthlyUsage: async (year = null, month = null) => {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    return leaveService.withRetry(async () => {
      const response = await api.get(`/leaves/monthly-usage?year=${currentYear}&month=${currentMonth}`);
      return response.data;
    });
  },

  // Get available leave types
  getLeaveTypes: async () => {
    return leaveService.withRetry(async () => {
      const response = await api.get('/leaves/types');
      return response.data;
    });
  },

  // Approve leave request (Manager) with retry logic
  approveByManager: async (id, comments = '') => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}/approve/manager`, { comments });
      return response.data;
    });
  },

  // Reject leave request (Manager)
  rejectByManager: async (id, reason = '') => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}/reject/manager`, { reason });
      return response.data;
    });
  },

  // Approve leave request (Admin)
  approveByAdmin: async (id, comments = '') => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}/approve/admin`, { comments });
      return response.data;
    });
  },

  // Reject leave request (Admin)
  rejectByAdmin: async (id, reason = '') => {
    if (!id) throw new Error('Leave request ID is required');

    return leaveService.withRetry(async () => {
      const response = await api.put(`/leaves/${id}/reject/admin`, { reason });
      return response.data;
    });
  },

  // Get pending approvals with role-based filtering
  getPendingApprovals: async () => {
    return leaveService.withRetry(async () => {
      const response = await api.get('/leaves/pending-approvals');
      return response.data;
    });
  },

  // Get leave statistics with error handling
  getLeaveStatistics: async (year) => {
    const yearParam = year || new Date().getFullYear();

    return leaveService.withRetry(async () => {
      const response = await api.get(`/leaves/statistics?year=${yearParam}`);
      return response.data;
    });
  },

  // Enhanced error handling helper
  handleApiError: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unknown error occurred';
  },

  // Validate leave request with improved error handling
  validateLeaveRequest: async (requestData) => {
    if (!requestData) throw new Error('Request data is required');

    return leaveService.withRetry(async () => {
      const response = await api.post('/leaves/validate', requestData);
      return response.data;
    }).catch(error => {
      const errorMessage = leaveService.handleApiError(error);
      throw new Error(`Validation failed: ${errorMessage}`);
    });
  }
};

export { leaveService };

export default leaveService;