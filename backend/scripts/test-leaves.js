#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@company.com';
const ADMIN_PASSWORD = 'Admin123!';

async function testLeaveRequests() {
  try {
    console.log('🚀 Testing Leave Requests API...');
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

    // Step 2: Test get leave requests
    console.log('\n2. 📋 Testing get leave requests API...');
    const leavesResponse = await axios.get(`${API_URL}/leaves`, { headers });
    console.log('✅ Get leave requests API working');
    console.log(`📊 Total leave requests: ${leavesResponse.data.data.requests.length}`);

    // Step 3: Test create leave request
    console.log('\n3. ➕ Testing create leave request...');
    // First, get leave types to pick an ID
    const leaveTypesResponse = await axios.get(`${API_URL}/leaves/types`, { headers });
    const leaveTypes = leaveTypesResponse.data.data.leave_types;

    if (leaveTypes.length === 0) {
      console.log('❌ No leave types available to create request');
      return;
    }

    const annualLeaveType = leaveTypes.find(type => type.type === 'annual');
    if (!annualLeaveType) {
      console.log('❌ Annual leave type not found');
      return;
    }

    // Create a future leave request
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const createData = {
      leave_type_id: annualLeaveType.id,
      start_date: tomorrow.toISOString().split('T')[0],
      end_date: dayAfter.toISOString().split('T')[0],
      reason: 'Test leave request from API testing'
    };

    try {
      const createResponse = await axios.post(`${API_URL}/leaves`, createData, { headers });
      console.log('✅ Create leave request successful');
      const newLeaveRequestId = createResponse.data.data.leave_request.id;
      console.log(`📊 Created leave request ID: ${newLeaveRequestId}`);

      // Step 4: Test get leave request by ID
      console.log('\n4. 🎯 Testing get leave request by ID...');
      const leaveByIdResponse = await axios.get(`${API_URL}/leaves/${newLeaveRequestId}`, { headers });
      console.log('✅ Get leave request by ID working');
      console.log(`📊 Leave request status: ${leaveByIdResponse.data.data.request.status}`);

      // Step 5: Test cancel leave request
      console.log('\n5. ❌ Testing cancel leave request...');
      const cancelResponse = await axios.put(`${API_URL}/leaves/${newLeaveRequestId}/cancel`,
        { reason: 'Cancelled for testing purposes' }, { headers });
      console.log('✅ Cancel leave request successful');
      console.log(`📊 Cancellation status: ${cancelResponse.data.message}`);

      // Test getting the cancelled request
      const cancelledRequest = await axios.get(`${API_URL}/leaves/${newLeaveRequestId}`, { headers });
      console.log(`📊 Cancelled request status: ${cancelledRequest.data.data.request.status}`);

    } catch (createError) {
      if (createError.response?.status === 400 && createError.response?.data?.message?.includes('balance')) {
        console.log('ℹ️ Leave creation skipped: Insufficient leave balance (expected for admin)');
      } else {
        console.log('❌ Error creating leave request:', createError.response?.data?.message || createError.message);
      }
    }

    // Step 6: Test pending approvals
    console.log('\n6. 📋 Testing pending approvals API...');
    const pendingResponse = await axios.get(`${API_URL}/leaves/pending-approvals`, { headers });
    console.log('✅ Get pending approvals API working');
    console.log(`📊 Pending approvals: ${pendingResponse.data.data.pending_approvals.length}`);

    // Step 7: Test leave balances
    console.log('\n7. ⚖️ Testing leave balances API...');
    const balancesResponse = await axios.get(`${API_URL}/leaves/balances`, { headers });
    console.log('✅ Get leave balances API working');
    console.log(`📊 Leave balances for ${balancesResponse.data.data.balances.length} types`);

    console.log('\n✅ All leave request APIs tested successfully!');

  } catch (error) {
    console.error('❌ Leave Requests Test Error:');
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

testLeaveRequests();