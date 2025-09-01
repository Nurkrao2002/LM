import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';

// Initial state
const initialState = {
  currentUser: JSON.parse(localStorage.getItem('user')) || null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isLoading: false,
  error: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(email, password);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Login failed'
      );
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Registration failed'
      );
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { refreshToken } = getState().auth;
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const response = await authService.refreshToken(refreshToken);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Token refresh failed'
      );
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    try {
      await authService.logout();
    } catch (error) {
      // Even if logout fails on server, we clear local state
      console.error('Logout error:', error);
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await authService.updateProfile(profileData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Update failed'
      );
    }
  }
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser();
      return response.data.user;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || 'Failed to fetch profile'
      );
    }
  }
);

// Redux slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    logoutFromLocal: (state) => {
      state.currentUser = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.currentUser = action.payload.user;
        if (action.payload.tokens) {
          state.accessToken = action.payload.tokens.accessToken;
          state.refreshToken = action.payload.tokens.refreshToken;
          state.isAuthenticated = true;

          // Store in localStorage
          localStorage.setItem('user', JSON.stringify(action.payload.user));
          localStorage.setItem('accessToken', action.payload.tokens.accessToken);
          localStorage.setItem('refreshToken', action.payload.tokens.refreshToken);
        } else {
          state.isAuthenticated = false;
          state.accessToken = null;
          state.refreshToken = null;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // Register cases
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        // For new registration flow - don't auto-login user
        // User needs to wait for admin approval before they can login
        state.currentUser = null;
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
        // Don't store anything in localStorage for new registration
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // Refresh token cases
      .addCase(refreshToken.fulfilled, (state, action) => {
        if (action.payload && action.payload.accessToken) {
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken || state.refreshToken;
          localStorage.setItem('accessToken', action.payload.accessToken);
          if (action.payload.refreshToken) {
            localStorage.setItem('refreshToken', action.payload.refreshToken);
          }
        } else {
          state.accessToken = null;
          state.refreshToken = null;
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          state.isAuthenticated = false;
        }
      })
      .addCase(refreshToken.rejected, (state) => {
        // If refresh fails, logout user
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })

      // Logout case
      .addCase(logout.fulfilled, (state) => {
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })

      // Update profile cases
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        if (action.payload.user) {
          state.currentUser = action.payload.user;
          localStorage.setItem('user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch profile cases
      .addCase(fetchProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        if (action.payload) {
          // Update currentUser with fresh backend data
          state.currentUser = {
            ...state.currentUser,
            ...action.payload,
          };
          localStorage.setItem('user', JSON.stringify(state.currentUser));
        }
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setLoading, logoutFromLocal } = authSlice.actions;

// Selectors
export const selectCurrentUser = (state) => state.auth.currentUser;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.currentUser?.role;
export const selectHasRole = (roles) => (state) => {
  const userRole = state.auth.currentUser?.role;
  if (!userRole) return false;
  if (typeof roles === 'string') return roles === userRole;
  if (Array.isArray(roles)) return roles.includes(userRole);
  return false;
};

export default authSlice.reducer;