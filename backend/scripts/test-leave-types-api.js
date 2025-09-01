#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';

async function testLeaveTypesAPI() {
  console.log('🔍 Testing Leave Types API...\n');

  try {
    // Login first to get token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@company.com',
      password: 'Admin123!'
    });

    const token = loginResponse.data.data.tokens.accessToken;
    console.log('✅ Login successful, token received\n');

    // Test leave types endpoint
    console.log('2. Testing /api/leaves/types...');
    const leaveTypesResponse = await axios.get(`${API_URL}/leaves/types`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('✅ API Response Status:', leaveTypesResponse.status);
    console.log('✅ Response Structure:');
    console.log(JSON.stringify(leaveTypesResponse.data, null, 2));

    if (leaveTypesResponse.data.success && leaveTypesResponse.data.data) {
      console.log('\n✅ Leave Types Found:');
      console.log('Number of leave types:', leaveTypesResponse.data.data.leave_types?.length || 0);
      if (leaveTypesResponse.data.data.leave_types?.length > 0) {
        console.log('\nSample leave types:');
        leaveTypesResponse.data.data.leave_types.forEach((type, index) => {
          console.log(`${index + 1}. ${type.name} (${type.type}) - ${type.annual_days} days`);
          console.log(`   Description: ${type.description}`);
          console.log(`   Notice period: ${type.notice_period_days} days`);
          console.log(`   Max consecutive: ${type.max_consecutive_days || 'Unlimited'} days`);
          console.log('');
        });
      }
    } else {
      console.log('❌ Invalid response structure');
    }

  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', error.response.data);
    }
  }
}

if (require.main === module) {
  testLeaveTypesAPI();
}

module.exports = { testLeaveTypesAPI };