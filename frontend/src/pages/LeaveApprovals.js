import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchLeaveRequests,
  selectLeaveRequests,
  selectLeaveLoading,
  selectLeaveError,
  clearError,
  approveRequest,
  rejectRequest
} from '../store/slices/leaveSlice';
import leaveService from '../services/leaveService';
import {
  selectCurrentUser,
  selectHasRole
} from '../store/slices/authSlice';
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  MessageSquare,
  Filter,
  Search,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { getStatusColor, getStatusIcon, getLeaveTypeColor, formatStatus } from '../utils/leaveUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';

const LeaveApprovals = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = useSelector(selectHasRole('admin'));
  const isManager = useSelector(selectHasRole('manager'));
  const requests = useSelector(selectLeaveRequests);
  const isLoading = useSelector(selectLeaveLoading);
  const error = useSelector(selectLeaveError);

  const [approvalType, setApprovalType] = useState('manager');
  const [filters, setFilters] = useState({
    status: 'pending',
    department: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [commentModal, setCommentModal] = useState({
    isOpen: false,
    action: null,
    request: null,
    comment: ''
  });
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Helper function to show notifications
  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Handle bulk selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRequests(filteredRequests.map(r => r.id));
    } else {
      setSelectedRequests([]);
    }
  };

  const handleSelectRequest = (requestId, checked) => {
    if (checked) {
      setSelectedRequests(prev => [...prev, requestId]);
    } else {
      setSelectedRequests(prev => prev.filter(id => id !== requestId));
    }
  };

  // Bulk approval/rejection
  const handleBulkAction = async (action) => {
    if (selectedRequests.length === 0) {
      showNotification('Please select requests to perform bulk action', 'warning');
      return;
    }

    try {
      setBulkActionLoading(true);
      const comment = `${action === 'approve' ? 'Approved' : 'Rejected'} via bulk action`;

      const promises = selectedRequests.map(requestId => {
        let serviceMethod;

        if (approvalType === 'manager') {
          if (action === 'approve') {
            serviceMethod = leaveService.approveByManager;
          } else {
            serviceMethod = leaveService.rejectByManager;
          }
        } else {
          if (action === 'approve') {
            serviceMethod = leaveService.approveByAdmin;
          } else {
            serviceMethod = leaveService.rejectByAdmin;
          }
        }

        // Pass comment as string directly (service updated to handle this)
        return serviceMethod(requestId, comment);
      });

      await Promise.all(promises);

      showNotification(`Successfully ${action}d ${selectedRequests.length} requests`, 'success');
      setSelectedRequests([]);

      // Refresh the requests
      const params = { ...filters };
      dispatch(fetchLeaveRequests(params));

    } catch (error) {
      console.error('Bulk action failed:', error);
      showNotification('Some bulk actions failed to complete', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  useEffect(() => {
    if (isManager || isAdmin) {
      const params = { ...filters };
      dispatch(fetchLeaveRequests(params));
    }
  }, [dispatch, filters, isManager, isAdmin]);

  // If user doesn't have approval permissions, redirect
  if (!isManager && !isAdmin) {
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
                You don't have permission to view this page. Only managers and administrators can access leave approvals.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: 'pending',
      department: '',
      search: ''
    });
  };


  const handleApproval = (requestId, action, defaultComment) => {
    const request = filteredRequests.find(r => r.id === requestId);
    setCommentModal({
      isOpen: true,
      action,
      request,
      comment: defaultComment
    });
  };

  const handleSubmitApproval = async () => {
    try {
      setApprovalLoading(true);
      const { action, request, comment } = commentModal;

      // Determine approval level and service method
      let serviceMethod;
      const approvalData = {
        comments: comment.trim()
      };

      if (approvalType === 'manager') {
        if (action === 'approve') {
          serviceMethod = leaveService.approveByManager;
        } else {
          serviceMethod = leaveService.rejectByManager;
        }
      } else if (approvalType === 'admin') {
        if (action === 'approve') {
          serviceMethod = leaveService.approveByAdmin;
        } else {
          serviceMethod = leaveService.rejectByAdmin;
        }
      }

      // Call the appropriate service
      const response = await serviceMethod(request.id, approvalData);

      // Success handling
      const actionLabel = action === 'approve' ? 'approved' : 'rejected';
      console.log(`Leave request ${actionLabel} successfully:`, response.data);

      // Close modal and refresh requests
      setCommentModal({ isOpen: false, action: null, request: null, comment: '' });

      // Refresh the requests to show updated status
      const params = { ...filters };
      dispatch(fetchLeaveRequests(params));

    } catch (error) {
      console.error('Approval action failed:', error);

      // Handle specific error cases
      if (error.response?.status === 403) {
        console.error('You are not authorized to perform this action');
      } else if (error.response?.status === 400) {
        console.error('Invalid approval action:', error.response.data.message);
      } else {
        console.error('Unexpected error during approval');
      }
    } finally {
      setApprovalLoading(false);
      showNotification('Leave request processed successfully', 'success');
    }
  };

  const closeCommentModal = () => {
    setCommentModal({ isOpen: false, action: null, request: null, comment: '' });
  };

  const filteredRequests = requests.filter(request => {
    // Filter by status based on approval type
    if (filters.status === 'pending') {
      if (approvalType === 'manager') {
        if (request.status !== 'pending') return false;
      } else if (approvalType === 'admin') {
        if (request.status !== 'manager_approved' && request.status !== 'hr_pending') return false;
      }
    }

    // Additional filters
    if (filters.department && !request.department?.toLowerCase().includes(filters.department.toLowerCase())) {
      return false;
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchableText = `${request.first_name} ${request.last_name} ${request.email} ${request.department || ''}`.toLowerCase();
      if (!searchableText.includes(searchTerm)) return false;
    }

    return true;
  });

  const pendingCount = requests.filter(request => {
    if (approvalType === 'manager') {
      return request.status === 'pending';
    } else {
      return request.status === 'manager_approved';
    }
  }).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`max-w-sm p-4 rounded-lg shadow-lg ${
                notification.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : notification.type === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center">
                {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <button
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Approvals</h1>
            <p className="text-gray-600 mt-1">
              Review and manage leave requests that require your approval
            </p>
          </div>
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {pendingCount} pending {approvalType === 'manager' ? 'manager' : 'admin'} approval{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Approval Type Toggle */}
      {isAdmin && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Showing:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setApprovalType('manager')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  approvalType === 'manager'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                Manager Approvals
              </button>
              <button
                onClick={() => setApprovalType('admin')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  approvalType === 'admin'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                Admin Approvals
              </button>
            </div>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <option value="pending">Pending</option>
                  <option value="manager_approved">Manager Approved</option>
                  <option value="admin_approved">Fully Approved</option>
                  <option value="">All Statuses</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                  placeholder="Filter by department"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Search by name, email..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
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

        {/* Bulk Actions */}
        {filteredRequests.length > 0 && (
          <div className={`${showFilters ? 'border-t' : ''} px-6 py-4 bg-gray-50`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Select All ({filteredRequests.length})
                  </span>
                </label>
                {selectedRequests.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {selectedRequests.length} selected
                  </span>
                )}
              </div>

              {selectedRequests.length > 0 && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700">Bulk Actions:</span>
                  <button
                    onClick={() => handleBulkAction('approve')}
                    disabled={bulkActionLoading}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {bulkActionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('reject')}
                    disabled={bulkActionLoading}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {bulkActionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    ) : (
                      <XCircle className="w-4 h-4 mr-1" />
                    )}
                    Reject Selected
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="px-6 py-4">
          {isLoading ? (
            <LoadingSpinner text="Loading approval requests..." />
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600">
                <p className="text-lg font-medium">Error loading requests</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No pending approvals"
              description={
                approvalType === 'manager'
                  ? 'All pending manager approvals have been processed.'
                  : 'All requests awaiting admin approval have been processed.'
              }
            />
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-700">
                Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} for {approvalType} approval
              </div>

              <div className="space-y-4">
                {filteredRequests.map((request) => (
                   <div
                     key={request.id}
                     className="bg-gray-50 rounded-lg p-6"
                   >
                     {/* Checkbox for bulk selection */}
                     <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center">
                         <input
                           type="checkbox"
                           checked={selectedRequests.includes(request.id)}
                           onChange={(e) => handleSelectRequest(request.id, e.target.checked)}
                           className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                         />
                         <span className="ml-2 text-sm text-gray-500">Select for bulk action</span>
                       </div>
                       <div className="flex items-center space-x-3">
                         <span className="text-sm text-gray-500">
                           {new Date(request.created_at).toLocaleDateString()}
                         </span>
                         <button
                           onClick={() => navigate(`/leave-request/${request.id}`)}
                           className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                         >
                           <Eye className="w-4 h-4 mr-1" />
                           View Details
                         </button>
                       </div>
                     </div>

                     {/* Request Header */}
                     <div className="flex items-start justify-between mb-4">
                       <div className="flex items-start space-x-4">
                        <StatusBadge status={request.status} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <Calendar className={`w-5 h-5 ${getLeaveTypeColor(request.leaveType)}`} />
                            <span className="font-medium text-gray-900 capitalize">
                              {request.leave_type_name || request.leave_type} Leave
                            </span>
                            {request.emergency && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Emergency
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {request.dates?.start && request.dates?.end ? (
                              <>
                                {new Date(request.dates.start).toLocaleDateString()} - {new Date(request.dates.end).toLocaleDateString()}
                                <span className="ml-2">({request.dates.totalDays} days)</span>
                              </>
                            ) : (
                              <>
                                {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                                <span className="ml-2">({request.total_days} days)</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Employee Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {request.first_name} {request.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {request.email}
                            {request.department && ` • ${request.department}`}
                            {request.employee_id && ` • ID: ${request.employee_id}`}
                          </p>
                        </div>
                      </div>

                      {request.manager_first_name && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Manager</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.manager_first_name} {request.manager_last_name}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    {request.reason && (
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Reason for Leave</p>
                            <p className="text-sm text-gray-600">{request.reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Approval Actions */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {approvalType === 'manager'
                          ? 'Requires your approval as manager'
                          : 'Approved by manager, requires your final approval'}
                      </div>

                      <div className="flex space-x-3">
                        {approvalType === 'manager' ? (
                          <>
                            <button
                              onClick={() => handleApproval(request.id, 'approved', 'Your leave request has been approved.')}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproval(request.id, 'rejected', 'Your leave request has been rejected.')}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApproval(request.id, 'approved', 'Your leave request has been finally approved.')}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Final Approve
                            </button>
                            <button
                              onClick={() => handleApproval(request.id, 'rejected', 'Your leave request has been rejected.')}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Final Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comment Modal */}
      {commentModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="my-modal">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {commentModal.action === 'approved' ? 'Approval Comment' : 'Rejection Comment'}
              </h3>
              <div className="mt-2 px-7 py-3">
                <div className="flex items-center space-x-2 mb-3">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    commentModal.action === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {commentModal.action === 'approved' ? (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-1" />
                    )}
                    {commentModal.action === 'approved' ? 'Approval' : 'Rejection'}
                  </div>
                  <span className="text-sm text-gray-600">
                    {commentModal.request?.leave_type_name || commentModal.request?.leave_type} Leave Request
                  </span>
                </div>

                <textarea
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md px-3 py-2"
                  rows={4}
                  placeholder="Enter your approval/rejection comments..."
                  value={commentModal.comment}
                  onChange={(e) => setCommentModal(prev => ({
                    ...prev,
                    comment: e.target.value
                  }))}
                />

                {commentModal.action === 'approved' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Optional: Leave blank for no additional comments
                  </p>
                )}
                {commentModal.action === 'rejected' && (
                  <p className="text-xs text-red-600 mt-2">
                    * Required: Please provide a reason for rejection
                  </p>
                )}
              </div>

              <div className="flex items-center px-4 py-3">
                <button
                  id="cancel-btn"
                  className="px-4 py-2 bg-white text-gray-500 text-base font-medium border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 mr-3"
                  onClick={closeCommentModal}
                >
                  Cancel
                </button>
                <button
                  id="submit-btn"
                  className={`px-4 py-2 text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 ${
                    commentModal.action === 'approved'
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-300'
                      : 'bg-red-600 hover:bg-red-700 focus:ring-red-300'
                  } ${approvalLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleSubmitApproval}
                  disabled={commentModal.action === 'rejected' && !commentModal.comment.trim() || approvalLoading}
                >
                  {approvalLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    commentModal.action === 'approved' ? 'Approve' : 'Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovals;