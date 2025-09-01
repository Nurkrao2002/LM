import React, { useState, useEffect } from 'react';
import { api } from '../services/authService';

const ApiTestComponent = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const testApiCalls = async () => {
    setLoading(true);
    const testResults = {};

    try {
      // Test 1: Base API connectivity
      const startTime1 = Date.now();
      const res1 = await api.get('/auth/me');
      const endTime1 = Date.now();
      testResults.authMe = { status: res1.status, duration: endTime1 - startTime1, data: res1.data };
    } catch (error) {
      testResults.authMe = {
        status: error.response?.status || 'ERROR',
        message: error.message,
        data: error.response?.data || error
      };
    }

    try {
      // Test 2: Leave types
      const startTime2 = Date.now();
      const res2 = await api.get('/leaves/types');
      const endTime2 = Date.now();
      testResults.leaveTypes = { status: res2.status, duration: endTime2 - startTime2, count: res2.data?.data?.leave_types?.length };
    } catch (error) {
      testResults.leaveTypes = {
        status: error.response?.status || 'ERROR',
        message: error.message,
        data: error.response?.data || error,
        url: error.config?.url
      };
    }

    try {
      // Test 3: Leave balances
      const startTime3 = Date.now();
      const res3 = await api.get('/leaves/balances');
      const endTime3 = Date.now();
      testResults.leaveBalances = { status: res3.status, duration: endTime3 - startTime3, count: res3.data?.data?.balances?.length };
    } catch (error) {
      testResults.leaveBalances = {
        status: error.response?.status || 'ERROR',
        message: error.message,
        data: error.response?.data || error,
        url: error.config?.url
      };
    }

    try {
      // Test 4: Leave requests
      const startTime4 = Date.now();
      const res4 = await api.get('/leaves');
      const endTime4 = Date.now();
      testResults.leaveRequests = { status: res4.status, duration: endTime4 - startTime4, count: res4.data?.data?.requests?.length };
    } catch (error) {
      testResults.leaveRequests = {
        status: error.response?.status || 'ERROR',
        message: error.message,
        data: error.response?.data || error,
        url: error.config?.url
      };
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">API Test Results</h2>

      <button
        onClick={testApiCalls}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test All API Calls'}
      </button>

      <div className="mt-6 space-y-4">
        {Object.entries(results).map(([endpoint, data]) => (
          <div key={endpoint} className="border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold capitalize">
                {endpoint.replace(/([A-Z])/g, ' $1')}
              </h3>
              <span className={`px-2 py-1 rounded text-sm font-medium ${
                data.status === 200 ? 'bg-green-100 text-green-800' :
                data.status >= 400 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {data.status}
              </span>
            </div>

            {data.duration && <div className="text-sm text-gray-600">Response time: {data.duration}ms</div>}
            {data.count !== undefined && <div className="text-sm text-gray-600">Items: {data.count}</div>}
            {data.url && <div className="text-sm text-gray-600 break-all">URL: {data.url}</div>}
            {data.message && <div className="text-sm text-red-600 mt-2">{data.message}</div>}

            {data.data && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-blue-600">Show Response Data</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(data.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {Object.keys(results).length === 0 && !loading && (
        <div className="mt-6 p-4 bg-gray-100 rounded text-center">
          Click "Test All API Calls" to check your API endpoints
        </div>
      )}
    </div>
  );
};

export default ApiTestComponent;