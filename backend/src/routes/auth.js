const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, getClient } = require('../../config/database');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { notifyNewUserRegistration } = require('../services/notificationService');
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken
} = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
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
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .isIn(['employee', 'manager', 'admin'])
    .withMessage('Invalid role specified'),
  body('department')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Department must be between 1 and 100 characters'),
  body('employeeId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Employee ID must be between 1 and 50 characters'),
  body('managerId')
    .optional()
    .isUUID()
    .withMessage('Invalid manager ID format')
];

// Login endpoint
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Login validation failed', errors.array());
  }

  const { email, password } = req.body;

  // Find user by email
  const userResult = await query(
    'SELECT id, email, password_hash, first_name, last_name, role, manager_id, is_active, status FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS'
    });
  }

  const user = userResult.rows[0];

  // Check if user is active
  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      message: 'Account has been deactivated',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  // Check if user is approved
  if (user.status !== 'approved') {
    return res.status(401).json({
      success: false,
      message: user.status === 'pending' ? 'Your account has not been approved. Please contact Administration or HR for activation.' : 'Your account has been rejected. Please contact Administration or HR.',
      code: user.status === 'pending' ? 'ACCOUNT_PENDING' : 'ACCOUNT_REJECTED'
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Generate tokens
  const accessToken = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  // Remove password hash from response
  delete user.password_hash;

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        managerId: user.manager_id,
        fullName: `${user.first_name} ${user.last_name}`
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    }
  });
}));

// Register endpoint (allows anonymous registration + admin/manager can create users)
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Registration validation failed', errors.array());
  }

  const { email, password, firstName, lastName, role, managerId, department, employeeId, dateOfJoining } = req.body;

  // Check if user is authenticated (admin/manager creating user)
  const isAuthenticated = !!req.user;
  const createdBy = req.user ? req.user.id : null;

  // Prepare final values for use
  let finalRole = (role || 'employee');
  let finalManagerId = managerId;

  // If creating user while authenticated, check permissions
  if (isAuthenticated) {
    // Check permissions - only admin can create managers/admins, managers can create employees
    if (req.user.role === 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Employees cannot create user accounts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create admin accounts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    if (role === 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create manager accounts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
  } else {
    // Anonymous registration - prevent admin registration
    if (finalRole === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register as admin through public registration. Only employees and managers can register here.',
        code: 'INVALID_ROLE_FOR_PUBLIC_REGISTRATION'
      });
    }
    finalManagerId = undefined; // Anonymous users can't assign managers
  }

  // Check if email already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new ValidationError('Email already exists');
  }

  // If creating employee, validate manager exists and is active
  if (finalRole === 'employee' && finalManagerId) {
    const managerExists = await query(
      'SELECT id FROM users WHERE id = $1 AND role IN (\'manager\', \'admin\') AND is_active = true',
      [finalManagerId]
    );
    if (managerExists.rows.length === 0) {
      throw new ValidationError('Invalid manager ID or manager is inactive');
    }
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Create user - pending approval (admin will approve)
    const newUserResult = await client.query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, manager_id,
        department, employee_id, date_of_joining, is_active, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'pending')
      RETURNING id, email, first_name, last_name, role, manager_id, department, employee_id, date_of_joining, status
    `, [
      email, hashedPassword, firstName, lastName, finalRole,
      finalManagerId || null, department, employeeId, dateOfJoining
    ]);

    const newUser = newUserResult.rows[0];

    // Create initial leave balances for the user
    const currentYear = new Date().getFullYear();

    // Create initial leave balances - only casual and health as per current schema
    const leaveTypes = await client.query('SELECT id, type, annual_days FROM leave_types WHERE type IN (\'casual\', \'health\')');

    for (const leaveType of leaveTypes.rows) {
      // Both casual and health get 12 days as per requirements
      const annualDays = 12;

      await client.query(`
        INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days, carry_forward_days)
        VALUES ($1, $2, $3, $4, 0, 0, 0)
      `, [newUser.id, leaveType.id, currentYear, annualDays]);

      // Create initial monthly usage tracking for current month
      const currentMonth = new Date().getMonth() + 1;
      await client.query(`
        INSERT INTO monthly_leave_usage (user_id, leave_type_id, year, month, used_days, max_allowed)
        VALUES ($1, $2, $3, $4, 0, 1)
        ON CONFLICT (user_id, leave_type_id, year, month) DO NOTHING
      `, [newUser.id, leaveType.id, currentYear, currentMonth]);
    }

    await client.query('COMMIT');

    // Notify managers about new registration (don't let notification failures affect registration)
    try {
      await notifyNewUserRegistration(newUser);
    } catch (notificationError) {
      console.error('Failed to send registration notifications:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'User account created successfully. Please wait for administrative approval before you can log in.',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          role: newUser.role,
          managerId: newUser.manager_id,
          department: newUser.department,
          employeeId: newUser.employee_id,
          dateOfJoining: newUser.date_of_joining,
          status: newUser.status,
          fullName: `${newUser.first_name} ${newUser.last_name}`
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    const user = await verifyRefreshToken(refreshToken);
    const newAccessToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
}));

// Logout endpoint
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // But we can log the logout event if needed

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const userResult = await query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.manager_id, u.department,
           u.employee_id, u.date_of_joining, u.is_active,
           m.first_name as manager_first_name, m.last_name as manager_last_name
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.id = $1
  `, [req.user.id]);

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  const user = userResult.rows[0];

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        managerId: user.manager_id,
        department: user.department,
        employeeId: user.employee_id,
        dateOfJoining: user.date_of_joining,
        isActive: user.is_active,
        managerName: user.manager_first_name ? `${user.manager_first_name} ${user.manager_last_name}` : null,
        fullName: `${user.first_name} ${user.last_name}`
      }
    }
  });
}));

// Update current user profile
router.put('/me', authenticateToken, [
  body('firstName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('department')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Department must be between 1 and 100 characters'),
  body('employeeId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Employee ID must be between 1 and 50 characters'),
  handleValidationErrors
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Profile update validation failed', errors.array());
  }

  const { firstName, lastName, department, employeeId } = req.body;
  const userId = req.user.id;

  // Build update fields
  const updateFields = [];
  const values = [];
  let paramCount = 0;

  if (firstName !== undefined) {
    updateFields.push(`first_name = $${++paramCount}`);
    values.push(firstName);
  }
  if (lastName !== undefined) {
    updateFields.push(`last_name = $${++paramCount}`);
    values.push(lastName);
  }
  if (department !== undefined) {
    updateFields.push(`department = $${++paramCount}`);
    values.push(department);
  }
  if (employeeId !== undefined) {
    updateFields.push(`employee_id = $${++paramCount}`);
    values.push(employeeId);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields to update',
      code: 'NO_VALID_UPDATES'
    });
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(userId);

  const updateQuery = `
    UPDATE users
    SET ${updateFields.join(', ')}
    WHERE id = $${++paramCount}
    RETURNING id, email, first_name, last_name, department, employee_id, updated_at
  `;

  const result = await query(updateQuery, values);

  if (result.rows.length === 0) {
    throw new NotFoundError('User');
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: result.rows[0],
      updated_at: result.rows[0].updated_at
    }
  });
}));

// Change password endpoint
router.put('/change-password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Password change validation failed', errors.array());
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Get user with password
  const userResult = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect',
      code: 'INCORRECT_PASSWORD'
    });
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hashedNewPassword, userId]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

module.exports = router;