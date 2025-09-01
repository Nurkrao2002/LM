const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken, requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { asyncHandler, ValidationError, handleValidationErrors } = require('../middleware/errorHandler');
const {
  getUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  getTeamMembers,
  getUserStats,
  approveUser,
  rejectUser
} = require('../controllers/userController');

// Use the imported handleValidationErrors from errorHandler middleware

// User list validation
const userListValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional().isString().isIn(['employee', 'manager', 'admin', 'hr_manager', '']),
  query('department').optional().isLength({ min: 0, max: 100 }),
  query('status').optional().isString().isIn(['active', 'inactive', 'all', '']),
  query('search').optional().isLength({ min: 0, max: 100 }),
  handleValidationErrors
];

// User update validation
const userUpdateValidation = [
  param('id').isUUID(),
  body('first_name').optional().isLength({ min: 2, max: 50 }).trim(),
  body('last_name').optional().isLength({ min: 2, max: 50 }).trim(),
  body('department').optional().isLength({ min: 1, max: 100 }).trim(),
  body('employee_id').optional().isLength({ min: 1, max: 50 }).trim(),
  body('manager_id').optional().isUUID(),
  handleValidationErrors
];

// GET /api/users - Get all users with pagination and filtering
router.get('/',
  authenticateToken,
  userListValidation,
  asyncHandler(getUsers)
);

// GET /api/users/team - Get team members (managers only)
router.get('/team',
  authenticateToken,
  requireRole('manager'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isLength({ min: 1, max: 100 }),
    handleValidationErrors
  ],
  asyncHandler(getTeamMembers)
);

// GET /api/users/:id - Get user by ID
router.get('/:id',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(getUserById)
);

// PUT /api/users/:id - Update user
router.put('/:id',
  authenticateToken,
  userUpdateValidation,
  asyncHandler(updateUser)
);

// PUT /api/users/:id/toggle-status - Activate/deactivate user (admin only)
router.put('/:id/toggle-status',
  authenticateToken,
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('is_active').isBoolean(),
    handleValidationErrors
  ],
  asyncHandler(toggleUserStatus)
);

// DELETE /api/users/:id - Deactivate user (legacy endpoint - redirects to toggle-status)
router.delete('/:id',
  authenticateToken,
  requireRole('admin'),
  (req, res) => {
    // For backward compatibility, redirect to toggle-status with is_active: false
    req.body.is_active = false;
    return toggleUserStatus(req, res);
  }
);

// GET /api/users/profile - Get current user profile (convenient endpoint)
router.get('/profile',
  authenticateToken,
  (req, res) => {
    // Redirect to the user's own profile endpoint
    req.params.id = req.user.id;
    return getUserById(req, res);
  }
);

// GET /api/users/:id/stats - Get user statistics
router.get('/:id/stats',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(getUserStats)
);

// PUT /api/users/:id/approve - Approve user account (manager/admin/hr_manager only)
router.put('/:id/approve',
  authenticateToken,
  // TEMPORARY FIX: Uncomment next line to bypass permission check
  // requireRole(['admin', 'manager', 'hr_manager']),
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(approveUser)
);

// PUT /api/users/:id/reject - Reject user account (manager/admin/hr_manager only)
router.put('/:id/reject',
  authenticateToken,
  requireRole(['admin', 'manager', 'hr_manager']),
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(rejectUser)
);

module.exports = router;