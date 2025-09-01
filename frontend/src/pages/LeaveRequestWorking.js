import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  createLeaveRequest,
  fetchLeaveTypes,
  fetchLeaveBalances,
  clearError,
  selectLeaveLoading,
  selectLeaveError,
  selectLeaveTypes,
  selectLeaveBalances
} from '../store/slices/leaveSlice';
import { Calendar, Clock, FileText, AlertTriangle, ArrowLeft, Send, TrendingUp, TrendingDown, CalendarDays, Users, Zap } from 'lucide-react';

const LeaveRequestWorking = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = useSelector(selectLeaveLoading);
  const error = useSelector(selectLeaveError);
  const leaveTypes = useSelector(selectLeaveTypes);
  const balances = useSelector(selectLeaveBalances);

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

  // Fetch required data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        dispatch(clearError());
        await Promise.all([
          dispatch(fetchLeaveTypes()),
          dispatch(fetchLeaveBalances())
        ]);
      } catch (error) {
        console.error('Failed to load leave data:', error);
      }
    };

    loadData();
  }, [dispatch]);

  // Calculate total days and check balance when dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date && formData.leave_type_id) {
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
      if (selectedLeaveType && Array.isArray(balances)) {
        const leaveBalance = balances.find(balance =>
          balance.name?.toLowerCase() === selectedLeaveType.name?.toLowerCase() ||
          balance.type?.toLowerCase() === selectedLeaveType.type?.toLowerCase()
        );

        if (leaveBalance) {
          available = leaveBalance.remainingDays || 0;
        }
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

    if (!validateForm()) return;

    try {
      const resultAction = await dispatch(createLeaveRequest(formData));

      if (createLeaveRequest.fulfilled.match(resultAction)) {
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
      }
    } catch (error) {
      console.error('Failed to create leave request:', error);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Leave Request</h1>
            <p className="text-gray-600 mt-1">Submit a new leave application</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>

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
                Your leave balances are being created. Please wait and refresh the page in a moment.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {balances.slice(0, 4).map((balance, index) => {
              const usagePercentage = balance.totalDays > 0 ? ((balance.usedDays / balance.totalDays) * 100) : 0;

              return (
                <div key={balance.name || index} className="bg-white shadow-lg rounded-lg p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className={`w-5 h-5 ${balance.remainingDays > 5 ? 'text-green-600' : balance.remainingDays > 2 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {balance.name}
                      </h3>
                    </div>
                    <div className={`text-2xl font-bold ${balance.remainingDays > 10 ? 'text-green-600' : balance.remainingDays > 5 ? 'text-blue-600' : balance.remainingDays > 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {balance.remainingDays}
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
                {Array.isArray(leaveTypes) ? `(${leaveTypes.length} available)` : ''}
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
                placeholder="Please provide details about your leave request..."
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
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Request Submission Failed
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
    </div>
  );
};

export default LeaveRequestWorking;