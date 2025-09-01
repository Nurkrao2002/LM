import React from 'react';

/**
 * Standardized loading spinner component
 * Replaces duplicate loading spinner implementations
 */
const LoadingSpinner = ({
  size = 'md',
  color = 'blue',
  className = '',
  showText = true,
  text = 'Loading...'
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    gray: 'border-gray-600',
    green: 'border-green-600',
    red: 'border-red-600',
    yellow: 'border-yellow-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin rounded-full border-b-2 mx-auto`}
        role="status"
        aria-label="Loading"
      />
      {showText && (
        <p className="mt-4 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;