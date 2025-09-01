import React from 'react';

/**
 * Standardized empty state component with flexible messaging
 * Replaces duplicate empty state patterns across the application
 */
const EmptyState = ({
  icon: Icon,
  iconClassName = 'h-12 w-12',
  title,
  description,
  action,
  actionText,
  actionClassName = 'inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700',
  className = ''
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <Icon className={`mx-auto ${iconClassName} text-gray-400`} />
      )}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && actionText && (
        <div className="mt-6">
          <button
            onClick={action}
            className={actionClassName}
          >
            {actionText}
          </button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;