const { query, getClient } = require('../../config/database');

class LeaveRequest {
  static async create(requestData) {
    console.log('[MODEL DEBUG] LeaveRequest.create called with data:', requestData);
    console.log('[MODEL DEBUG] user_id:', requestData.user_id, 'leave_type_id:', requestData.leave_type_id);
    console.log('[MODEL DEBUG] start_date:', requestData.start_date, 'end_date:', requestData.end_date);
    const { query, getClient } = require('../../config/database');

    // Validate leave type exists and get constraints
    const leaveTypeResult = await query(
      'SELECT id, type, annual_days, max_consecutive_days, notice_period_days FROM leave_types WHERE id = $1',
      [requestData.leave_type_id]
    );

    if (leaveTypeResult.rows.length === 0) {
      throw new Error('Invalid leave type');
    }

    const leaveType = leaveTypeResult.rows[0];
    const startDate = new Date(requestData.start_date);
    const endDate = new Date(requestData.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (startDate < today) {
      throw new Error('Start date cannot be in the past');
    }

    if (endDate < startDate) {
      throw new Error('End date must be after start date');
    }

    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Check max consecutive days
    if (leaveType.max_consecutive_days && totalDays > leaveType.max_consecutive_days) {
      throw new Error(`Maximum consecutive days for ${leaveType.type} leave is ${leaveType.max_consecutive_days}`);
    }

    // Get user's role and manager
    const userResult = await query('SELECT role, manager_id, department FROM users WHERE id = $1', [requestData.user_id]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    const user = userResult.rows[0];

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balanceResult = await query(
      'SELECT total_days, used_days, pending_days, remaining_days FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
      [requestData.user_id, requestData.leave_type_id, currentYear]
    );

    if (balanceResult.rows.length === 0) {
      throw new Error('No leave balance found for this leave type and year');
    }

    const balance = balanceResult.rows[0];

    // Check if user has sufficient balance
    console.log('Checking balance for role:', user.role, 'remaining:', balance.remaining_days, 'requested:', totalDays);
    if (user.role !== 'admin' && balance.remaining_days < totalDays && !requestData.emergency) {
      throw new Error(`Insufficient leave balance. Available: ${balance.remaining_days} days, Requested: ${totalDays} days`);
    }

    // Check for overlapping requests
    const overlapResult = await query(
      'SELECT id FROM leave_requests WHERE user_id = $1 AND (start_date <= $3 AND end_date >= $2) AND status NOT IN (\'cancelled\', \'manager_rejected\', \'admin_rejected\')',
      [requestData.user_id, requestData.start_date, requestData.end_date]
    );

    if (overlapResult.rows.length > 0) {
      throw new Error('Leave request overlaps with existing leave request');
    }


    let status = 'pending';
    let approverId = null;

    // Determine approval workflow based on user role
    if (user.role === 'employee') {
      // Employee workflow: Manager approval → HR/Admin approval
      status = 'pending'; // Initial submission, waiting for manager approval
      approverId = user.manager_id; // Manager will approve first
      console.log(`Employee "${user.first_name} ${user.last_name}" - Request submitted, awaiting manager approval`);
    } else if (user.role === 'manager') {
      // Manager (HR) workflow: Direct admin approval
      status = 'hr_pending'; // HR submitted, waiting for admin approval
      approverId = null; // Will be set to admin during approval process
      console.log(`Manager (HR) "${user.first_name} ${user.last_name}" - Request submitted, awaiting admin approval`);
    } else if (user.role === 'admin') {
      // Admin workflow: Auto-approved
      status = 'admin_approved'; // Auto-approved by HOD
      approverId = user.id;
      console.log(`Admin "${user.first_name} ${user.last_name}" - Request auto-approved`);
    } else {
      throw new Error(`Unknown role: ${user.role}`);
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO leave_requests (
          user_id, leave_type_id, start_date, end_date, total_days,
          reason, emergency, manager_id, admin_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        requestData.user_id, requestData.leave_type_id, requestData.start_date,
        requestData.end_date, totalDays, requestData.reason, requestData.emergency || false,
        user.role === 'employee' ? user.manager_id : null,
        approverId,
        status
      ]);

      // Update leave balances
      if (status === 'admin_approved') {
        await client.query(
          `UPDATE leave_balances
           SET used_days = used_days + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [totalDays, requestData.user_id, requestData.leave_type_id, currentYear]
        );
      } else {
        await client.query(
          `UPDATE leave_balances
           SET pending_days = pending_days + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
          [totalDays, requestData.user_id, requestData.leave_type_id, currentYear]
        );
      }

      await client.query('COMMIT');

      return { ...result.rows[0], manager_notified: !!user.manager_id };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    const result = await query(`
      SELECT
        lr.*,
        u.first_name, u.last_name, u.email, u.department, u.role as user_role,
        lt.name as leave_type_name, lt.type as leave_type,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        adm.first_name as admin_first_name, adm.last_name as admin_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      LEFT JOIN users adm ON lr.admin_id = adm.id
      WHERE lr.id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  static async findByUserId(userId, filters = {}) {
    const conditions = ['lr.user_id = $1'];
    const values = [userId];
    let paramCount = 1;

    const { status, leave_type, start_date, end_date } = filters;

    if (status) {
      conditions.push(`lr.status = $${++paramCount}`);
      values.push(status);
    }

    if (leave_type) {
      conditions.push(`lt.type = $${++paramCount}`);
      values.push(leave_type);
    }

    if (start_date && end_date) {
      conditions.push(`lr.start_date >= $${++paramCount} AND lr.end_date <= $${++paramCount}`);
      values.push(start_date, end_date);
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(`
      SELECT
        lr.*,
        lt.name as leave_type_name, lt.type as leave_type
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY lr.created_at DESC
    `, values);

    return result.rows;
  }

  static async findAll(filters = {}) {
    const conditions = [];
    const values = [];
    let paramCount = 0;

    const {
      user_id, status, leave_type, start_date, end_date, department,
      manager_id, page = 1, limit = 10
    } = filters;

    if (user_id) {
      conditions.push(`lr.user_id = $${++paramCount}`);
      values.push(user_id);
    }

    if (status) {
      conditions.push(`lr.status = $${++paramCount}`);
      values.push(status);
    }

    if (leave_type) {
      conditions.push(`lt.type = $${++paramCount}`);
      values.push(leave_type);
    }

    if (start_date) {
      conditions.push(`lr.start_date >= $${++paramCount}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`lr.end_date <= $${++paramCount}`);
      values.push(end_date);
    }

    if (department) {
      conditions.push(`u.department ILIKE $${++paramCount}`);
      values.push(`%${department}%`);
    }

    if (manager_id) {
      conditions.push(`u.manager_id = $${++paramCount}`);
      values.push(manager_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    values.push(limit, offset);

    const result = await query(`
      SELECT
        lr.*,
        u.first_name, u.last_name, u.email, u.department, u.role as user_role,
        lt.name as leave_type_name, lt.type as leave_type,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        adm.first_name as admin_first_name, adm.last_name as admin_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      LEFT JOIN users adm ON lr.admin_id = adm.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `, values);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      ${whereClause}
    `, values.slice(0, -2)); // Remove limit and offset from count query

    return {
      requests: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  static async updateStatus(id, statusUpdate) {
    const { status, comments, approved_by } = statusUpdate;

    const updateFields = ['status = $1'];
    const values = [status];
    let paramCount = 1;

    if (comments) {
      if (status === 'manager_approved') {
        updateFields.push('manager_comments = $' + (++paramCount));
        values.push(comments);
        updateFields.push('manager_approved_at = CURRENT_TIMESTAMP');
      } else if (status === 'manager_rejected') {
        updateFields.push('manager_comments = $' + (++paramCount));
        values.push(comments);
        updateFields.push('manager_rejected_at = CURRENT_TIMESTAMP');
      } else if (status === 'admin_approved') {
        updateFields.push('admin_comments = $' + (++paramCount));
        values.push(comments);
        updateFields.push('admin_approved_at = CURRENT_TIMESTAMP');
      } else if (status === 'admin_rejected') {
        updateFields.push('admin_comments = $' + (++paramCount));
        values.push(comments);
        updateFields.push('admin_rejected_at = CURRENT_TIMESTAMP');
      }
    }

    if (approved_by) {
      if (status === 'admin_approved' || status === 'admin_rejected') {
        updateFields.push('admin_id = $' + (++paramCount));
        values.push(approved_by);
      }
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await query(`
      UPDATE leave_requests
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `, values);

    // Update leave balances if approved
    if (status === 'admin_approved') {
      await this.updateLeaveBalances(result.rows[0]);
    }

    return result.rows[0];
  }

  static async updateLeaveBalances(request) {
    const currentYear = new Date().getFullYear();

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Update used days
      await client.query(
        `UPDATE leave_balances
         SET used_days = used_days + $1, pending_days = GREATEST(pending_days - $1, 0), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.total_days, request.user_id, request.leave_type_id, currentYear]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cancel(id) {
    const result = await query(`
      SELECT * FROM leave_requests WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = result.rows[0];

    // Check if request can be cancelled
    if (!['pending', 'hr_pending', 'manager_approved'].includes(request.status)) {
      throw new Error(`Cannot cancel leave request with status: ${request.status}`);
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

      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getPendingApprovals(type, userId = null) {
    let whereClause = '';
    const values = [];

    if (type === 'manager') {
      whereClause = 'lr.status = $1 AND lr.manager_id = $2';
      values.push('pending', userId);
    } else if (type === 'admin') {
      // Admin handles both manager_approved (from employee requests) and hr_pending (from manager requests)
      whereClause = 'lr.status IN ($1, $2)';
      values.push('manager_approved', 'hr_pending');
    }

    const result = await query(`
      SELECT
        lr.*,
        u.first_name, u.last_name, u.email, u.department, u.role as user_role,
        lt.name as leave_type_name, lt.type as leave_type,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        adm.first_name as admin_first_name, adm.last_name as admin_last_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users m ON lr.manager_id = m.id
      LEFT JOIN users adm ON lr.admin_id = adm.id
      WHERE ${whereClause}
      ORDER BY lr.created_at ASC
    `, values);

    return result.rows;
  }

  static async getStatistics(year = null) {
    const yearParam = year || new Date().getFullYear();

    const [overallStats, leaveTypeStats, monthlyStats] = await Promise.all([
      // Overall statistics
      query(`
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status IN ('pending', 'hr_pending') THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'manager_approved' THEN 1 END) as manager_approved_requests,
          COUNT(CASE WHEN status = 'admin_approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN status IN ('manager_rejected', 'admin_rejected') THEN 1 END) as rejected_requests,
          SUM(CASE WHEN status = 'admin_approved' THEN total_days ELSE 0 END) as total_days_approved
        FROM leave_requests
        WHERE EXTRACT(YEAR FROM created_at) = $1
      `, [yearParam]),

      // Leave type breakdown
      query(`
        SELECT
          lt.name as leave_type,
          COUNT(lr.id) as requests_count,
          SUM(CASE WHEN lr.status = 'admin_approved' THEN lr.total_days ELSE 0 END) as days_approved,
          AVG(CASE WHEN lr.status IN ('manager_approved', 'admin_approved') THEN lr.total_days ELSE NULL END) as average_days_per_request
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id AND EXTRACT(YEAR FROM lr.created_at) = $1
        GROUP BY lt.id, lt.name
        ORDER BY requests_count DESC
      `, [yearParam]),

      // Monthly breakdown
      query(`
        SELECT
          EXTRACT(MONTH FROM created_at) as month,
          COUNT(*) as requests_count,
          SUM(CASE WHEN status = 'admin_approved' THEN total_days ELSE 0 END) as approved_days
        FROM leave_requests
        WHERE EXTRACT(YEAR FROM created_at) = $1
        GROUP BY EXTRACT(MONTH FROM created_at)
        ORDER BY month
      `, [yearParam])
    ]);

    return {
      year: yearParam,
      overall: overallStats.rows[0],
      by_leave_type: leaveTypeStats.rows,
      by_month: monthlyStats.rows
    };
  }
}

module.exports = LeaveRequest;