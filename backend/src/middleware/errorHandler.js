// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  // Duplicate key error
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      code: 'DUPLICATE_ERROR',
      field: err.constraint
    });
  }

  // Foreign key constraint error
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced resource does not exist',
      code: 'FOREIGN_KEY_ERROR',
      constraint: err.constraint
    });
  }

  // Check constraint violation
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      code: 'CHECK_CONSTRAINT_ERROR',
      constraint: err.constraint
    });
  }

  // Data type mismatch
  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Invalid data format',
      code: 'INVALID_DATA_FORMAT'
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code || 'CUSTOM_ERROR'
    });
  }

  // Default server error
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    if (typeof fn !== 'function') {
      return next(new Error('Handler must be a function'));
    }
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
};

const { validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  errorHandler,
  asyncHandler,
  validate,
  handleValidationErrors,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError
};