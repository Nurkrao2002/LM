#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@company.com';
const ADMIN_PASSWORD = 'Admin123!';

async function testUsersAPI() {
  try {
    console.log('🚀 Testing Users Management API...');
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
    console.log(`📋 Access token received: ${accessToken.substring(0, 20)}...`);

    // Set up headers for subsequent requests
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Test get users
    console.log('\n2. 👥 Testing get users API...');
    const usersResponse = await axios.get(`${API_URL}/users?limit=10`, { headers });
    console.log('✅ Get users API working');
    console.log(`📊 Returned ${usersResponse.data.data.users.length} users`);

    // Show some user info
    if (usersResponse.data.data.users.length > 0) {
      console.log('Users:');
      usersResponse.data.data.users.slice(0, 3).forEach(user => {
        console.log(`   - ${user.first_name} ${user.last_name} (${user.role}, ${user.status})`);
      });
    }

    // Step 3: Test get team (only for managers/employees)
    console.log('\n3. 👔 Testing team members API...');
    try {
      const teamResponse = await axios.get(`${API_URL}/users/team?limit=5`, { headers });
      console.log('✅ Team members API working (admin access)');
      console.log(`📊 Team members: ${teamResponse.data.data.members.length}`);
    } catch (teamError) {
      if (teamError.response?.status === 403) {
        console.log('ℹ️ Team API not accessible to admin (expected for non-employee roles)');
      } else {
        console.log('❌ Team API error:', teamError.response?.data?.message || teamError.message);
      }
    }

    // Step 4: Test get user by ID
    if (usersResponse.data.data.users.length > 0) {
      console.log('\n4. 🎯 Testing get user by ID...');
      const firstUser = usersResponse.data.data.users[0];
      const userByIdResponse = await axios.get(`${API_URL}/users/${firstUser.id}`, { headers });
      console.log('✅ Get user by ID working');
      console.log(`📊 User: ${userByIdResponse.data.data.user.first_name} ${userByIdResponse.data.data.user.last_name}`);
    }

    console.log('\n✅ Users management APIs are working correctly!');

  } catch (error) {
    console.error('❌ Users API Test Error:');
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

testUsersAPI();