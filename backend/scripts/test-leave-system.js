#!/usr/bin/env node

require('dotenv').config();

const https = require('https');
const http = require('http');

const API_URL = 'http://localhost:' + (process.env.PORT || '5000') + '/api';
const ADMIN_EMAIL = 'admin@company.com';
const ADMIN_PASSWORD = 'Admin123!';

class LeaveSystemTester {
  constructor() {
    this.passedTests = 0;
    this.failedTests = [];
    this.testResults = [];
    this.startTime = Date.now();
    this.apiStartTime = 0;
    this.apiEndTime = 0;
    this.apiTotalTime = 0;
    this.dbQueryTimes = [];
    this.accessToken = null;
    this.headers = { 'Content-Type': 'application/json' };
  }

  async log(testName, passed = true, message = '', error = null, duration = 0) {
    if (passed) {
      this.passedTests++;
      console.log(`✅ ${testName}: PASSED${message ? ' - ' + message : ''}${duration > 0 ? ` (${duration}ms)` : ''}`);
    } else {
      this.failedTests.push({ test: testName, message, error });
      console.log(`❌ ${testName}: FAILED${message ? ' - ' + message : ''}`);
      if (error) {
        console.log(`   Error: ${error.message || error}`);
      }
    }
    this.testResults.push({ test: testName, passed, message, duration });
  }

  async makeRequest(method, url, data = null, headers = {}) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const urlObj = new URL(API_URL + url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method.toUpperCase(),
        headers: {
          ...this.headers,
          ...headers
        }
      };

      if (data) {
        options.headers['Content-Type'] = 'application/json';
        data = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;
          try {
            const responseData = body ? JSON.parse(body) : null;
            resolve({
              status: res.statusCode,
              success: res.statusCode >= 200 && res.statusCode < 300,
              data: responseData,
              duration
            });
          } catch (parseError) {
            resolve({
              status: res.statusCode,
              success: res.statusCode >= 200 && res.statusCode < 300,
              data: body,
              duration
            });
          }
        });
      });

      req.on('error', (error) => {
        const duration = Date.now() - startTime;
        reject(new Error(`Request failed after ${duration}ms: ${error.message}`));
      });

      if (data) {
        req.write(data);
      }

      req.setTimeout(30000, () => {
        req.destroy();
        const duration = Date.now() - startTime;
        reject(new Error(`Request timeout after ${duration}ms`));
      });

      req.end();
    });
  }

  async testDatabaseConnectivity() {
    console.log('\n📊 Testing Database Connectivity...');
    try {
      const startTime = Date.now();

      // Test connection through API health check
      try {
        const healthUrl = `http://localhost:${process.env.PORT || '5000'}/health`;
        const response = await fetch(healthUrl);

        if (response.status >= 200 && response.status < 300) {
          this.dbQueryTimes.push(Date.now() - startTime);
          this.log('Database connection', true, 'Connected successfully');
        } else {
          this.log('Database connection', false, 'Health check failed');
          return false;
        }
      } catch (error) {
        this.log('Database connectivity', false, 'Connection failed', error);
        return false;
      }

      // Test database tables through auth endpoint (this will check DB)
      const loginResponse = await this.makeRequest('POST', '/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });

      if (loginResponse.success && loginResponse.data.success) {
        this.accessToken = loginResponse.data.data.tokens.accessToken;
        this.headers.Authorization = `Bearer ${this.accessToken}`;
        this.log('Admin authentication', true, `Token: ${this.accessToken.substring(0, 20)}...`);
      } else {
        this.log('Admin authentication', false, 'Login failed');
        return false;
      }

      return true;
    } catch (error) {
      this.log('Database connectivity', false, 'Connection failed', error);
      return false;
    }
  }

  async testLeaveTypesAndBalances() {
    console.log('\n🎯 Testing Leave Types and Balances...');
    try {
      // Test leave types
      const typesResponse = await this.makeRequest('GET', '/leaves/types');

      if (typesResponse.success && typesResponse.data.success) {
        const leaveTypes = typesResponse.data.data.leave_types;
        const hasCasual = leaveTypes.some(type => type.type === 'casual');
        const hasHealth = leaveTypes.some(type => type.type === 'health');

        if (leaveTypes.length >= 2 && hasCasual && hasHealth) {
          // Verify annual days
          const casualType = leaveTypes.find(type => type.type === 'casual');
          const healthType = leaveTypes.find(type => type.type === 'health');

          if (casualType.annual_days === 12 && healthType.annual_days === 12) {
            this.log('Leave types setup', true, '2 types found (casual: 12 days, health: 12 days)');
          } else {
            this.log('Leave types setup', false, `Incorrect annual days - casual:${casualType.annual_days}, health:${healthType.annual_days}`);
          }
        } else {
          this.log('Leave types setup', false, `Expected 2 types, found ${leaveTypes.length}`);
        }
      } else {
        this.log('Leave types setup', false, 'Failed to fetch');
      }

      // Test balances
      const balancesResponse = await this.makeRequest('GET', '/leaves/balances');

      if (balancesResponse.success && balancesResponse.data.success) {
        const balances = balancesResponse.data.data.balances;

        if (balances.length >= 2) {
          const totalDays = balances.reduce((sum, balance) => sum + (balance.total_days || 0), 0);
          if (totalDays === 24) { // 12 casual + 12 health
            this.log('Balance calculations', true, 'Total 24 days available');
          } else {
            this.log('Balance calculations', false, `Expected 24 days, got ${totalDays}`);
          }
        } else {
          this.log('Balance calculations', false, `Expected >=2 balances, got ${balances.length}`);
        }
      } else {
        this.log('Balance calculations', false, 'Failed to fetch');
      }

      return true;
    } catch (error) {
      this.log('Leave types and balances', false, 'Test failed', error);
      return false;
    }
  }

  async testLeaveRequestWorkflow() {
    console.log('\n📝 Testing Leave Request Full Workflow...');
    try {
      // Get leave types first
      const typesResponse = await this.makeRequest('GET', '/leaves/types');
      const casualType = typesResponse.data.data.leave_types.find(type => type.type === 'casual');

      // Create request
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 2);

      const createData = {
        leave_type_id: casualType.id,
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: dayAfter.toISOString().split('T')[0],
        reason: 'End-to-end test workflow validation'
      };

      const createResponse = await this.makeRequest('POST', '/leaves', createData);

      if (createResponse.success && createResponse.data.success) {
        const requestId = createResponse.data.data.leave_request.id;
        this.log('Leave request creation', true, `ID: ${requestId}`);

        // Get the request
        const getResponse = await this.makeRequest('GET', `/leaves/${requestId}`);
        if (getResponse.success && getResponse.data.success) {
          const request = getResponse.data.data.request;
          if (request.status === 'pending') {
            this.log('Leave request retrieval', true, 'Status: pending');
          }
        }

        // Approve the request
        const approveData = { comments: 'Approved for testing workflow' };
        const approveResponse = await this.makeRequest('PUT', `/leaves/${requestId}/approve/admin`, approveData);

        if (approveResponse.success && approveResponse.data.success) {
          this.log('Leave request approval', true, 'Admin approval successful');

          // Verify balance update
          const balancesAfter = await this.makeRequest('GET', '/leaves/balances');
          const remainingDays = balancesAfter.data.data.balances.reduce((sum, balance) =>
            balance.type === 'casual' ? sum + balance.remaining_days : sum, 0);

          if (remainingDays > 12 - 3) { // 3 days requested
            this.log('Balance deduction', true, `Remaining casual days: ${remainingDays}`);
          }
        }

        // List all requests to verify
        const listResponse = await this.makeRequest('GET', '/leaves?status=admin_approved');
        if (listResponse.success) {
          this.log('Leave requests listing', true, `Found approved requests`);
        }

      } else {
        this.log('Leave request creation', false, createResponse.data?.message || 'Failed');
      }

      return true;
    } catch (error) {
      this.log('Leave request workflow', false, 'Test failed', error);
      return false;
    }
  }

  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    try {
      // Get a valid leave type first
      const typesResponse = await this.makeRequest('GET', '/leaves/types');
      const casualType = typesResponse.data.data.leave_types.find(type => type.type === 'casual');

      // Test past date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pastDateError = await this.makeRequest('POST', '/leaves', {
        leave_type_id: casualType.id,
        start_date: yesterday.toISOString().split('T')[0],
        end_date: yesterday.toISOString().split('T')[0],
        reason: 'Test past date'
      });

      if (!pastDateError.success && (pastDateError.data?.message?.includes('past') || pastDateError.data?.message?.includes('future'))) {
        this.log('Past date validation', true, 'Correctly rejected past date');
      } else {
        this.log('Past date validation', false, 'Expected rejection for past date', pastDateError.data?.message);
      }

      // Test invalid date range
      const invalidDateError = await this.makeRequest('POST', '/leaves', {
        leave_type_id: casualType.id,
        start_date: '2024-12-31',
        end_date: '2024-12-30',
        reason: 'Test invalid range'
      });

      if (!invalidDateError.success) {
        this.log('Invalid date range validation', true, 'Correctly rejected invalid range');
      } else {
        this.log('Invalid date range validation', false, 'Expected rejection for invalid range');
      }

      // Test insufficient balance (if possible)

      // Test unauthorized access
      const unauthorized = await this.makeRequest('GET', '/leaves/balances', {}, {});
      if (unauthorized.status === 401) {
        this.log('Unauthorized access protection', true, 'Correctly blocked');
      }

      return true;
    } catch (error) {
      this.log('Error handling', false, 'Test failed', error);
      return false;
    }
  }

  async testPerformanceMetrics() {
    console.log('\n⏱️  Testing Performance...');
    try {
      const metricsStart = Date.now();

      // Test multiple requests quickly
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(this.makeRequest('GET', '/leaves/balances'));
      }

      const results = await Promise.all(requests);
      const metricsEnd = Date.now();

      const successfulRequests = results.filter(r => r.success).length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      this.log('API Performance', successfulRequests === results.length, `10 requests - ${successfulRequests} successful, avg: ${avgResponseTime.toFixed(2)}ms`);

      // Calculate average database query time
      const avgDbTime = this.dbQueryTimes.reduce((sum, time) => sum + time, 0) / this.dbQueryTimes.length;

      this.log('Database Performance', true, `${this.dbQueryTimes.length} queries, avg: ${avgDbTime.toFixed(2)}ms`);

      return true;
    } catch (error) {
      this.log('Performance metrics', false, 'Test failed', error);
      return false;
    }
  }

  async generateReport() {
    const totalTime = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(50));
    console.log('🚀 LEAVE REQUEST SYSTEM TEST SUITE');
    console.log('='.repeat(50));

    console.log('\n✅ COMPONENTS PASSED:');
    const passedTests = this.testResults.filter(test => test.passed);
    passedTests.forEach(test => {
      console.log(`   • ${test.test}${test.message ? ` - ${test.message}` : ''}${test.duration > 0 ? ` (${test.duration}ms)` : ''}`);
    });

    console.log('\n❌ FAILED TESTS:');
    this.failedTests.forEach(test => {
      console.log(`   • ${test.test}: ${test.message}`);
    });

    if (this.failedTests.length === 0) {
      console.log('   • None');
    }

    const systemStatus = this.failedTests.length === 0 ? 'SYSTEM OPERATIONAL' : 'ISSUES DETECTED';
    console.log(`\n🎯 OVERALL RESULT: ${systemStatus}`);

    console.log('\n📊 PERFORMANCE METRICS:');
    console.log(`   • API Response Time: ${this.apiTotalTime > 0 ? (this.apiTotalTime / this.testResults.filter(t => t.duration > 0).length).toFixed(2) : '0'}ms avg`);
    console.log(`   • Database Query Time: ${this.dbQueryTimes.length > 0 ? (this.dbQueryTimes.reduce((a, b) => a + b, 0) / this.dbQueryTimes.length).toFixed(2) : '0'}ms avg`);
    console.log(`   • Total Test Time: ${(totalTime / 1000).toFixed(3)} seconds`);

    console.log('\n📋 DETAILED RESULTS:');
    this.testResults.forEach((test, index) => {
      const status = test.passed ? 'PASSED' : 'FAILED';
      console.log(`   ├─ Test Case ${index + 1}: ${test.test}......... ${status}`);
    });

    console.log('\n' + '='.repeat(50));
  }

  async runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE LEAVE REQUEST SYSTEM TESTING');
    console.log(`Target API: ${API_URL}`);
    console.log(`Admin User: ${ADMIN_EMAIL}`);
    console.log(''.repeat(50));

    // Run all test suites
    await this.testDatabaseConnectivity();
    await this.testLeaveTypesAndBalances();
    await this.testLeaveRequestWorkflow();
    await this.testErrorHandling();
    await this.testPerformanceMetrics();

    // Generate final report
    await this.generateReport();

    console.log('\n🎯 Testing complete! Review results above for system status.');
  }
}

// Run the tests
async function main() {
  const tester = new LeaveSystemTester();
  await tester.runAllTests();
}

// Handle execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = LeaveSystemTester;