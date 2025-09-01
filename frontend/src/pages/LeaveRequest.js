import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  createLeaveRequest,
  fetchLeaveTypes,
  fetchLeaveBalances,
  fetchLeaveRequests,
  fetchLeaveStatistics,
  clearError,
  selectLeaveLoading,
  selectLeaveError,
  selectLeaveTypes,
  selectLeaveBalances,
  selectLeaveRequests,
  selectLeaveStatistics,
  selectLeavePagination
} from '../store/slices/leaveSlice';
import DashboardCharts from '../components/DashboardCharts';
import { Calendar, Clock, FileText, AlertTriangle, ArrowLeft, Send, TrendingUp, TrendingDown, CalendarDays, Users, Zap, BarChart3, History, Eye, Target, Briefcase, Plus, Filter, Settings } from 'lucide-react';

const LeaveRequest = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = useSelector(selectLeaveLoading);
  const error = useSelector(selectLeaveError);
  const leaveTypes = useSelector(selectLeaveTypes);
  const balances = useSelector(selectLeaveBalances);
  const requests = useSelector(selectLeaveRequests);
  const statistics = useSelector(selectLeaveStatistics);
  const pagination = useSelector(selectLeavePagination);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    emergency: false
  });

  const [formErrors, setFormErrors] = useState({});
  const [calculations, setCalculations] = useState({
    totalDays: 0,
    balanceAvailable: 0,
    isSufficientBalance: false
  });

  // Dashboard state
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'form'
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch required data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        dispatch(clearError());
        await Promise.all([
          dispatch(fetchLeaveTypes()),
          dispatch(fetchLeaveBalances()),
          dispatch(fetchLeaveRequests({ page: 1, limit: 5})), // Get recent requests
          dispatch(fetchLeaveStatistics()) // Get leave statistics
        ]);
      } catch (error) {
        console.error('Failed to load leave data:', error);
      }
    };

    loadData();
  }, [dispatch]);

  // Calculate total days and check balance when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date && formData.leave_type_id && balances) {
      calculateDaysAndBalance();
    }
  }, [formData.start_date, formData.end_date, formData.leave_type_id, leaveTypes, balances]);

  const calculateDaysAndBalance = () => {
    if (!formData.start_date || !formData.end_date || !formData.leave_type_id) return;

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);

    if (startDate && endDate && startDate <= endDate) {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

      // Find the selected leave type
      const selectedLeaveType = leaveTypes?.find(lt => lt.id === formData.leave_type_id);

      // Find balance for the selected leave type
      let available = 0;
      if (selectedLeaveType && balances && Array.isArray(balances) && balances.length > 0) {
        const leaveBalance = balances.find(balance =>
          balance && balance.name?.toLowerCase() === selectedLeaveType.name?.toLowerCase()
        );

        if (leaveBalance && typeof leaveBalance === 'object') {
          available = parseFloat(leaveBalance.remaining_days || 0);
        } else {
          console.log('DEBUG: No balance found for leave type:', selectedLeaveType.name);
          console.log('DEBUG: Available balances:', balances);
          // Set available to 0 since no balance found
        }
      } else {
        console.log('DEBUG: Balances not available or not array:', {
          balances,
          isArray: Array.isArray(balances),
          length: Array.isArray(balances) ? balances.length : 'N/A',
          selectedLeaveType: !!selectedLeaveType
        });
      }

      const isSufficient = available >= totalDays;

      setCalculations({
        totalDays,
        balanceAvailable: available,
        isSufficientBalance: isSufficient
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear field errors
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.leave_type_id) {
      errors.leave_type_id = 'Please select a leave type';
    }

    if (!formData.start_date) {
      errors.start_date = 'Start date is required';
    }

    if (!formData.end_date) {
      errors.end_date = 'End date is required';
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        errors.start_date = 'Start date cannot be in the past';
      }

      if (endDate < startDate) {
        errors.end_date = 'End date must be after start date';
      }

      if (calculations.totalDays > 0 && !calculations.isSufficientBalance) {
        errors.insufficient_balance = `Insufficient leave balance. Available: ${calculations.balanceAvailable} days, Requested: ${calculations.totalDays} days`;
      }
    }

    if (!formData.reason.trim()) {
      errors.reason = 'Reason is required';
    } else if (formData.reason.length < 10) {
      errors.reason = 'Reason must be at least 10 characters long';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[DEBUG] handleSubmit called');
    console.log('[DEBUG] Form validation starting');

    if (!validateForm()) {
      console.log('[DEBUG] Form validation failed');
      return;
    }

    // Prepare submission data with calculated total days
    const submissionData = {
      ...formData,
      total_days: calculations.totalDays
    };

    console.log('[DEBUG] Form validation passed. Submitting request data:', submissionData);
    console.log('[DEBUG] Current user authentication status would be here...');

    try {
      const resultAction = await dispatch(createLeaveRequest(submissionData));
      console.log('[DEBUG] Dispatch result:', resultAction);

      if (createLeaveRequest.fulfilled.match(resultAction)) {
        console.log('[DEBUG] Request creation successful! Response data:', resultAction.payload);
        // Reset form
        setFormData({
          leave_type_id: '',
          start_date: '',
          end_date: '',
          reason: '',
          emergency: false
        });
        setCalculations({
          totalDays: 0,
          balanceAvailable: 0,
          isSufficientBalance: false
        });
        setFormErrors({});

        // Navigate to requests page
        navigate('/leave-requests');
      } else {
        console.log('[DEBUG] Request creation failed. Result:', resultAction);
        if (resultAction.error) {
          console.log('[DEBUG] Error payload:', resultAction.error.message);
        }
      }
    } catch (error) {
      console.error('[ERROR] Exception in handleSubmit:', error);
      console.error('[ERROR] Error details:', error.message, error.stack);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Determine the default option text based on state
  const getDefaultOptionText = () => {
    if (isLoading) return 'Loading leave types...';
    if (!leaveTypes) return 'Loading leave types...';
    if (!Array.isArray(leaveTypes)) return 'Error: leave types format invalid';
    if (leaveTypes.length === 0) return 'No leave types available';
    return 'Select leave type...';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Leave Request Dashboard</h1>
              <p className="text-blue-100 mt-1">Manage your leave requests with confidence</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentView(currentView === 'dashboard' ? 'form' : 'dashboard')}
                className="inline-flex items-center px-6 py-3 border border-white/20 rounded-lg shadow-sm text-sm font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
              >
                {currentView === 'dashboard' ? <Plus className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {currentView === 'dashboard' ? 'Create Request' : 'View Dashboard'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-6 py-3 border border-white/20 rounded-lg shadow-sm text-sm font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-white/20">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-white/80 text-sm font-medium">This Year's Used</p>
                  <p className="text-white text-2xl font-bold">
                    {Array.isArray(balances) ? balances.reduce((sum, b) => sum + parseFloat(b.used_days || 0), 0) : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-500/30">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-white/80 text-sm font-medium">Available Balance</p>
                  <p className="text-white text-2xl font-bold">
                    {Array.isArray(balances) ? balances.reduce((sum, b) => sum + parseFloat(b.remaining_days || 0), 0) : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-500/30">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-white/80 text-sm font-medium">Pending Requests</p>
                  <p className="text-white text-2xl font-bold">
                    {Array.isArray(requests) ? requests.filter(r => r.status === 'pending').length : 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-indigo-500/30">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-white/80 text-sm font-medium">Total Requests</p>
                  <p className="text-white text-2xl font-bold">
                    {Array.isArray(requests) ? requests.length : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' ? (
          <div className="space-y-8">
            {/* Dashboard View */}
            {/* Dashboard Charts */}
            {(statistics || (Array.isArray(requests) && requests.length > 0) || (Array.isArray(balances) && balances.length > 0)) && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                  Analytics & Trends
                </h2>
                <DashboardCharts
                  statistics={statistics}
                  leaveRequests={requests || []}
                  balances={balances || []}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Interactive Calendar */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-lg rounded-xl">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                      Interactive Calendar - {new Date().getFullYear()}
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Calendar integration coming soon...</p>
                      <p className="text-sm mt-2">Will show leave periods, holidays, and availability</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Requests Sidebar */}
              <div>
                <div className="bg-white shadow-lg rounded-xl">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <History className="w-5 h-5 mr-2 text-green-600" />
                      Recent Requests
                    </h3>
                  </div>
                  <div className="p-6">
                    {Array.isArray(requests) && requests.length > 0 ? (
                      <div className="space-y-4">
                        {requests.slice(0, 5).map((request, index) => (
                          <div key={request.id || index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">
                                {request.leaveType?.name || 'Leave'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {request.status?.replace('_', ' ') || 'Unknown'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <p>{new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</p>
                              <p className="mt-1">{request.days_count || 'N/A'} days</p>
                            </div>
                          </div>
                        ))}
                        {pagination?.total_requests > 5 && (
                          <button
                            onClick={() => navigate('/leave-requests')}
                            className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View All Requests ({pagination.total_requests})
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No leave requests yet</p>
                        <button
                          onClick={() => setCurrentView('form')}
                          className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Create your first request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Overview - Enhanced */}
            {Array.isArray(balances) && balances.length > 0 && (
              <div className="bg-white shadow-lg rounded-xl">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-purple-600" />
                    Leave Balances
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {(() => {
                      const uniqueBalances = balances.filter(
                        (balance, index, arr) =>
                          arr.findIndex(b => b.name === balance.name) === index
                      ).slice(0, 4);
                      console.log('🚨 DEBUG: LeaveRequest dashboard view - After deduplication, unique balances count:', uniqueBalances.length, 'from original:', balances.length);
                      return uniqueBalances;
                    })().map((balance, index) => {
                      console.log('🚨 DEBUG: LeaveRequest dashboard view - Rendering balance card:', index, balance);
                      const usagePercentage = parseFloat(balance.total_days || 0) > 0 ? ((parseFloat(balance.used_days || 0) / parseFloat(balance.total_days || 0)) * 100) : 0;

                      return (
                        <div key={`${balance.name}-${index}`} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100 hover:shadow-lg transition-all duration-200 card-hover">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-3 rounded-full ${
                                balance.remaining_days > 10 ? 'bg-green-100' :
                                balance.remaining_days > 5 ? 'bg-blue-100' :
                                balance.remaining_days > 2 ? 'bg-yellow-100' : 'bg-red-100'
                              }`}>
                                <CalendarDays className={`w-6 h-6 ${
                                  balance.remaining_days > 10 ? 'text-green-600' :
                                  balance.remaining_days > 5 ? 'text-blue-600' :
                                  balance.remaining_days > 2 ? 'text-yellow-600' : 'text-red-600'
                                }`} />
                              </div>
                              <h4 className="text-lg font-semibold text-gray-900 capitalize">
                                {balance.name.includes('Leave') ? balance.name : `${balance.name} Leave`}
                              </h4>
                            </div>
                            <div className={`text-2xl font-bold ${
                              balance.remaining_days > 10 ? 'text-green-600' :
                              balance.remaining_days > 5 ? 'text-blue-600' :
                              balance.remaining_days > 2 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {balance.remaining_days}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Usage</span>
                              <span>{Math.round(usagePercentage)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-1000 ${
                                  usagePercentage < 30 ? 'bg-green-500' :
                                  usagePercentage < 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${usagePercentage}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="text-sm text-gray-600 grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Used:</span> {balance.used_days}
                            </div>
                            <div>
                              <span className="font-medium">Total:</span> {balance.total_days}
                            </div>
                            <div>
                              <span className="font-medium">Pending:</span> {balance.pending_days}
                            </div>
                            <div>
                              <span className="font-medium text-blue-600">Remaining:</span>
                              <span className="font-semibold">{balance.remaining_days}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <div className="px-6 py-4">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={() => setCurrentView('form')}
                    className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-lg transition-all duration-200 backdrop-blur-sm flex flex-col items-center justify-center"
                  >
                    <Plus className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">New Request</span>
                  </button>
                  <button
                    onClick={() => navigate('/leave-requests')}
                    className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-lg transition-all duration-200 backdrop-blur-sm flex flex-col items-center justify-center"
                  >
                    <History className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">View History</span>
                  </button>
                  <button
                    onClick={() => navigate('/reports')}
                    className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-lg transition-all duration-200 backdrop-blur-sm flex flex-col items-center justify-center"
                  >
                    <BarChart3 className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Reports</span>
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="bg-white/20 hover:bg-white/30 text-white p-4 rounded-lg transition-all duration-200 backdrop-blur-sm flex flex-col items-center justify-center"
                  >
                    <Settings className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Original Form View */
      <div className="max-w-4xl mx-auto space-y-6">

      {/* Balance Overview */}
      {!Array.isArray(balances) || balances === null || balances === undefined ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <p className="text-sm text-blue-700">Loading leave balance data...</p>
          </div>
        </div>
      ) : Array.isArray(balances) && balances.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">No Leave Balances Found</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Using fallback balance data for demonstration.
                <br /><strong>Database setup needed:</strong> Run <code>quick-fix.sql</code> to set up real database.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {(() => {
              const uniqueBalances = balances.filter(
                (balance, index, arr) =>
                  arr.findIndex(b => b.name === balance.name) === index
              ).slice(0, 4);
              console.log('🚨 DEBUG: LeaveRequest form view - After deduplication, unique balances count:', uniqueBalances.length, 'from original:', balances.length);
              return uniqueBalances;
            })().map((balance, index) => {
              console.log('🚨 DEBUG: LeaveRequest form view - Rendering balance card:', index, balance);
              const usagePercentage = parseFloat(balance.total_days || 0) > 0 ? ((parseFloat(balance.used_days || 0) / parseFloat(balance.total_days || 0)) * 100) : 0;

              return (
                <div key={`${balance.name}-${index}`} className="bg-white shadow-lg rounded-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className={`w-5 h-5 ${balance.remaining_days > 5 ? 'text-green-600' : balance.remaining_days > 2 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {balance.name.includes('Leave') ? balance.name : `${balance.name} Leave`}
                      </h3>
                    </div>
                    <div className={`text-2xl font-bold ${balance.remaining_days > 10 ? 'text-green-600' : balance.remaining_days > 5 ? 'text-blue-600' : balance.remaining_days > 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {balance.remaining_days}
                    </div>
                  </div>

                  {/* Additional balance info */}
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Used: {balance.used_days}</span>
                      <span>Total: {balance.total_days}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending: {balance.pending_days}</span>
                      <span className="font-medium">Remaining: {balance.remaining_days}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Leave Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500">
                {Array.isArray(leaveTypes) ?
                  `(${leaveTypes.length} available${leaveTypes.some(lt => lt.id?.startsWith('fallback-')) ? ' - Fallback Mode' : ''})` :
                  ''}
              </span>
            </label>
            <select
              name="leave_type_id"
              value={formData.leave_type_id}
              onChange={handleChange}
              className={`block w-full px-3 py-2 border ${formErrors.leave_type_id ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              disabled={isLoading || !Array.isArray(leaveTypes)}
            >
              <option value="">{getDefaultOptionText()}</option>
              {leaveTypes && Array.isArray(leaveTypes) && leaveTypes.length > 0 &&
                leaveTypes.map((type, index) => {
                  const displayName = type.name || type.type || 'Unknown Type';
                  const days = type.annual_days || 0;

                  return (
                    <option
                      key={type.id || type.type || index}
                      value={type.id || type.type || index}
                      className="text-gray-900"
                    >
                      {displayName} ({days} days){type.description ? ` - ${type.description.split('.')[0]}` : ''}
                    </option>
                  );
                })
              }
            </select>
            {formErrors.leave_type_id && (
              <p className="mt-1 text-sm text-red-600">{formErrors.leave_type_id}</p>
            )}
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  min={today}
                  className={`block w-full pl-10 pr-3 py-2 border ${formErrors.start_date ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                />
              </div>
              {formErrors.start_date && (
                <p className="mt-1 text-sm text-red-600">{formErrors.start_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date || today}
                  className={`block w-full pl-10 pr-3 py-2 border ${formErrors.end_date ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                />
              </div>
              {formErrors.end_date && (
                <p className="mt-1 text-sm text-red-600">{formErrors.end_date}</p>
              )}
            </div>
          </div>

          {/* Duration and Balance Info */}
          {formData.start_date && formData.end_date && calculations.totalDays > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{calculations.totalDays}</div>
                  <div className="text-sm text-gray-500">Total Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{calculations.balanceAvailable}</div>
                  <div className="text-sm text-gray-500">Available Days</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${calculations.isSufficientBalance ? 'text-green-600' : 'text-red-600'}`}>
                    {calculations.isSufficientBalance ? 'Yes' : 'No'}
                  </div>
                  <div className="text-sm text-gray-500">Sufficient Balance</div>
                </div>
                <div className="text-center">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${calculations.isSufficientBalance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {calculations.isSufficientBalance ? (
                      <Clock className="w-4 h-4 mr-1" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mr-1" />
                    )}
                    {calculations.isSufficientBalance ? 'Can Approve' : 'Needs Approval'}
                  </div>
                </div>
              </div>
              {!calculations.isSufficientBalance && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-800">
                        Insufficient Leave Balance
                      </p>
                      <div className="mt-1 text-sm text-yellow-700">
                        <p>This request requires manager approval due to insufficient leave balance.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <textarea
                name="reason"
                rows={4}
                value={formData.reason}
                onChange={handleChange}
                className={`block w-full pl-10 pr-3 py-2 border ${formErrors.reason ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Please provide details about your leave request... (minimum 10 characters required)"
              />
            </div>
            {formErrors.reason && (
              <p className="mt-1 text-sm text-red-600">{formErrors.reason}</p>
            )}
          </div>

          {/* Emergency Checkbox */}
          <div className="flex items-center">
            <input
              id="emergency"
              name="emergency"
              type="checkbox"
              checked={formData.emergency}
              onChange={handleChange}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="emergency" className="ml-2 block text-sm text-gray-900">
              <span className="font-medium">Emergency Request</span>
              <span className="text-gray-500 ml-1">(bypasses notice period requirements)</span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Validation Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !Array.isArray(leaveTypes) || leaveTypes.length === 0}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading || !Array.isArray(leaveTypes) || leaveTypes.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
          </div>

          {/* Close form view container */}
          </div>
        )}

        {/* Close main content wrapper */}
      </div>

      {/* Close main container */}
    </div>
  );
};

export default LeaveRequest;