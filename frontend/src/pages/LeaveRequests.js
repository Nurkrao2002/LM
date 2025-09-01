import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLeaveRequests,
  fetchLeaveBalances,
  selectLeaveRequests,
  selectLeaveBalances,
  selectLeaveLoading,
  selectLeaveError,
  selectLeavePagination
} from '../store/slices/leaveSlice';
import { selectCurrentUser } from '../store/slices/authSlice';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { getStatusColor, getStatusIcon, getLeaveTypeColor, formatStatus } from '../utils/leaveUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ProgressBar from '../components/common/ProgressBar';
import StatusBadge from '../components/common/StatusBadge';

const LeaveRequests = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const requests = useSelector(selectLeaveRequests);
  const balances = useSelector(selectLeaveBalances);
  const isLoading = useSelector(selectLeaveLoading);
  const error = useSelector(selectLeaveError);
  const pagination = useSelector(selectLeavePagination);

  const [filters, setFilters] = useState({
    status: '',
    leave_type: '',
    search: '',
    start_date: '',
    end_date: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // Deduplication logic for balances
  const uniqueBalances = balances.filter(
    (balance, index, arr) =>
      arr.findIndex(b => b.name === balance.name) === index
  );

  // Debugging logs
  console.log('Original balances:', balances);
  console.log('Unique balances after deduplication:', uniqueBalances);

  useEffect(() => {
    loadRequests(1);
    dispatch(fetchLeaveBalances());
  }, [dispatch, filters]);

  const loadRequests = (page = 1) => {
    const params = { page, ...filters };
    // Remove empty filters
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key];
    });
    dispatch(fetchLeaveRequests(params));
  };


  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      leave_type: '',
      search: '',
      start_date: '',
      end_date: ''
    });
  };


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Leave Requests</h1>
            <p className="text-gray-600 mt-1">View and manage your leave requests</p>
          </div>
          <button
            onClick={() => window.location.href = '/leave-request'}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </button>
        </div>
      </div>

      {/* Leave Balance Cards */}
      {Array.isArray(balances) && balances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {uniqueBalances.map((balance, index) => {
              // Fix name duplication to prevent "Leave Leave"
              const displayName = balance.name.includes('Leave')
                ? balance.name
                : `${balance.name} Leave`;
            const percentageUsed = balance.total_days > 0 ? ((balance.used_days / balance.total_days) * 100) : 0;
            const percentageColor = percentageUsed > 80 ? 'text-red-600' : percentageUsed > 50 ? 'text-yellow-600' : 'text-green-600';

            return (
             <div key={`${balance.name}-${balance.remaining_days}-${index}`} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between pb-4">
                  <div className="flex items-center space-x-2">
                    <CalendarDays className={`w-6 h-6 ${percentageColor}`} />
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {displayName}
                    </h3>
                  </div>
                  <div className={`text-2xl font-bold ${percentageColor}`}>
                    {balance.remaining_days}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Progress Bar */}
                  <ProgressBar
                    value={balance.used_days}
                    maxValue={balance.total_days}
                    showLabel={false}
                    className="mt-2"
                  />

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="font-medium text-green-600">{balance.total_days}</div>
                        <div className="text-gray-500">Total</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <TrendingDown className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-600">{balance.used_days}</div>
                        <div className="text-gray-500">Used</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="font-medium text-purple-600">{balance.pending_days}</div>
                        <div className="text-gray-500">Pending</div>
                      </div>
                    </div>
                  </div>

                  {/* Remaining Days Highlight */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Days Remaining</span>
                      <span className="text-lg font-bold text-gray-900">{balance.remaining_days}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })} // close uniqueBalances.map
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="manager_approved">Manager Approved</option>
                  <option value="admin_approved">Admin Approved</option>
                  <option value="manager_rejected">Manager Rejected</option>
                  <option value="admin_rejected">Admin Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Type
                </label>
                <select
                  name="leave_type"
                  value={filters.leave_type}
                  onChange={handleFilterChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">All Types</option>
                  <option value="casual">Casual Leave</option>
                  <option value="health">Health Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="px-6 py-4">
          {isLoading ? (
            <LoadingSpinner text="Loading requests..." />
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600">
                <p className="text-lg font-medium">Error loading requests</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No leave requests found"
              description="You haven't submitted any leave requests yet."
              action={() => window.location.href = '/leave-request'}
              actionText="Submit Your First Request"
            />
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-700">
                Showing {requests.length} request{requests.length !== 1 ? 's' : ''}
              </div>

              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <StatusBadge status={request.status} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <Calendar className={`w-4 h-4 ${getLeaveTypeColor(request.leave_type_name ? request.leave_type_name.toLowerCase() : request.leave_type)}`} />
                            <span className="font-medium text-gray-900 capitalize">
                              {request.leave_type_name || request.leave_type} Leave
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {request.start_date && request.end_date ? (
                              <>
                                {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                                <span className="ml-2">({request.total_days} days)</span>
                              </>
                            ) : (
                              'Date information unavailable'
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-500">
                          {new Date(request.created_at).toLocaleDateString()}
                        </span>

                        <button
                          onClick={() => window.location.href = `/leave-request/${request.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                      </div>
                    </div>

                    {request.reason && (
                      <div className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {pagination.current_page} of {pagination.total_pages}
                    ({pagination.total_requests} total requests)
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => loadRequests(pagination.current_page - 1)}
                      disabled={!pagination.has_prev}
                      className={`px-3 py-1 text-sm font-medium rounded-md ${
                        pagination.has_prev
                          ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>

                    <button
                      onClick={() => loadRequests(pagination.current_page + 1)}
                      disabled={!pagination.has_next}
                      className={`px-3 py-1 text-sm font-medium rounded-md ${
                        pagination.has_next
                          ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      }`}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequests;