/**
 * Consolidated utility functions for leave-related components
 * Eliminates duplicate code across Dashboard, LeaveRequests, LeaveApprovals
 */

/**
 * Get Tailwind CSS classes for leave request status colors
 * @param {string} status - The leave request status
 * @returns {string} Tailwind CSS classes for background and text color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
    case 'hr_pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'manager_approved':
      return 'bg-blue-100 text-blue-800';
    case 'admin_approved':
      return 'bg-green-100 text-green-800';
    case 'manager_rejected':
    case 'admin_rejected':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get Lucide React icon component for leave request status
 * @param {string} status - The leave request status
 * @returns {JSX.Element|null} Icon component or null
 */
export const getStatusIcon = (status) => {
  const { Clock, CheckCircle, XCircle } = require('lucide-react');

  switch (status) {
    case 'pending':
    case 'hr_pending':
      return <Clock className="w-4 h-4" />;
    case 'manager_approved':
    case 'admin_approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'manager_rejected':
    case 'admin_rejected':
    case 'cancelled':
      return <XCircle className="w-4 h-4" />;
    default:
      return null;
  }
};

/**
 * Get Tailwind CSS classes for leave type text color
 * @param {string} leaveType - The leave type (casual, health, etc.)
 * @returns {string} Tailwind CSS classes for text color
 */
export const getLeaveTypeColor = (leaveType) => {
  switch (leaveType?.toLowerCase()) {
    case 'casual':
      return 'text-green-600';
    case 'health':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Format leave request status for display (title case with special handling)
 * @param {string} status - The leave request status
 * @returns {string} Formatted status string
 */
export const formatStatus = (status) => {
  if (status === 'hr_pending') return 'HR Pending';
  return status
    .replace('_', ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};