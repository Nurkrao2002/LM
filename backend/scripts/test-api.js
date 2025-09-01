#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'admin@company.com';
const TEST_PASSWORD = 'Admin123!';

async function testAPI() {
  try {
    console.log('🚀 Testing Leave Management API...');
    console.log(`📍 API URL: ${API_URL}`);
    console.log('');

    // Step 1: Login
    console.log('1. 🔐 Testing login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      const accessToken = loginResponse.data.data.tokens.accessToken;
      console.log(`📋 Access token received: ${accessToken.substring(0, 20)}...`);

      // Set up headers for subsequent requests
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      // Step 2: Test leave requests API
      console.log('\n2. 📋 Testing leave requests API...');
      const leavesResponse = await axios.get(`${API_URL}/leaves?limit=5`, { headers });
      console.log('✅ Leave requests API working');
      console.log(`📊 Returned ${leavesResponse.data.data.requests.length} requests`);

      // Step 3: Test leave types API
      console.log('\n3. 📝 Testing leave types API...');
      const typesResponse = await axios.get(`${API_URL}/leaves/types`, { headers });
      console.log('✅ Leave types API working');
      console.log(`📋 Found ${typesResponse.data.data.leave_types.length} leave types:`);
      typesResponse.data.data.leave_types.forEach(type => {
        console.log(`   - ${type.type}: ${type.name} (${type.annual_days} days)`);
      });

      // Step 4: Test leave balances API
      console.log('\n4. ⚖️ Testing leave balances API...');
      const balancesResponse = await axios.get(`${API_URL}/leaves/balances`, { headers });
      console.log('✅ Leave balances API working');
      console.log(`📊 Balance types: ${balancesResponse.data.data.balances.length}`);

      console.log('\n🎉 All APIs are working correctly!');

    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }

  } catch (error) {
    console.error('❌ API Test Error:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.data}`);
      console.error(`   Code: ${error.response.data?.code}`);
    } else if (error.request) {
      console.error('   Network error - No response received');
      console.error('   Make sure backend server is running on port 5000');
    } else {
      console.error(`   Message: ${error.message}`);
    }
  }
}

testAPI();