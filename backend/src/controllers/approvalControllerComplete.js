const { query, getClient } = require('../../config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

// Manager approval endpoint for leave requests
const approveLeaveAsManager = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Verify user is a manager
    if (currentUser.role !== 'manager') {
      throw new ForbiddenError('Only managers can perform manager approvals');
    }

    // Get the leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, lt.name as leave_type_name, lt.type as leave_type
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Verify the manager's access (they can only approve their team's requests)
    const teamMemberCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
      [request.user_id, currentUser.id]
    );

    if (teamMemberCheck.rows.length === 0) {
      throw new ForbiddenError('You can only approve leave requests for your team members');
    }

    // Check if the request is in a state that can be approved by a manager
    const managerApprovableStatuses = ['pending'];

    if (!managerApprovableStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with current status: ${request.status}`,
        code: 'INVALID_STATUS_FOR_APPROVAL'
      });
    }

    // Find admin approver (try to find admin from same department or system admin)
    const adminResult = await query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE u.role = 'admin' AND u.id != $1
      LIMIT 1
    `, [currentUser.id]);

    const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : currentUser.id;

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update the request status to manager_approved
      const updateResult = await client.query(`
        UPDATE leave_requests
        SET status = 'manager_approved', manager_id = $1, admin_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [currentUser.id, adminId, id]);

      // Update leave balance - move from pending to used (if it's the final approval)
      if (request.emergency || request.total_days <= 7) {
        // Emergency/small leave gets auto-admin approval
        await client.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(pending_days - $1, 0),
               used_days = used_days + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [
            request.total_days,
            request.user_id,
            request.leave_type_id,
            new Date().getFullYear()
          ]
        );
      } else {
        // Larger leaves need admin approval
        updateResult.rows[0].status = 'manager_approved';
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Leave request approved by manager',
        data: {
          request: {
            id: id,
            status: updateResult.rows[0].status,
            manager_approved_by: `${currentUser.first_name} ${currentUser.last_name}`,
            total_days: request.total_days,
            leave_type: request.leave_type_name
          }
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
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to approve leave request as manager';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'MANAGER_APPROVAL_ERROR'
    });
  }
};

// Reject leave request as manager
const rejectLeaveAsManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const currentUser = req.user;

    // Verify user is a manager
    if (currentUser.role !== 'manager') {
      throw new ForbiddenError('Only managers can perform manager rejections');
    }

    // Get the leave request details
    const requestResult = await query(`
      SELECT lr.*, lt.name as leave_type_name, lt.type as leave_type
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Verify the manager's access
    const teamMemberCheck = await query(
      'SELECT id FROM users WHERE id = $1 AND manager_id = $2',
      [request.user_id, currentUser.id]
    );

    if (teamMemberCheck.rows.length === 0) {
      throw new ForbiddenError('You can only reject leave requests for your team members');
    }

    // Check if the request can be rejected
    const managerRejectionStatuses = ['pending', 'manager_approved'];

    if (!managerRejectionStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with current status: ${request.status}`,
        code: 'INVALID_STATUS_FOR_REJECTION'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update the request status to manager_rejected
      const updateResult = await client.query(`
        UPDATE leave_requests
        SET status = 'manager_rejected', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      // Revert pending days from leave balance
      if (request.status === 'pending') {
        await client.query(
          `UPDATE leave_balances
           SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [
            request.total_days,
            request.user_id,
            request.leave_type_id,
            new Date().getFullYear()
          ]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Leave request rejected by manager',
        data: {
          request: {
            id: id,
            status: updateResult.rows[0].status,
            rejected_by: `${currentUser.first_name} ${currentUser.last_name}`,
            rejection_reason: reason || 'No reason provided'
          }
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
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to reject leave request as manager';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'MANAGER_REJECTION_ERROR'
    });
  }
};

// Admin approval endpoint for leave requests
const approveLeaveAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Verify user is an admin
    if (currentUser.role !== 'admin') {
      throw new ForbiddenError('Only admins can perform admin approvals');
    }

    // Get the leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, lt.name as leave_type_name, lt.type as leave_type
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if the request is in a state that can be approved by an admin
    const adminApprovableStatuses = ['pending', 'manager_approved', 'hr_pending'];

    if (!adminApprovableStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with current status: ${request.status}`,
        code: 'INVALID_STATUS_FOR_ADMIN_APPROVAL'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update the request status to admin_approved
      const updateResult = await client.query(`
        UPDATE leave_requests
        SET status = 'admin_approved', admin_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [currentUser.id, id]);

      // Update leave balance - subtract from pending and add to used
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(pending_days - $1, 0),
             used_days = used_days + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [
          request.total_days,
          request.user_id,
          request.leave_type_id,
          new Date().getFullYear()
        ]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Leave request approved by admin',
        data: {
          request: {
            id: id,
            status: updateResult.rows[0].status,
            admin_approved_by: `${currentUser.first_name} ${currentUser.last_name}`,
            total_days: request.total_days,
            leave_type: request.leave_type_name
          }
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
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to approve leave request as admin';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'ADMIN_APPROVAL_ERROR'
    });
  }
};

// Reject leave request as admin
const rejectLeaveAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const currentUser = req.user;

    // Verify user is an admin
    if (currentUser.role !== 'admin') {
      throw new ForbiddenError('Only admins can perform admin rejections');
    }

    // Get the leave request details
    const requestResult = await query(`
      SELECT lr.*, u.first_name, u.last_name, lt.name as leave_type_name, lt.type as leave_type
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      throw new NotFoundError('Leave request');
    }

    const request = requestResult.rows[0];

    // Check if the request can be rejected
    const adminRejectionStatuses = ['pending', 'manager_approved', 'hr_pending'];

    if (!adminRejectionStatuses.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with current status: ${request.status}`,
        code: 'INVALID_STATUS_FOR_ADMIN_REJECTION'
      });
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update the request status to admin_rejected
      const updateResult = await client.query(`
        UPDATE leave_requests
        SET status = 'admin_rejected', admin_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [currentUser.id, id]);

      // Revert pending days from leave balance
      await client.query(
        `UPDATE leave_balances
         SET pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [
          request.total_days,
          request.user_id,
          request.leave_type_id,
          new Date().getFullYear()
        ]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Leave request rejected by admin',
        data: {
          request: {
            id: id,
            status: updateResult.rows[0].status,
            rejected_by: `${currentUser.first_name} ${currentUser.last_name}`,
            rejection_reason: reason || 'No reason provided'
          }
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
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to reject leave request as admin';

    res.status(statusCode).json({
      success: false,
      message: message,
      code: error.code || 'ADMIN_REJECTION_ERROR'
    });
  }
};

// Get pending approvals for current user (manager or admin)
const getPendingApprovals = async (req, res) => {
  try {
    const currentUser = req.user;
    let whereConditions = [];
    let values = [];
    let conditionIndex = 0;

    if (currentUser.role === 'manager') {
      // Managers see requests from their team that are pending
      whereConditions.push(`lr.manager_id = $${++conditionIndex}`);
      values.push(currentUser.id);

      whereConditions.push(`lr.status = $${++conditionIndex}`);
      values.push('pending');

    } else if (currentUser.role === 'admin') {
      // Admins see requests that are waiting for admin approval
      whereConditions.push(`lr.status IN ($${++conditionIndex}, $${++conditionIndex}, $${++conditionIndex})`);
      values.push('pending', 'manager_approved', 'hr_pending');

    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const pendingResult = await query(`
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
        u.first_name,
        u.last_name,
        u.email,
        u.employee_id,
        u.department,
        lt.name as leave_type_name,
        lt.type as leave_type
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      ${whereClause}
      ORDER BY lr.created_at ASC
    `, values);

    // Format the response
    const formattedRequests = pendingResult.rows.map(request => ({
      id: request.id,
      user_id: request.user_id,
      requester: {
        fullName: `${request.first_name} ${request.last_name}`,
        employeeId: request.employee_id,
        department: request.department,
        email: request.email
      },
      leave_type: {
        name: request.leave_type_name,
        type: request.leave_type
      },
      dates: {
        start_date: request.start_date,
        end_date: request.end_date,
        total_days: request.total_days
      },
      reason: request.reason,
      status: request.status,
      emergency: request.emergency,
      created_at: request.created_at
    }));

    res.json({
      success: true,
      data: {
        count: formattedRequests.length,
        requests: formattedRequests
      }
    });

  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      code: 'FETCH_PENDING_APPROVALS_ERROR'
    });
  }
};

module.exports = {
  approveLeaveAsManager,
  rejectLeaveAsManager,
  approveLeaveAsAdmin,
  rejectLeaveAsAdmin,
  getPendingApprovals
};