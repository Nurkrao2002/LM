// Reject leave request (Manager level)
const rejectByManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const currentUser = req.user;
    const { query, getClient } = require('../../config/database');
    const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
    const LeaveRequest = require('../models/LeaveRequest');

    // Get leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, u.email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if current user is the assigned manager
    if (request.manager_id !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to reject this request');
    }

    // Check if request is in pending status
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status.replace('_', ' ')}`,
        code: 'INVALID_STATUS_FOR_REJECTION'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update request status and rejection details
      await client.query(`
        UPDATE leave_requests
        SET
          status = 'manager_rejected',
          manager_comments = $1,
          manager_rejected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [comments, id]);

      // Revert pending days in leave balance
      const currentYear = new Date().getFullYear();
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.total_days, request.user_id, request.leave_type_id, currentYear]
      );

      // Create notification for the employee
      await client.query(`
        INSERT INTO notifications (user_id, leave_request_id, title, message, type)
        VALUES ($1, $2, 'Leave Request Rejected by Manager', 'Your leave request has been rejected by ${currentUser.first_name} ${currentUser.last_name}. Reason: ${comments || 'No reason provided'}', 'rejected')
      `, [request.user_id, id]);

      await client.query('COMMIT');

      // Send email notification
      const { notifyLeaveRequestStatus } = require('../services/notificationService');
      try {
        await notifyLeaveRequestStatus(request, 'manager_rejected', currentUser, comments);
      } catch (notificationError) {
        console.error('Failed to send rejection notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Leave request rejected successfully',
        data: {
          status: 'manager_rejected'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Manager rejection error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reject leave request',
        code: 'REJECT_REQUEST_ERROR'
      });
    }
  }
};

// Approve leave request (Admin level)
const approveByAdmin = async (req, res) => {
  try {
    const { query } = require('../../config/database');
    const { id } = req.params;
    const { comments } = req.body;
    const currentUser = req.user;

    // Get leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, u.email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if request is in manager_approved or hr_pending status
    if (!['manager_approved', 'hr_pending'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Request is not ready for admin approval`,
        code: 'INVALID_STATUS_FOR_ADMIN_APPROVAL'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update request status to admin approved
      await client.query(`
        UPDATE leave_requests
        SET
          status = 'admin_approved',
          admin_comments = $1,
          admin_approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [comments, id]);

      // Update leave balances
      await LeaveRequest.updateLeaveBalances(request);

      // Create final approval notification
      const notificationTitle = 'Leave Request Approved';
      const notificationMessage = `Your leave request has been approved by Admin ${currentUser.firstName} ${currentUser.lastName}`;

      await client.query(`
        INSERT INTO notifications (user_id, leave_request_id, title, message, type)
        VALUES ($1, $2, $3, $4, 'approved')
      `, [request.user_id, id, notificationTitle, notificationMessage]);

      await client.query('COMMIT');

      // Send email notification
      const { notifyLeaveRequestStatus } = require('../services/notificationService');
      try {
        await notifyLeaveRequestStatus(request, 'admin_approved', currentUser, comments);
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Leave request approved by admin successfully',
        data: {
          status: 'admin_approved'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Admin approval error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to approve leave request',
        code: 'ADMIN_APPROVE_REQUEST_ERROR'
      });
    }
  }
};

// Reject leave request (Admin level)
const rejectByAdmin = async (req, res) => {
  try {
    const { query } = require('../../config/database');
    const { id } = req.params;
    const { comments } = req.body;
    const currentUser = req.user;

    // Get leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, u.email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if request can be rejected by admin
    if (!['pending', 'manager_approved', 'hr_pending'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Request status '${request.status}' cannot be rejected by admin`,
        code: 'INVALID_STATUS_FOR_ADMIN_REJECTION'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update request status
      await client.query(`
        UPDATE leave_requests
        SET
          status = 'admin_rejected',
          admin_comments = $1,
          admin_rejected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [comments, id]);

      // Revert pending days in leave balance
      const currentYear = new Date().getFullYear();
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.total_days, request.user_id, request.leave_type_id, currentYear]
      );

      // Create notification
      const notificationTitle = request.status === 'hr_pending'
        ? 'Manager Leave Request Rejected by Admin'
        : 'Leave Request Rejected by Admin';
      const notificationMessage = request.status === 'hr_pending'
        ? `Your leave request has been rejected by Admin ${currentUser.first_name} ${currentUser.last_name}. Reason: ${comments || 'No reason provided'}`
        : `Your leave request has been rejected by ${currentUser.first_name} ${currentUser.last_name}. Reason: ${comments || 'No reason provided'}`;

      await client.query(`
        INSERT INTO notifications (user_id, leave_request_id, title, message, type)
        VALUES ($1, $2, $3, $4, 'rejected')
      `, [request.user_id, id, notificationTitle, notificationMessage]);

      await client.query('COMMIT');

      // Send email notification
      const { notifyLeaveRequestStatus } = require('../services/notificationService');
      try {
        await notifyLeaveRequestStatus(request, 'admin_rejected', currentUser, comments);
      } catch (notificationError) {
        console.error('Failed to send rejection notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Leave request rejected by admin successfully',
        data: {
          status: 'admin_rejected'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Admin rejection error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reject leave request',
        code: 'ADMIN_REJECT_REQUEST_ERROR'
      });
    }
  }
};

// Get pending approvals for manager/admin
const getPendingApprovals = async (req, res) => {
  try {
    const { query } = require('../../config/database');
    const currentUser = req.user;
    const { type } = req.query;

    let whereClause = '';
    let values = [currentUser.id];

    if (currentUser.role === 'admin') {
      if (type === 'manager') {
        // Admins can see all manager-level pending requests (employee requests waiting for manager)
        whereClause = 'lr.status = $1 AND lr.manager_id IS NOT NULL';
        values = ['pending'];
      } else if (type === 'admin') {
        // Admins can see all admin-level pending requests: manager_approved/pending (employees) and hr_pending (managers)
        whereClause = 'lr.status IN ($1, $2, $3)';
        values = ['pending', 'manager_approved', 'hr_pending'];
      } else {
        // Default: show all pending approvals that need admin attention
        whereClause = 'lr.status IN ($1, $2)';
        values = ['pending', 'manager_approved'];
      }
    } else if (currentUser.role === 'manager') {
      // Managers can only see their team's pending requests
      if (type === 'manager') {
        whereClause = 'lr.status = $1 AND lr.manager_id = $2';
        values = ['pending', currentUser.id];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Managers can only view manager-level approvals',
          code: 'INVALID_APPROVAL_TYPE'
        });
      }
    } else {
      throw new ForbiddenError('Only managers and admins can view pending approvals');
    }

    // Get pending requests
    const requestsResult = await query(`
      SELECT
        lr.id,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.reason,
        lr.emergency,
        lr.created_at,
        lr.status,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        lt.name as leave_type_name,
        lt.type as leave_type,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      WHERE ${whereClause}
      ORDER BY lr.created_at ASC
    `, values);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total_pending
      FROM leave_requests lr
      WHERE ${whereClause}
    `, values);

    res.json({
      success: true,
      data: {
        requests: requestsResult.rows,
        total_pending: parseInt(countResult.rows[0].total_pending),
        type: type || 'all'
      }
    });

  } catch (error) {
    console.error('Get pending approvals error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending approvals',
        code: 'FETCH_PENDING_APPROVALS_ERROR'
      });
    }
  }
};

// Approve leave request (Manager level)
const approveByManager = async (req, res) => {
  try {
    const { query } = require('../../config/database');
    const { id } = req.params;
    const { comments } = req.body;
    const currentUser = req.user;

    // Get leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, u.email
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if current user is the assigned manager
    if (request.manager_id !== currentUser.id) {
      throw new ForbiddenError('You are not authorized to approve this request');
    }

    // Check if request is in pending status
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status.replace('_', ' ')}`,
        code: 'INVALID_STATUS_FOR_APPROVAL'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update request status to HR pending (after manager approval)
      await client.query(`
        UPDATE leave_requests
        SET
          status = 'hr_pending',
          manager_comments = $1,
          manager_approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [comments, id]);

      // Update leave balances - increment pending days
      const currentYear = new Date().getFullYear();
      await client.query(
        `UPDATE leave_balances
         SET pending_days = pending_days + $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.total_days, request.user_id, request.leave_type_id, currentYear]
      );

      // Create notification for the employee
      await client.query(`
        INSERT INTO notifications (user_id, leave_request_id, title, message, type)
        VALUES ($1, $2, 'Leave Request Approved by Manager', 'Your leave request has been approved by ${currentUser.first_name} ${currentUser.last_name}. Forwarded to HR for final approval.', 'approved')
      `, [request.user_id, id]);

      await client.query('COMMIT');

      // Send email notification
      const { notifyLeaveRequestStatus } = require('../services/notificationService');
      try {
        await notifyLeaveRequestStatus(request, 'manager_approved', currentUser, comments);
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Leave request approved by manager successfully',
        data: {
          status: 'manager_approved'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Manager approval error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to approve leave request',
        code: 'MANAGER_APPROVE_REQUEST_ERROR'
      });
    }
  }
};

module.exports = {
  approveByManager,
  rejectByManager,
  approveByAdmin,
  rejectByAdmin,
  getPendingApprovals
};