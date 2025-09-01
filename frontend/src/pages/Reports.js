import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectHasRole } from '../store/slices/authSlice';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';

// Mock data for charts
const monthlyData = [
  { month: 'Jan', requests: 12, approved: 10, rejected: 2 },
  { month: 'Feb', requests: 18, approved: 15, rejected: 3 },
  { month: 'Mar', requests: 25, approved: 22, rejected: 3 },
  { month: 'Apr', requests: 20, approved: 18, rejected: 2 },
  { month: 'May', requests: 22, approved: 20, rejected: 2 },
  { month: 'Jun', requests: 30, approved: 28, rejected: 2 }
];

const leaveTypeData = [
  { name: 'Annual Leave', value: 45, color: '#3B82F6' },
  { name: 'Sick Leave', value: 25, color: '#EF4444' },
  { name: 'Personal Leave', value: 20, color: '#10B981' },
  { name: 'Emergency Leave', value: 10, color: '#F59E0B' }
];

const departmentData = [
  { name: 'Engineering', employees: 20, leaveDays: 45, avgLeave: 2.25 },
  { name: 'Marketing', employees: 12, leaveDays: 28, avgLeave: 2.33 },
  { name: 'Sales', employees: 15, leaveDays: 35, avgLeave: 2.33 },
  { name: 'HR', employees: 8, leaveDays: 20, avgLeave: 2.5 },
  { name: 'Finance', employees: 10, leaveDays: 25, avgLeave: 2.5 }
];

const currentYearStats = {
  totalRequests: 127,
  approvedRequests: 113,
  rejectedRequests: 14,
  averageApprovalTime: 2.3, // days
  totalLeaveDays: 153,
  utilizationRate: 75.2
};

const Reports = () => {
  const isAdmin = useSelector(selectHasRole('admin'));
  const isManager = useSelector(selectHasRole('manager'));

  const [timeRange, setTimeRange] = useState('6months');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [reportType, setReportType] = useState('overview');

  // Check if user has access to reports
  if (!isAdmin && !isManager) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-red-700">
                You don't have permission to view reports. Only managers and administrators can access this page.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleExportReport = (format) => {
    console.log(`Exporting ${reportType} report as ${format}`);
    // Implement export functionality
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive analytics for leave management and workforce insights
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => console.log('Refresh data')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => handleExportReport('pdf')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </button>
            <button
              onClick={() => handleExportReport('csv')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Requests</div>
              <div className="text-2xl font-bold text-gray-900">{currentYearStats.totalRequests}</div>
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="ml-1 text-sm text-green-600">+12%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Approved</div>
              <div className="text-2xl font-bold text-gray-900">{currentYearStats.approvedRequests}</div>
              <div className="text-sm text-green-600">
                {Math.round((currentYearStats.approvedRequests / currentYearStats.totalRequests) * 100)}% approval rate
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Leave Days</div>
              <div className="text-2xl font-bold text-gray-900">{currentYearStats.totalLeaveDays}</div>
              <div className="text-sm text-purple-600">This year</div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Avg Processing Time</div>
              <div className="text-2xl font-bold text-gray-900">{currentYearStats.averageApprovalTime}d</div>
              <div className="text-sm text-yellow-600">Per request</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Monthly Trends</h3>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="12months">Last 12 months</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="requests" stackId="1" stroke="#3B82F6" fill="#3B82F6" />
              <Area type="monotone" dataKey="approved" stackId="1" stroke="#10B981" fill="#10B981" />
              <Area type="monotone" dataKey="rejected" stackId="1" stroke="#EF4444" fill="#EF4444" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Leave Type Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <PieChartIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Leave Types Distribution</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leaveTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {leaveTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Department Overview */}
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Department Statistics</h3>
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="marketing">Marketing</option>
              <option value="sales">Sales</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Days Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Leave Days
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {departmentData.map((dept, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dept.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dept.employees}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dept.leaveDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dept.avgLeave}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Detailed Analytics</h3>
          <div className="flex items-center space-x-2">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="overview">Overview</option>
              <option value="leave-types">Leave Types</option>
              <option value="departments">Departments</option>
              <option value="trends">Trends</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Approval Rate</div>
                <div className="text-lg font-bold text-gray-900">
                  {Math.round((currentYearStats.approvedRequests / currentYearStats.totalRequests) * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Active Employees</div>
                <div className="text-lg font-bold text-gray-900">65</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-purple-500" />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Monthly Avg</div>
                <div className="text-lg font-bold text-gray-900">21.2</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingDown className="w-8 h-8 text-orange-500" />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">Decline Rate</div>
                <div className="text-lg font-bold text-gray-900">
                  {Math.round((currentYearStats.rejectedRequests / currentYearStats.totalRequests) * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insights & Recommendations */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Insights & Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <TrendingUp className="w-5 h-5 text-green-500 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Increasing Trend</h4>
                <p className="text-sm text-gray-600">
                  Leave requests have increased by 15% compared to last year,
                  indicating higher employee engagement with the system.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-blue-500 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Fast Processing</h4>
                <p className="text-sm text-gray-600">
                  Average approval time of {currentYearStats.averageApprovalTime} days
                  shows excellent response time by managers.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-orange-500 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Team Variations</h4>
                <p className="text-sm text-gray-600">
                  HR department shows highest leave utilization at 2.5 days per employee.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Healthy Balance</h4>
                <p className="text-sm text-gray-600">
                  {currentYearStats.utilizationRate}% leave utilization indicates
                  good work-life balance across teams.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;