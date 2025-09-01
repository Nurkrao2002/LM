const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { asyncHandler, ValidationError, handleValidationErrors } = require('../middleware/errorHandler');
const {
  getLeaveRequests,
  createLeaveRequest,
  getLeaveRequestById,
  cancelLeaveRequest
} = require('../controllers/leaveControllerComplete');
const {
  approveLeaveAsManager,
  rejectLeaveAsManager,
  approveLeaveAsAdmin,
  rejectLeaveAsAdmin,
  getPendingApprovals
} = require('../controllers/approvalControllerComplete');

// Create leave request validation
const createLeaveRequestValidation = [
  body('leave_type_id').isString().isLength({ min: 1, max: 50 }).withMessage('Valid leave type ID or slug is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').isISO8601().withMessage('Valid end date is required'),
  body('reason').optional().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
  body('emergency').optional().isBoolean().toBoolean(),
  handleValidationErrors
];

// Approval/rejection validation
const approvalValidation = [
  param('id').isUUID(),
  body('comments').optional().isLength({ min: 5, max: 500 }).withMessage('Comments must be 5-500 characters'),
  handleValidationErrors
];

// GET /api/leaves - Get leave requests with filtering and pagination
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['pending', 'hr_pending', 'manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected', 'cancelled']),
    query('leave_type').optional().isIn(['casual', 'health']),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('user_id').optional().isUUID(),
    query('department').optional().isLength({ min: 1, max: 100 }),
    handleValidationErrors
  ],
  asyncHandler(getLeaveRequests)
);

// GET /api/leaves/balances - Get user's leave balances
router.get('/balances',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUser = req.user;
    const { year = new Date().getFullYear() } = req.query;

    const { query } = require('../../config/database');

    console.log('[DEBUG] Fetching balances for user:', currentUser.id, 'year:', year);

    // First check if balances exist
    console.log('[DEBUG BALANCES] Checking balances for user:', currentUser.id, 'year:', year);
    let balances = await query(`
      SELECT
        lb.total_days, lb.used_days, lb.pending_days, lb.remaining_days,
        lt.name, lt.type, lt.description, lt.annual_days
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.type
    `, [currentUser.id, year]);
    console.log('[DEBUG BALANCES] Balances query result count:', balances.rows.length);
    if (balances.rows.length > 0) {
      console.log('[DEBUG BALANCES] Sample balance row:', balances.rows[0]);
    }

    // If no balances exist, create default balances for all leave types
    if (balances.rows.length === 0) {
      console.log('[DEBUG BALANCES] No balances found, creating default balances for user:', currentUser.id);

      const leaveTypes = await query('SELECT id, type, annual_days FROM leave_types ORDER BY type');
      console.log('[DEBUG BALANCES] Leave types found for creation:', leaveTypes.rows.map(lt => ({ type: lt.type, annual_days: lt.annual_days })));

      if (leaveTypes.rows.length > 0) {
        for (const leaveType of leaveTypes.rows) {
          let annualDays = leaveType.annual_days;
          console.log(`[DEBUG BALANCES] Processing ${leaveType.type} with annual_days: ${annualDays}`);

          // Use the values already defined in the database schema
          // No need to override - use the annual_days from database

          // Check if balance already exists before inserting
          const existingBalance = await query(
            'SELECT id FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
            [currentUser.id, leaveType.id, year]
          );

          if (existingBalance.rows.length === 0) {
            console.log(`[DEBUG BALANCES] Creating balance for ${leaveType.type}: user=${currentUser.id}, type=${leaveType.id}, year=${year}, total_days=${annualDays}`);
            await query(`
              INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days)
              VALUES ($1, $2, $3, $4, 0, 0)
            `, [currentUser.id, leaveType.id, year, annualDays]);
            console.log(`[DEBUG BALANCES] Balance created successfully for ${leaveType.type}`);
          } else {
            console.log(`[DEBUG BALANCES] Balance already exists for ${leaveType.type}`);
          }
        }

        // Re-fetch balances after creation
        balances = await query(`
          SELECT
            lb.total_days, lb.used_days, lb.pending_days, lb.remaining_days,
            lt.name, lt.type, lt.description
          FROM leave_balances lb
          JOIN leave_types lt ON lb.leave_type_id = lt.id
          WHERE lb.user_id = $1 AND lb.year = $2
          ORDER BY lt.type
        `, [currentUser.id, year]);

        console.log('[DEBUG] Created default balances:', balances.rows.length + ' rows');
      }
    }

    console.log('[DEBUG] Returning balances:', balances.rows.length + ' rows');

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        balances: balances.rows
      }
    });
  })
);

// GET /api/leaves/monthly-usage - Get current user's monthly usage for current month
router.get('/monthly-usage',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUser = req.user;
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const { query } = require('../../config/database');

    console.log('[DEBUG] Fetching monthly usage for user:', currentUser.id, 'year:', year, 'month:', month);

    // Get monthly usage for all leave types
    const monthlyUsage = await query(`
      SELECT
        mlu.used_days,
        mlu.max_allowed,
        lt.name as leave_type_name,
        lt.type as leave_type
      FROM monthly_leave_usage mlu
      JOIN leave_types lt ON mlu.leave_type_id = lt.id
      WHERE mlu.user_id = $1 AND mlu.year = $2 AND mlu.month = $3
      ORDER BY lt.type
    `, [currentUser.id, year, month]);

    // If no records exist, create default entries
    if (monthlyUsage.rows.length === 0) {
      console.log('[DEBUG] No monthly usage found, creating default entries');

      const leaveTypes = await query('SELECT id, type, name FROM leave_types WHERE type IN (\'casual\', \'health\')');

      for (const leaveType of leaveTypes.rows) {
        await query(`
          INSERT INTO monthly_leave_usage (user_id, leave_type_id, year, month, used_days, max_allowed)
          VALUES ($1, $2, $3, $4, 0, 1)
          ON CONFLICT (user_id, leave_type_id, year, month) DO NOTHING
        `, [currentUser.id, leaveType.id, year, month]);
      }

      // Re-fetch after creation
      const newMonthlyUsage = await query(`
        SELECT
          mlu.used_days,
          mlu.max_allowed,
          lt.name as leave_type_name,
          lt.type as leave_type
        FROM monthly_leave_usage mlu
        JOIN leave_types lt ON mlu.leave_type_id = lt.id
        WHERE mlu.user_id = $1 AND mlu.year = $2 AND mlu.month = $3
        ORDER BY lt.type
      `, [currentUser.id, year, month]);

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          usage: newMonthlyUsage.rows
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          usage: monthlyUsage.rows
        }
      });
    }
  })
);

// POST /api/leaves - Create leave request
router.post('/',
  authenticateToken,
  createLeaveRequestValidation,
  asyncHandler(createLeaveRequest)
);

console.log('[ROUTES] Registering GET /types route');
// GET /api/leaves/types - Get available leave types
router.get('/types',
  authenticateToken,
  asyncHandler(async (req, res) => {
    console.log('[DEBUG] GET /api/leaves/types called');
    console.log('[DEBUG] User:', req.user);

    try {
      const { query } = require('../../config/database');
      console.log('[DEBUG] Database config loaded');

      const leaveTypes = await query(
        'SELECT id, type, name, description, annual_days, notice_period_days FROM leave_types ORDER BY type'
      );
      console.log('[DEBUG] Leave types query result:', leaveTypes.rows.length + ' rows');

      // If no leave types found, create default ones
      if (leaveTypes.rows.length === 0) {
        console.log('[DEBUG] No leave types found, creating default types...');

        // Insert each type individually, checking for existence first
        const typesToCreate = [
          { type: 'casual', name: 'Casual Leave', description: 'General personal or short-term absences', annual_days: 12, notice_period_days: 1 },
          { type: 'health', name: 'Health Leave', description: 'Medical or health-related absences', annual_days: 12, notice_period_days: 1 }
        ];

        for (const typeData of typesToCreate) {
          const existing = await query('SELECT id FROM leave_types WHERE type = $1', [typeData.type]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO leave_types (type, name, description, annual_days, notice_period_days)
              VALUES ($1, $2, $3, $4, $5)
            `, [typeData.type, typeData.name, typeData.description, typeData.annual_days, typeData.notice_period_days]);
          }
        }

        // Re-fetch after creation
        const newLeaveTypes = await query(
          'SELECT id, type, name, description, annual_days, notice_period_days FROM leave_types ORDER BY type'
        );
        console.log('[DEBUG] After creation, leave types:', newLeaveTypes.rows.length + ' rows');

        res.json({
          success: true,
          data: { leave_types: newLeaveTypes.rows }
        });
      } else {
        res.json({
          success: true,
          data: { leave_types: leaveTypes.rows }
        });
      }
      console.log('[DEBUG] Response sent successfully');

    } catch (dbError) {
      console.error('[DEBUG] Database error in /types:', dbError);
      throw dbError;
    }
  })
);

// GET /api/leaves/:id - Get leave request by ID (must be before /pending-approvals to avoid conflict)
router.get('/:id',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(getLeaveRequestById)
);

// GET /api/leaves/pending-approvals - Get pending approvals for manager/admin
router.get('/pending-approvals',
  authenticateToken,
  requireRole('manager', 'admin'),
  [
    query('type').optional().isIn(['manager', 'admin']).withMessage('Type must be "manager" or "admin"'),
    handleValidationErrors
  ],
  asyncHandler(getPendingApprovals)
);

// PUT /api/leaves/:id/cancel - Cancel leave request
router.put('/:id/cancel',
  authenticateToken,
  [
    param('id').isUUID(),
    body('reason').optional().isLength({ min: 5, max: 200 }).withMessage('Cancellation reason must be 5-200 characters'),
    handleValidationErrors
  ],
  asyncHandler(cancelLeaveRequest)
);

router.put('/:id/approve/manager',
  authenticateToken,
  requireRole('manager'),
  approvalValidation,
  asyncHandler(approveLeaveAsManager)
);

// PUT /api/leaves/:id/reject/manager - Reject by manager
router.put('/:id/reject/manager',
  authenticateToken,
  requireRole('manager'),
  approvalValidation,
  asyncHandler(rejectLeaveAsManager)
);

// PUT /api/leaves/:id/approve/admin - Final approve by admin
router.put('/:id/approve/admin',
  authenticateToken,
  requireRole('admin'),
  approvalValidation,
  asyncHandler(approveLeaveAsAdmin)
);

// PUT /api/leaves/:id/reject/admin - Final reject by admin
router.put('/:id/reject/admin',
  authenticateToken,
  requireRole('admin'),
  approvalValidation,
  asyncHandler(rejectLeaveAsAdmin)
);

// Duplicate route removed - using the original one above

// GET /api/leaves/statistics - Get leave statistics (admin only)
router.get('/statistics',
  authenticateToken,
  requireRole('admin'),
  [
    query('year').optional().isInt({ min: 2020, max: 2030 }).toInt(),
    query('force').optional().isBoolean().toBoolean(),
    handleValidationErrors
  ],
  asyncHandler(async (req, res) => {
    const { query } = require('../../config/database');
    const { year = new Date().getFullYear() } = req.query;

    // Overall statistics
    const overallStats = await query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'admin_approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN status IN ('manager_rejected', 'admin_rejected') THEN 1 END) as rejected_requests
      FROM leave_requests
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year]);

    // Leave type breakdown
    const leaveTypeStats = await query(`
      SELECT
        lt.name as leave_type,
        COUNT(lr.id) as requests_count,
        SUM(lr.total_days) as total_days_requested,
        AVG(lr.total_days) as average_days_per_request
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id AND EXTRACT(YEAR FROM lr.created_at) = $1
      GROUP BY lt.id, lt.name
      ORDER BY requests_count DESC
    `, [year]);

    res.json({
      success: true,
      data: {
        year: year,
        overall: overallStats.rows[0],
        by_leave_type: leaveTypeStats.rows
      }
    });
  })
);

module.exports = router;