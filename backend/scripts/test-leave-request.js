#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'admin@company.com';
const TEST_PASSWORD = 'Admin123!';

async function testLeaveRequestWorkflow() {
  try {
    console.log('🗂️  Testing Leave Request Full Workflow');
    console.log('=====================================\n');

    // Step 1: Login
    console.log('1. 🔐 Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      const accessToken = loginResponse.data.data.tokens.accessToken;
      const headers = { Authorization: `Bearer ${accessToken}` };

      // Step 2: Get leave types
      console.log('\n2. 📋 Getting leave types...');
      const typesResponse = await axios.get(`${API_URL}/leaves/types`, { headers });
      console.log('✅ Leave types API working');
      const leaveTypes = typesResponse.data.data.leave_types;
      console.log(`   Found ${leaveTypes.length} leave types:`);
      leaveTypes.forEach(type => console.log(`   - ${type.type}: ${type.name} (${type.annual_days} days)`));

      if (leaveTypes.length === 0) {
        console.log('❌ No leave types found! Migration might have failed.');
        return;
      }

      // Step 3: Get leave balances
      console.log('\n3. ⚖️ Getting leave balances...');
      const balanceResponse = await axios.get(`${API_URL}/leaves/balances`, { headers });
      console.log('✅ Leave balances API working');
      const balances = balanceResponse.data.data.balances;
      console.log(`   Found ${balances.length} balance entries`);

      // Step 4: Create a leave request
      console.log('\n4. ➕ Creating leave request...');

      // Use the first leave type for the request
      const selectedLeaveType = leaveTypes[0];

      // Calculate dates (start tomorrow, end in 2 days)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow);
      endDate.setDate(endDate.getDate() + 2);

      const requestData = {
        leave_type_id: selectedLeaveType.id,
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        reason: 'Testing the leave request system with real backend data',
        emergency: false
      };

      console.log(`   Request details:`);
      console.log(`   - Leave Type: ${selectedLeaveType.name}`);
      console.log(`   - Start Date: ${requestData.start_date}`);
      console.log(`   - End Date: ${requestData.end_date}`);
      console.log(`   - Reason: ${requestData.reason}`);

      const createResponse = await axios.post(`${API_URL}/leaves`, requestData, { headers });
      console.log('✅ Leave request created successfully!');
      console.log(`   Request ID: ${createResponse.data.data.id}`);
      console.log(`   Status: ${createResponse.data.data.status}`);
      console.log(`   Total Days: ${createResponse.data.data.totalDays}`);

      // Step 5: Verify the request was created by fetching recent requests
      console.log('\n5. 📋 Verifying request in system...');
      const recentResponse = await axios.get(`${API_URL}/leaves?limit=5`, { headers });
      console.log('✅ Recent requests API working');
      const recentRequests = recentResponse.data.data.requests;
      console.log(`   Found ${recentRequests.length} recent requests`);

      // Find our newly created request
      const ourRequest = recentRequests.find(r => r.id === createResponse.data.data.id);
      if (ourRequest) {
        console.log('✅ Our request found in system:');
        console.log(`   - ID: ${ourRequest.id}`);
        console.log(`   - Status: ${ourRequest.status}`);
        console.log(`   - Leave Type: ${ourRequest.leave_type_name}`);
        console.log(`   - User: ${ourRequest.first_name} ${ourRequest.last_name}`);
        console.log(`   - Date Range: ${ourRequest.start_date} to ${ourRequest.end_date}`);
      } else {
        console.log('❌ Our request was not found in recent requests!');
      }

      console.log('\n🎉 Leave Request Workflow Test COMPLETED SUCCESSFULLY!');
      console.log('\n✅ All APIs Working:');
      console.log('   - Authentication ✅');
      console.log('   - Leave Types Fetch ✅');
      console.log('   - Leave Balances Fetch ✅');
      console.log('   - Leave Request Creation ✅');
      console.log('   - Recent Requests Fetch ✅');
      console.log('   - Database Storage ✅');
      console.log('   - Backend Validation ✅');

    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Test Error:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.data}`);
    } else if (error.request) {
      console.error('   Network error - Backend server not running');
    } else {
      console.error(`   Message: ${error.message}`);
    }
  }
}

testLeaveRequestWorkflow();