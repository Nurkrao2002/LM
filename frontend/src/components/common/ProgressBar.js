import React from 'react';

/**
 * Standardized progress bar component
 * Handles various progress visualizations with customizable styling
 */
const ProgressBar = ({
  value,
  maxValue = 100,
  color = 'auto',
  size = 'md',
  showLabel = true,
  label = '',
  className = ''
}) => {
  // Calculate percentage (ensure it's between 0 and 100)
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);

  // Size classes
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4'
  };

  // Dynamic color based on percentage if color is 'auto'
  let barColor = 'bg-blue-500';
  if (color === 'auto') {
    if (percentage >= 80) {
      barColor = 'bg-red-500';
    } else if (percentage >= 50) {
      barColor = 'bg-yellow-500';
    } else {
      barColor = 'bg-green-500';
    }
  } else if (color === 'gradient') {
    barColor = 'bg-gradient-to-r from-blue-500 to-indigo-500';
  } else {
    barColor = color;
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 rounded-full ${size === 'sm' ? '' : 'overflow-hidden'}`}>
        <div
          className={`${barColor} ${sizeClasses[size]} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          {label && <span>{label}</span>}
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;