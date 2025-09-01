// ... existing code from previous file
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

    // Status filter
    if (status) {
      conditions.push(`lr.status = $${++paramCount}`);
      values.push(status);
    }

    // Leave type filter
    if (leave_type) {
      conditions.push(`lt.type = $${++paramCount}`);
      values.push(leave_type);
    }

    // Date range filter
    if (start_date && end_date) {
      conditions.push(`lr.start_date >= $${++paramCount} AND lr.end_date <= $${++paramCount}`);
      values.push(start_date, end_date);
    }

    // Department filter (for managers/admins)
    if (department && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`u.department ILIKE $${++paramCount}`);
      values.push(`%${department}%`);
    }

    // User ID filter (for managers/admins)
    if (user_id && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`lr.user_id = $${++paramCount}`);
      values.push(user_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get leave requests
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
        m.last_name as manager_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
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

    // Check permissions
    if (currentUser.role === 'employee' && currentUser.id !== request.user_id) {
      throw new ForbiddenError('Employees can only view their own leave requests');
    }

    if (currentUser.role === 'manager' && currentUser.id !== request.user_id) {
      // Check if it's a request from their team
      const teamCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
        [request.user_id, currentUser.id]
      );
      if (teamCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only view leave requests from their team members');
      }
    }

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
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave request',
        code: 'FETCH_LEAVE_REQUEST_ERROR'
      });
    }
  }
};

const LeaveRequest = require('../models/LeaveRequest');

const createLeaveRequest = async (req, res) => {
  try {
    const currentUser = req.user;
    const { leave_type_id, start_date, end_date, reason, emergency = false } = req.body;

    // Create leave request using the model
    const result = await LeaveRequest.create({
      user_id: currentUser.id,
      leave_type_id,
      start_date,
      end_date,
      reason,
      emergency
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: {
        id: result.id,
        status: result.status,
        admin_id: result.admin_id,
        manager_id: result.manager_id,
        created_at: result.created_at
      }
    });

  } catch (error) {
    console.error('Create leave request error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create leave request',
        code: error.code || 'CREATE_LEAVE_REQUEST_ERROR'
      });
    }
  }
};

// Cancel leave request
const cancelLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if request exists and user has permission to cancel
    const requestResult = await query(
      'SELECT user_id, leave_type_id, status, total_days FROM leave_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check permissions
    if (currentUser.role === 'employee' && currentUser.id !== request.user_id) {
      throw new ForbiddenError('Employees can only cancel their own leave requests');
    }

    if (currentUser.role === 'manager' && currentUser.id !== request.user_id) {
      // Check if request belongs to team member
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

      // Update leave balance (subtract from pending days)
      const currentYear = new Date().getFullYear();
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.total_days, request.user_id, request.leave_type_id, currentYear]
      );

      await client.query('COMMIT');

      // Send cancellation notification
      const { notifyLeaveRequestStatus } = require('../services/notificationService');
      try {
        await notifyLeaveRequestStatus({ ...request, id }, 'cancelled', currentUser, 'Request cancelled by user');
      } catch (notificationError) {
        console.error('Failed to send cancellation notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Leave request cancelled successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Cancel leave request error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel leave request',
        code: 'CANCEL_LEAVE_REQUEST_ERROR'
      });
    }
  }
};

module.exports = {
  getLeaveRequests,
  createLeaveRequest,
  getLeaveRequestById,
  cancelLeaveRequest
};