const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists in database
    const userResult = await query(
      'SELECT id, email, first_name, last_name, role, manager_id, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];

    // Check if user is still active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      managerId: user.manager_id,
      fullName: `${user.first_name} ${user.last_name}`
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Role-based access control middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Permission-based middleware factory
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Define role permissions
    const rolePermissions = {
      admin: [
        'read_users', 'write_users', 'delete_users',
        'read_leaves', 'write_leaves', 'delete_leaves',
        'approve_leaves', 'reject_leaves',
        'read_reports', 'export_reports',
        'manage_system_settings'
      ],
      manager: [
        'read_users', 'write_users', // can manage their team
        'read_leaves', 'write_leaves',
        'approve_leaves', 'reject_leaves', // can approve their team's leaves
        'read_reports' // can view team reports
      ],
      hr_manager: [
        'read_users', 'write_users', 'delete_users',
        'read_leaves', 'write_leaves', 'delete_leaves',
        'approve_leaves', 'reject_leaves',
        'read_reports', 'export_reports'
      ],
      employee: [
        'read_own_data', 'write_own_data',
        'read_own_leaves', 'write_own_leaves',
        'read_leave_balances'
      ]
    };

    const userPermissions = rolePermissions[req.user.role] || [];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied',
        requiredPermission: permission,
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    }
  );
};

// Verify refresh token
const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      throw new Error('User not found or inactive');
    }

    return userResult.rows[0];
  } catch (error) {
    throw error;
  }
};

// Middleware to check if user owns the resource or is admin/manager
const requireOwnershipOrRole = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userId = req.params.userId || req.params.id;
    const currentUser = req.user;

    // Admin can access everything
    if (currentUser.role === 'admin') {
      return next();
    }

    // Manager can access their team members' resources
    if (currentUser.role === 'manager') {
      // Check if the target user is in manager's team
      if (resourceType === 'leave') {
        const leaveResult = await query(
          'SELECT user_id FROM leave_requests WHERE id = $1',
          [req.params.id]
        );

        if (leaveResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Leave request not found'
          });
        }

        const targetUserId = leaveResult.rows[0].user_id;

        // Check if target user reports to current manager
        const teamResult = await query(
          'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
          [targetUserId, currentUser.id]
        );

        if (teamResult.rows.length > 0) {
          return next();
        }
      }
    }

    // User can only access their own resources
    if (userId && userId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Can only access own data',
        code: 'ACCESS_DENIED'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireOwnershipOrRole
};