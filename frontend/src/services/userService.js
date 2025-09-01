import { api } from './authService';

const userService = {
  // Get all users with pagination and filtering
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      console.error('Fetch users error:', error);
      throw error;
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Fetch user by ID error:', error);
      throw error;
    }
  },

  // Get current user profile
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      console.error('Fetch profile error:', error);
      throw error;
    }
  },

  // Update user profile
  updateUser: async (userId, userData) => {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  // Toggle user status (admin only)
  toggleUserStatus: async (userId, isActive) => {
    try {
      const response = await api.put(`/users/${userId}/toggle-status`, { is_active: isActive });
      return response.data;
    } catch (error) {
      console.error('Toggle user status error:', error);
      throw error;
    }
  },

  // Get team members (manager only)
  getTeamMembers: async (params = {}) => {
    try {
      const response = await api.get('/users/team', { params });
      return response.data;
    } catch (error) {
      console.error('Fetch team members error:', error);
      throw error;
    }
  },

  // Get user statistics
  getUserStats: async (userId) => {
    try {
      const response = await api.get(`/users/${userId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Fetch user stats error:', error);
      throw error;
    }
  },

  // Update current user profile
  updateProfile: async (profileData) => {
    const response = await api.put('/auth/me', profileData);
    return response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await api.put('/auth/change-password', passwordData);
    return response.data;
  },

  // Approve user account (admin/manager only)
  approveUser: async (userId) => {
    try {
      const response = await api.put(`/users/${userId}/approve`);
      return response.data;
    } catch (error) {
      console.error('Approve user error:', error);
      throw error;
    }
  },

  // Reject user account (admin/manager only)
  rejectUser: async (userId) => {
    try {
      const response = await api.put(`/users/${userId}/reject`);
      return response.data;
    } catch (error) {
      console.error('Reject user error:', error);
      throw error;
    }
  }
};

export default userService;