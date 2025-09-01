const { query, getClient } = require('../../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

// Get leave requests with filtering and pagination
const getLeaveRequests = async (req, res) => {
  try {
    const currentUser = req.user;
    const {
      page = 1,
      limit = 10,
      status,
      leave_type,
      start_date,
      end_date,
      user_id,
      department
    } = req.query;

    // Build WHERE conditions
    const conditions = [];
    const values = [];
    let paramCount = 0;

    // Role-based access control
    if (currentUser.role === 'employee') {
      conditions.push(`lr.user_id = $${++paramCount}`);
      values.push(currentUser.id);
    } else if (currentUser.role === 'manager') {
      conditions.push(`(lr.user_id = $${++paramCount} OR lr.manager_id = $${++paramCount})`);
      values.push(currentUser.id, currentUser.id);
    }
    // Admin can see all requests - no additional conditions needed

    // Status filter
    if (status) {
      conditions.push(`lr.status = $${++paramCount}`);
      values.push(status);
    }

    // Leave type filter - updated for new enum
    if (leave_type) {
      if (['casual', 'health'].includes(leave_type)) {
        conditions.push(`lt.type = $${++paramCount}`);
        values.push(leave_type);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid leave type',
          code: 'INVALID_LEAVE_TYPE'
        });
      }
    }

    // Date range filter
    if (start_date && end_date) {
      conditions.push(`lr.start_date >= $${++paramCount} AND lr.end_date <= $${++paramCount}`);
      values.push(start_date, end_date);
    }

    // User ID filter (for managers/admins)
    if (user_id && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`lr.user_id = $${++paramCount}`);
      values.push(user_id);
    }

    // Department filter (for managers/admins)
    if (department && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`u.department ILIKE $${++paramCount}`);
      values.push(`%${department}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get leave requests with proper joins
    const requestsResult = await query(`
      SELECT
        lr.id,
        lr.user_id,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.status,
        lr.emergency,
        lr.created_at,
        lr.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.employee_id,
        lt.name as leave_type_name,
        lt.type as leave_type,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name,
        adm.first_name as admin_first_name,
        adm.last_name as admin_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      LEFT JOIN users adm ON lr.admin_id = adm.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `, [...values, parseInt(limit), offset]);

    // Get total count for pagination
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      ${whereClause}
    `, values);

    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        requests: requestsResult.rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_requests: totalCount,
          per_page: parseInt(limit),
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests',
      code: 'FETCH_LEAVE_REQUESTS_ERROR'
    });
  }
};

// Get leave request by ID
const getLeaveRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Get leave request with full details
    const requestResult = await query(`
      SELECT
        lr.*,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.employee_id,
        lt.name as leave_type_name,
        lt.type as leave_type,
        lt.description as leave_type_description,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name,
        adm.first_name as admin_first_name,
        adm.last_name as admin_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      LEFT JOIN users adm ON lr.admin_id = adm.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check permissions with improved role-based access
    if (currentUser.role === 'employee' && currentUser.id !== request.user_id) {
      throw new ForbiddenError('Employees can only view their own leave requests');
    }

    if (currentUser.role === 'manager' && currentUser.id !== request.user_id) {
      const teamCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [request.user_id, currentUser.id]
      );
      if (teamCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only view leave requests from their team members');
      }
    }
    // Admin can view all requests

    // Format response
    const formattedRequest = {
      id: request.id,
      user_id: request.user_id,
      leave_type_id: request.leave_type_id,
      start_date: request.start_date,
      end_date: request.end_date,
      total_days: request.total_days,
      reason: request.reason,
      status: request.status,
      emergency: request.emergency,
      created_at: request.created_at,
      updated_at: request.updated_at,
      user: {
        firstName: request.first_name,
        lastName: request.last_name,
        email: request.email,
        department: request.department,
        employeeId: request.employee_id,
        fullName: `${request.first_name} ${request.last_name}`
      },
      leave_type: {
        name: request.leave_type_name,
        type: request.leave_type,
        description: request.leave_type_description
      },
      approvers: {
        manager: request.manager_first_name && request.manager_last_name
          ? {
              firstName: request.manager_first_name,
              lastName: request.manager_last_name,
              fullName: `${request.manager_first_name} ${request.manager_last_name}`
            }
          : null,
        admin: request.admin_first_name && request.admin_last_name
          ? {
              firstName: request.admin_first_name,
              lastName: request.admin_last_name,
              fullName: `${request.admin_first_name} ${request.admin_last_name}`
            }
          : null
      }
    };

    res.json({
      success: true,
      data: {
        request: formattedRequest
      }
    });

  } catch (error) {
    console.error('Get leave request by ID error:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to fetch leave request';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'FETCH_LEAVE_REQUEST_ERROR'
    });
  }
};

// Create new leave request with improved balance validation
const createLeaveRequest = async (req, res) => {
  console.log('===== START CREATE LEAVE REQUEST LOGGING =====');
  console.log('[DEBUG CREATE] Received req.body:', req.body);
  console.log('[DEBUG CREATE] Received leave_type_id type:', typeof req.body.leave_type_id, 'value:', req.body.leave_type_id);
  console.log('[DEBUG CREATE] Received dates - start_date:', req.body.start_date, 'end_date:', req.body.end_date);
  console.log('[DEBUG CREATE] Received total_days:', req.body.total_days, 'type:', typeof req.body.total_days);
  console.log('[DEBUG CREATE] Received emergency:', req.body.emergency, 'type:', typeof req.body.emergency);
  console.log('[DEBUG CREATE] Received reason:', req.body.reason, 'type:', typeof req.body.reason);
  console.log('===== END REQUEST BODY LOGGING =====');
  try {
    const currentUser = req.user;
    const { leave_type_id, start_date, end_date, reason, emergency = false } = req.body;

    // Validate required fields
    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: leave_type_id, start_date, end_date',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Handle both UUID and slug formats for leave_type_id
    let queryWhere, queryParams;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leave_type_id);

    if (isUUID) {
      // It's a UUID, look up by ID
      queryWhere = 'id = $1';
      queryParams = [leave_type_id];
    } else {
      // It's a slug, clean it up and look up by type
      const cleanType = leave_type_id.replace(/^fallback-/, ''); // Remove 'fallback-' prefix
      queryWhere = 'type = $1';
      queryParams = [cleanType];
    }

    // Validate leave type exists and get constraints
    const leaveTypeResult = await query(
      `SELECT id, type, name, annual_days, max_consecutive_days, notice_period_days FROM leave_types WHERE ${queryWhere}`,
      queryParams
    );

    if (leaveTypeResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type: ${leave_type_id}`,
        code: 'INVALID_LEAVE_TYPE_ID'
      });
    }

    const leaveType = leaveTypeResult.rows[0];
    const actualLeaveTypeId = leaveType.id; // Use actual UUID for database operations
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (startDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past',
        code: 'INVALID_START_DATE'
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
        code: 'INVALID_END_DATE'
      });
    }

    // Calculate total days including weekends/holidays
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

    console.log('===== CALCULATION DEBUG =====');
    console.log('[DEBUG CALC] startDate parsed:', startDate);
    console.log('[DEBUG CALC] endDate parsed:', endDate);
    console.log('[DEBUG CALC] timeDiff (milliseconds):', timeDiff);
    console.log('[DEBUG CALC] totalDays calculated:', totalDays);
    console.log('[DEBUG CALC] Comparison: startDate <= endDate ?', startDate <= endDate);
    console.log('===== END CALCULATION DEBUG =====');

    // Check max consecutive days
    if (leaveType.max_consecutive_days && totalDays > leaveType.max_consecutive_days) {
      return res.status(400).json({
        success: false,
        message: `Maximum consecutive days for ${leaveType.name} is ${leaveType.max_consecutive_days}`,
        code: 'EXCEEDS_MAX_CONSECUTIVE_DAYS'
      });
    }

    // Get user's role and manager
    const userResult = await query('SELECT role, manager_id, department FROM users WHERE id = $1', [currentUser.id]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    const user = userResult.rows[0];

    // Check monthly leave limits for casual and health leave
    if (['casual', 'health'].includes(leaveType.type) || emergency) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1

      // Check current month's usage for this leave type
      const monthlyUsageResult = await query(`
        SELECT used_days, max_allowed FROM monthly_leave_usage
        WHERE user_id = $1 AND leave_type_id = $2 AND year = $3 AND month = $4
      `, [currentUser.id, actualLeaveTypeId, currentYear, currentMonth]);

      let currentMonthlyUsed = 0;
      const monthlyUsageExists = monthlyUsageResult.rows.length > 0;

      if (monthlyUsageExists) {
        currentMonthlyUsed = monthlyUsageResult.rows[0].used_days;
      }

      // Check if this request would exceed monthly limit
      if (currentMonthlyUsed + totalDays > 1 && !emergency) {  // Max 1 day per month per leave type
        return res.status(400).json({
          success: false,
          message: `Cannot apply for ${totalDays} day(s). You have already used ${currentMonthlyUsed} day(s) this month for ${leaveType.name}. Monthly limit: 1 day.`,
          code: 'MONTHLY_LIMIT_EXCEEDED'
        });
      }
    }

    // Check leave balance - only apply to non-admin and non-manager users unless emergency
    if ((user.role !== 'admin' && user.role !== 'manager') || emergency) {
      const currentYear = new Date().getFullYear();
      const balanceResult = await query(
        'SELECT total_days, used_days, pending_days, remaining_days FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
        [currentUser.id, actualLeaveTypeId, currentYear]
      );

      if (balanceResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No leave balance found for this leave type',
          code: 'NO_LEAVE_BALANCE'
        });
      }

      const balance = balanceResult.rows[0];

      if (balance.remaining_days < totalDays && !emergency) {
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance. Available: ${balance.remaining_days} days, Requested: ${totalDays} days`,
          code: 'INSUFFICIENT_LEAVE_BALANCE'
        });
      }
    }

    // Check for overlapping requests
    const overlapResult = await query(
      'SELECT id FROM leave_requests WHERE user_id = $1 AND (start_date <= $3 AND end_date >= $2) AND status NOT IN (\'cancelled\', \'manager_rejected\', \'admin_rejected\')',
      [currentUser.id, start_date, end_date]
    );

    if (overlapResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave request overlaps with existing leave request',
        code: 'OVERLAPPING_REQUEST'
      });
    }

    // Determine approval workflow and status
    let status = 'pending';
    let approverId = null;

    // Determine approval workflow based on user role
    if (user.role === 'employee') {
      status = 'pending'; // Initial submission, waiting for manager approval
      approverId = user.manager_id; // Manager will approve first
      console.log(`Employee "${user.first_name} ${user.last_name}" - Request submitted, awaiting manager approval`);
    } else if (user.role === 'manager') {
      status = 'hr_pending'; // HR submitted, waiting for admin approval
      approverId = null; // Will be set to admin during approval process
      console.log(`Manager (HR) "${user.first_name} ${user.last_name}" - Request submitted, awaiting admin approval`);
    } else if (user.role === 'admin') {
      status = 'admin_approved'; // Auto-approved by HOD
      approverId = user.id;
      console.log(`Admin "${user.first_name} ${user.last_name}" - Request auto-approved`);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role for leave request',
        code: 'INVALID_USER_ROLE'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      console.log('===== DATABASE INSERT DEBUG =====');
      console.log('[DEBUG INSERT] About to insert with values:');
      console.log('[DEBUG INSERT] user_id:', currentUser.id);
      console.log('[DEBUG INSERT] leave_type_id:', actualLeaveTypeId);
      console.log('[DEBUG INSERT] start_date:', start_date);
      console.log('[DEBUG INSERT] end_date:', end_date);
      console.log('[DEBUG INSERT] total_days (calculated):', totalDays, 'vs frontend total_days (ignored):', total_days);
      console.log('[DEBUG INSERT] Is totalDays valid?', !isNaN(totalDays) && totalDays > 0);
      console.log('[DEBUG INSERT] reason:', reason);
      console.log('[DEBUG INSERT] emergency:', emergency || false);
      console.log('[DEBUG INSERT] manager_id:', user.role === 'employee' ? user.manager_id : null);
      console.log('[DEBUG INSERT] admin_id:', approverId);
      console.log('[DEBUG INSERT] status:', status);
      console.log('===== END DATABASE INSERT DEBUG =====');

      const result = await client.query(`
        INSERT INTO leave_requests (
          user_id, leave_type_id, start_date, end_date, total_days,
          reason, emergency, manager_id, admin_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        currentUser.id, actualLeaveTypeId, start_date, end_date, totalDays,
        reason, emergency || false,
        user.role === 'employee' ? user.manager_id : null,
        approverId, status
      ]);

      console.log('[DEBUG INSERT] Insert successful, returned row:', result.rows[0]);

      // Update leave balances ONLY for initial submission (prevent double booking)
      if (status !== 'admin_approved') {
        await client.query(
          `UPDATE leave_balances
           SET pending_days = pending_days + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [totalDays, currentUser.id, actualLeaveTypeId, new Date().getFullYear()]
        );

        // Update monthly leave usage tracking
        if (['casual', 'health'].includes(leaveType.type)) {
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;

          // Try to update existing record, if none exists, create new one
          const updateResult = await client.query(`
            UPDATE monthly_leave_usage
            SET used_days = used_days + $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2 AND leave_type_id = $3 AND year = $4 AND month = $5
            RETURNING *
          `, [totalDays, currentUser.id, actualLeaveTypeId, currentYear, currentMonth]);

          if (updateResult.rows.length === 0) {
            // No existing record, create new one
            await client.query(`
              INSERT INTO monthly_leave_usage (user_id, leave_type_id, year, month, used_days, max_allowed)
              VALUES ($1, $2, $3, $4, $5, 1)
            `, [currentUser.id, actualLeaveTypeId, currentYear, currentMonth, totalDays]);
          }
        }
      }

      await client.query('COMMIT');

      const leaveResponse = result.rows[0];

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        data: {
          id: leaveResponse.id,
          status: leaveResponse.status,
          admin_id: leaveResponse.admin_id,
          manager_id: leaveResponse.manager_id,
          total_days: leaveResponse.total_days,
          leave_type: leaveType.name,
          created_at: leaveResponse.created_at
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create leave request error:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to create leave request';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'CREATE_LEAVE_REQUEST_ERROR'
    });
  }
};

// Cancel leave request with proper balance adjustments
const cancelLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const currentUser = req.user;

    // Get request details with validation
    const requestResult = await query(
      'SELECT user_id, leave_type_id, status, total_days FROM leave_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Permission checks
    if (currentUser.role === 'employee' && currentUser.id !== request.user_id) {
      throw new ForbiddenError('Employees can only cancel their own leave requests');
    }

    if (currentUser.role === 'manager' && currentUser.id !== request.user_id) {
      const teamCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [request.user_id, currentUser.id]
      );
      if (teamCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only cancel leave requests for their team members');
      }
    }

    // Check if request can be cancelled
    const nonCancellableStatuses = ['admin_approved', 'manager_rejected', 'admin_rejected'];
    if (nonCancellableStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel leave request with status: ${request.status}`,
        code: 'CANNOT_CANCEL_REQUEST'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update request status
      await client.query(
        `UPDATE leave_requests
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      // Revert pending days in leave balance (only if not approved)
      if (request.status !== 'admin_approved') {
        const currentYear = new Date().getFullYear();
        await client.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [request.total_days, request.user_id, request.leave_type_id, currentYear]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Leave request cancelled successfully',
        data: {
          id: id,
          status: 'cancelled'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Cancel leave request error:', error);
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to cancel leave request';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'CANCEL_LEAVE_REQUEST_ERROR'
    });
  }
};

module.exports = {
  getLeaveRequests,
  createLeaveRequest,
  getLeaveRequestById,
  cancelLeaveRequest
};