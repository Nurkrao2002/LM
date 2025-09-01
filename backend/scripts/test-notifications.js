#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@company.com';
const ADMIN_PASSWORD = 'Admin123!';

async function testNotifications() {
  try {
    console.log('🚀 Testing Notifications API...');
    console.log(`📍 API URL: ${API_URL}`);
    console.log('');

    // Step 1: Login as admin
    console.log('1. 🔐 Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }

    console.log('✅ Login successful');
    const accessToken = loginResponse.data.data.tokens.accessToken;
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Step 2: Test get notifications
    console.log('\n2. 📋 Testing get notifications API...');
    const notificationsResponse = await axios.get(`${API_URL}/notifications?limit=10`, { headers });
    console.log('✅ Get notifications API working');
    console.log(`📊 Total notifications: ${notificationsResponse.data.data.notifications.length}`);

    // Step 3: Test get stats
    console.log('\n3. 📊 Testing notifications stats API...');
    try {
      const statsResponse = await axios.get(`${API_URL}/notifications/stats`, { headers });
      console.log('✅ Get notifications stats API working');
      console.log('📊 Notification stats:', statsResponse.data.data.stats);
    } catch (statsError) {
      if (statsError.response?.status === 404) {
        console.log('ℹ️ Stats endpoint not found (may not be implemented)');
      } else {
        console.log('❌ Error getting stats:', statsError.response?.data?.message || statsError.message);
      }
    }

    // Step 4: Test mark as read (if there are notifications)
    if (notificationsResponse.data.data.notifications.length > 0) {
      console.log('\n4. ✅ Testing mark notification as read...');
      const firstNotification = notificationsResponse.data.data.notifications[0];
      try {
        const markReadResponse = await axios.put(
          `${API_URL}/notifications/${firstNotification.id}/read`,
          {},
          { headers }
        );
        console.log('✅ Mark as read API working');
        console.log(`📊 Notification marked as read: ${markReadResponse.data.message}`);
      } catch (markError) {
        if (markError.response?.status === 404) {
          console.log('ℹ️ Mark as read endpoint not found (may not be implemented)');
        } else {
          console.log('❌ Error marking as read:', markError.response?.data?.message || markError.message);
        }
      }
    } else {
      console.log('\n4. ℹ️ No notifications to test mark as read');
    }

    console.log('\n✅ Notification API testing completed!');

  } catch (error) {
    console.error('❌ Notifications Test Error:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.data}`);
    } else if (error.request) {
      console.error('   Network error - No response received');
      console.error('   Make sure backend server is running on port 5000');
    } else {
      console.error(`   Message: ${error.message}`);
    }
  }
}

testNotifications();