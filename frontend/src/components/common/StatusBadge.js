import React from 'react';
import { getStatusColor, getStatusIcon, formatStatus } from '../../utils/leaveUtils';

/**
 * Standardized status badge component
 * Combines status color, icon, and formatted text in a reusable component
 */
const StatusBadge = ({
  status,
  size = 'sm',
  className = '',
  showIcon = true
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  const iconSpacing = showIcon ? 'space-x-1' : '';

  return (
    <div className={`inline-flex items-center ${iconSpacing} ${sizeClasses[size]} rounded-full text-xs font-medium ${getStatusColor(status)} ${className}`}>
      {showIcon && getStatusIcon(status)}
      <span>{formatStatus(status)}</span>
    </div>
  );
};

export default StatusBadge;