import { api } from './authService';

const settingsService = {
  // Get user preferences
  getUserPreferences: async (category = null) => {
    try {
      const params = category ? { category } : {};
      const response = await api.get('/settings/preferences', { params });
      return response.data;
    } catch (error) {
      console.error('Fetch user preferences error:', error);
      throw error;
    }
  },

  // Update user preferences
  updateUserPreferences: async (category, preferences) => {
    try {
      const response = await api.put('/settings/preferences', { category, preferences });
      return response.data;
    } catch (error) {
      console.error('Update user preferences error:', error);
      throw error;
    }
  },

  // Reset user preferences to defaults
  resetUserPreferences: async (category = null) => {
    try {
      const data = category ? { category } : {};
      const response = await api.delete('/settings/preferences', { data });
      return response.data;
    } catch (error) {
      console.error('Reset user preferences error:', error);
      throw error;
    }
  },

  // Get system settings (admin only)
  getSystemSettings: async (category = null) => {
    try {
      const params = category ? { category } : {};
      const response = await api.get('/settings/system', { params });
      return response.data;
    } catch (error) {
      console.error('Fetch system settings error:', error);
      throw error;
    }
  },

  // Update system setting (admin only)
  updateSystemSetting: async (key, value, description, category) => {
    try {
      const response = await api.put('/settings/system', {
        key,
        value,
        description,
        category
      });
      return response.data;
    } catch (error) {
      console.error('Update system setting error:', error);
      throw error;
    }
  }
};

export default settingsService;