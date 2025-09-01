import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import leaveReducer from './slices/leaveSlice';
import profileReducer from './slices/profileSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    leave: leaveReducer,
    profile: profileReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
        ],
      },
    }),
});

export default store;