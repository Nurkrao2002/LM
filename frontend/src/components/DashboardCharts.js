import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const DashboardCharts = ({ statistics, leaveRequests, balances }) => {
  // Prepare data for leave balance chart
  const balanceData = balances.map(balance => ({
    name: balance.name,
    Total: balance.totalDays,
    Used: balance.usedDays,
    Remaining: balance.remainingDays,
    Pending: balance.pendingDays
  }));

  // Prepare data for leave requests status chart
  const statusData = leaveRequests.reduce((acc, req) => {
    const status = req.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = [
    { name: 'Pending', value: statusData.pending || 0, color: '#F59E0B' },
    { name: 'Manager Approved', value: statusData.manager_approved || 0, color: '#10B981' },
    { name: 'Admin Approved', value: statusData.admin_approved || 0, color: '#3B82F6' },
    { name: 'Rejected', value: (statusData.manager_rejected || 0) + (statusData.admin_rejected || 0), color: '#EF4444' },
    { name: 'Cancelled', value: statusData.cancelled || 0, color: '#6B7280' }
  ].filter(item => item.value > 0);

  // Prepare data for monthly leave requests from real data
  const monthlyData = React.useMemo(() => {
    const monthlyMap = {};

    // Group leave requests by month
    leaveRequests.forEach(req => {
      const date = new Date(req.createdAt || req.created_at);
      const monthKey = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          requests: 0,
          approved: 0
        };
      }

      monthlyMap[monthKey].requests += 1;

      if (req.status === 'admin_approved' || req.status === 'approved') {
        monthlyMap[monthKey].approved += 1;
      }
    });

    // Return last 6 months data
    const currentDate = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toLocaleString('default', { month: 'short' });
      months.push(monthlyMap[monthKey] || { month: monthKey, requests: 0, approved: 0 });
    }

    return months;
  }, [leaveRequests]);

  const leaveTypeData = leaveRequests.reduce((acc, req) => {
    const type = req.leaveType || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const leaveTypeChartData = Object.entries(leaveTypeData).map(([type, value]) => ({
    name: type,
    value,
    color: type === 'Annual' ? '#10B981' : type === 'Sick' ? '#EF4444' : type === 'Personal' ? '#3B82F6' : '#6B7280'
  }));

  return (
    <div className="space-y-6">
      {/* Monthly Leave Requests Trend */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Request Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="requests"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Total Requests"
            />
            <Line
              type="monotone"
              dataKey="approved"
              stroke="#10B981"
              strokeWidth={2}
              name="Approved"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Balance Overview */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Balance Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Total" fill="#E5E7EB" />
              <Bar dataKey="Used" fill="#EF4444" />
              <Bar dataKey="Remaining" fill="#10B981" />
              <Bar dataKey="Pending" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Request Status Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leave Types Distribution */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Types Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {leaveTypeChartData.map((type, index) => (
            <div key={index} className="text-center">
              <div className="relative">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={[type]}
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                      fill={type.color}
                      dataKey="value"
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{type.value}</span>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">{type.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Statistics (for managers) */}
      {statistics?.team_stats && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {statistics.team_stats.total_employees || 0}
              </div>
              <div className="text-sm text-blue-800">Total Employees</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {statistics.team_stats.active_leaves || 0}
              </div>
              <div className="text-sm text-green-800">Currently on Leave</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {statistics.team_stats.pending_requests || 0}
              </div>
              <div className="text-sm text-yellow-800">Pending Approvals</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {statistics.team_stats.approval_rate ? Math.round(statistics.team_stats.approval_rate * 100) : 0}%
              </div>
              <div className="text-sm text-purple-800">Approval Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCharts;