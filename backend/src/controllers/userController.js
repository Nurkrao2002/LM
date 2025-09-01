const { query, getClient } = require('../../config/database');
const { ValidationError, NotFoundError, ForbiddenError, asyncHandler } = require('../middleware/errorHandler');
const { notifyNewUserRegistration, notifyUserStatusUpdate } = require('../services/notificationService');

// Get all users with pagination and filtering
const getUsers = async (req, res) => {
  try {
    const currentUser = req.user;
    const { page = 1, limit = 10, role, department, search, status = 'active', approvalStatus, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate and normalize parameters
    const validPageSizes = [5, 10, 25, 50, 100];
    const normalizedLimit = validPageSizes.includes(parseInt(limit)) ? parseInt(limit) : 10;
    const normalizedPage = Math.max(1, parseInt(page) || 1);
    const validSortOrders = ['asc', 'desc'];
    const normalizedSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

    // Validate sortBy field (security - only allow specific fields)
    const validSortFields = ['created_at', 'first_name', 'last_name', 'email', 'role', 'department', 'date_of_joining', 'is_active'];
    const normalizedSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';

    // Build WHERE conditions
    const conditions = [];
    const values = [];
    let paramCount = 0;

    // Role-based access: Employees see themselves, Department Managers see all employees in their department, Admins see everyone
    if (currentUser.role === 'employee') {
      conditions.push(`u.id = $${++paramCount}`);
      values.push(currentUser.id);
    } else if (currentUser.role === 'manager') {
      // Department managers see all employees in their department
      conditions.push(`(u.id = $${++paramCount} OR u.department = (SELECT department FROM users WHERE id = $${++paramCount} AND role = 'manager'))`);
      values.push(currentUser.id, currentUser.id);
    }
    // Admins see everyone (no additional conditions)

    // Activation status filter (is_active)
    if (status === 'active') {
      conditions.push(`u.is_active = $${++paramCount}`);
      values.push(true);
    } else if (status === 'inactive') {
      conditions.push(`u.is_active = $${++paramCount}`);
      values.push(false);
    }

    // Approval status filter (status column for pending/approved/rejected)
    if (approvalStatus && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`u.status = $${++paramCount}`);
      values.push(approvalStatus);
    }

    // Role filter (only for manager/admin)
    if (role && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`u.role = $${++paramCount}`);
      values.push(role);
    }

    // Department filter
    if (department && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`u.department ILIKE $${++paramCount}`);
      values.push(`%${department}%`);
    }

    // Search filter
    if (search && ['admin', 'manager'].includes(currentUser.role)) {
      conditions.push(`(u.first_name ILIKE $${++paramCount} OR u.last_name ILIKE $${++paramCount} OR u.email ILIKE $${++paramCount})`);
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Calculate offset for pagination
    const offset = (normalizedPage - 1) * normalizedLimit;
    values.push(normalizedLimit, offset);

    // Determine sort column with table prefix
    const sortColumnMap = {
      'created_at': 'u.created_at',
      'first_name': 'u.first_name',
      'last_name': 'u.last_name',
      'email': 'u.email',
      'role': 'u.role',
      'department': 'u.department',
      'date_of_joining': 'u.date_of_joining',
      'is_active': 'u.is_active'
    };
    const sortColumn = sortColumnMap[normalizedSortBy] || 'u.created_at';

    // Main query with pagination and sorting
    const usersQuery = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.role, u.manager_id,
        u.department, u.employee_id, u.date_of_joining, u.is_active, u.status, u.created_at,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        COUNT(*) OVER() as total_count
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      ${whereClause}
      ORDER BY ${sortColumn} ${normalizedSortOrder}
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;

    const users = await query(usersQuery, values);

    // Calculate leave balances for each user (current year)
    if (users.rows.length > 0) {
      const currentYear = new Date().getFullYear();
      const userIds = users.rows.map(user => user.id);

      const balancesQuery = `
        SELECT
          user_id,
          lt.name as leave_type,
          lb.total_days,
          lb.used_days,
          lb.pending_days,
          lb.remaining_days
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.user_id = ANY($1) AND lb.year = $2
        ORDER BY lb.user_id, lt.type
      `;

      const balances = await query(balancesQuery, [userIds, currentYear]);

      // Group balances by user
      const balancesByUser = {};
      balances.rows.forEach(balance => {
        if (!balancesByUser[balance.user_id]) {
          balancesByUser[balance.user_id] = [];
        }
        balancesByUser[balance.user_id].push({
          type: balance.leave_type,
          total: balance.total_days,
          used: balance.used_days,
          pending: balance.pending_days,
          remaining: balance.remaining_days
        });
      });

      // Add balances to users
      users.rows.forEach(user => {
        user.leave_balances = balancesByUser[user.id] || [];
        user.full_name = `${user.first_name} ${user.last_name}`;
        user.manager_name = user.manager_first_name && user.manager_last_name
          ? `${user.manager_first_name} ${user.manager_last_name}`
          : null;
      });
    }

    const totalCount = users.rows.length > 0 ? parseInt(users.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / normalizedLimit);

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          current_page: normalizedPage,
          total_pages: totalPages,
          total_users: totalCount,
          per_page: normalizedLimit,
          has_next: normalizedPage < totalPages,
          has_prev: normalizedPage > 1,
          // Additional metadata
          from: totalCount === 0 ? 0 : offset + 1,
          to: Math.min(offset + normalizedLimit, totalCount),
          showing_count: users.rows.length,
          sort_by: normalizedSortBy,
          sort_order: normalizedSortOrder
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      code: 'FETCH_USERS_ERROR'
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user can access this profile
    if (currentUser.role === 'employee' && currentUser.id !== id) {
      throw new ForbiddenError('Employees can only access their own profile');
    }

    // Check if requesting manager can access team member
    if (currentUser.role === 'manager' && currentUser.id !== id) {
      // Department managers can access all employees in their department
      const managerDeptCheck = await query(
        'SELECT u.id FROM users u WHERE u.id = $1 AND (u.id = $2 OR u.department = (SELECT department FROM users WHERE id = $3 AND role = \'manager\'))',
        [id, currentUser.id, currentUser.id]
      );
      if (managerDeptCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only access employees in their department');
      }
    }

    // Get user details with manager information
    const userQuery = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.role, u.manager_id,
        u.department, u.employee_id, u.date_of_joining, u.is_active, u.created_at, u.updated_at,
        m.first_name as manager_first_name, m.last_name as manager_last_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.id = $1
    `;

    const userResult = await query(userQuery, [id]);

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = userResult.rows[0];

    // Get leave balances for current year
    const currentYear = new Date().getFullYear();
    const balancesQuery = `
      SELECT
        lt.name as leave_type,
        lb.total_days,
        lb.used_days,
        lb.pending_days,
        lb.remaining_days,
        lb.carry_forward_days
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.type
    `;

    const balancesResult = await query(balancesQuery, [id, currentYear]);

    // Get recent leave requests
    const leaveRequestsQuery = `
      SELECT
        lr.id, leave_type_id, lt.name as leave_type, start_date, end_date,
        total_days, status, reason, lr.created_at
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.user_id = $1
      ORDER BY lr.created_at DESC
      LIMIT 10
    `;

    const leaveRequestsResult = await query(leaveRequestsQuery, [id]);

    user.leave_balances = balancesResult.rows;
    user.recent_leave_requests = leaveRequestsResult.rows;
    user.full_name = `${user.first_name} ${user.last_name}`;
    user.manager_name = user.manager_first_name && user.manager_last_name
      ? `${user.manager_first_name} ${user.manager_last_name}`
      : null;

    // Remove sensitive information if not current user
    if (currentUser.id !== id) {
      delete user.email;
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        code: 'FETCH_USER_ERROR'
      });
    }
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const updates = req.body;

    // Check permissions
    if (currentUser.role === 'employee' && currentUser.id !== id) {
      throw new ForbiddenError('Employees can only update their own profile');
    }

    // Check if manager is trying to update team member
    if (currentUser.role === 'manager' && currentUser.id !== id) {
      const managerDeptCheck = await query(
        'SELECT u.id FROM users u WHERE u.id = $1 AND (u.id = $2 OR u.department = (SELECT department FROM users WHERE id = $3 AND role = \'manager\'))',
        [id, currentUser.id, currentUser.id]
      );
      if (managerDeptCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only update employees in their department');
      }
    }

    // Fields that can be updated
    const allowedFields = ['first_name', 'last_name', 'department', 'employee_id'];
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    // Add manager_id only if current user is admin/manager
    if (updates.manager_id && ['admin', 'manager'].includes(currentUser.role)) {
      // Validate that new manager exists and has proper role
      const managerCheck = await query(
        'SELECT id FROM users WHERE id = $1 AND role IN (\'manager\', \'admin\') AND is_active = true',
        [updates.manager_id]
      );
      if (managerCheck.rows.length === 0) {
        throw new ValidationError('Invalid manager ID');
      }
      updateFields.push(`manager_id = $${++paramCount}`);
      values.push(updates.manager_id);
    }

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
        code: 'NO_VALID_UPDATES'
      });
    }

    // Add updated_at and id at the end
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING id, first_name, last_name, department, employee_id, manager_id, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: result.rows[0],
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        code: 'UPDATE_USER_ERROR'
      });
    }
  }
};

// Deactivate/Activate user (soft delete)
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const { is_active: newStatus } = req.body;

    // Only admins can deactivate users
    if (currentUser.role !== 'admin') {
      throw new ForbiddenError('Only admins can change user status');
    }

    // Cannot deactivate self
    if (currentUser.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account',
        code: 'CANNOT_DEACTIVATE_SELF'
      });
    }

    // Check if user exists
    const userCheck = await query('SELECT id, is_active FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      throw new NotFoundError('User');
    }

    // Update user status
    const updateResult = await query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, is_active',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: updateResult.rows[0].id,
        is_active: updateResult.rows[0].is_active
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update user status',
        code: 'TOGGLE_USER_STATUS_ERROR'
      });
    }
  }
};

// Get team members (for managers)
const getTeamMembers = async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'manager') {
      throw new ForbiddenError('Only managers can access team members');
    }

    const { page = 1, limit = 20, search } = req.query;

    // Build query
    const conditions = ['u.manager_id = $1 AND u.is_active = true'];
    const values = [currentUser.id];
    let paramCount = 1;

    // Search filter
    if (search) {
      conditions.push('(u.first_name ILIKE $' + (++paramCount) + ' OR u.last_name ILIKE $' + paramCount + ' OR u.email ILIKE $' + paramCount + ')');
      values.push(`%${search}%`);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);
    values.push(parseInt(limit), offset);

    const teamQuery = `
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.department, u.employee_id,
        COUNT(lr.id) as pending_requests,
        COUNT(lra.id) as approved_requests,
        COUNT(*) OVER() as total_count
      FROM users u
      LEFT JOIN leave_requests lr ON u.id = lr.user_id AND lr.status = 'pending'
      LEFT JOIN leave_requests lra ON u.id = lra.user_id AND lra.status IN ('manager_approved', 'admin_approved')
      WHERE ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.department, u.employee_id
      ORDER BY u.first_name, u.last_name
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;

    const teamResult = await query(teamQuery, values);

    const totalCount = teamResult.rows.length > 0 ? parseInt(teamResult.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        team_members: teamResult.rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_members: totalCount,
          per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get team members error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team members',
        code: 'FETCH_TEAM_MEMBERS_ERROR'
      });
    }
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check permissions
    if (currentUser.role === 'employee' && currentUser.id !== id) {
      throw new ForbiddenError('Employees can only access their own statistics');
    }

    if (currentUser.role === 'manager' && currentUser.id !== id) {
      const managerDeptCheck = await query(
        'SELECT u.id FROM users u WHERE u.id = $1 AND (u.id = $2 OR u.department = (SELECT department FROM users WHERE id = $3 AND role = \'manager\'))',
        [id, currentUser.id, currentUser.id]
      );
      if (managerDeptCheck.rows.length === 0) {
        throw new ForbiddenError('Managers can only access employees in their department');
      }
    }

    const currentYear = new Date().getFullYear();

    // Get leave statistics
    const leaveStatsQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_days) as total_days_requested,
        COUNT(CASE WHEN status = 'admin_approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN status IN ('manager_rejected', 'admin_rejected') THEN 1 END) as rejected_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        AVG(total_days) as avg_days_per_request
      FROM leave_requests
      WHERE user_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
    `;

    const leaveStats = await query(leaveStatsQuery, [id, currentYear]);

    // Get request breakdown by status
    const statusBreakdownQuery = `
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_days) as total_days
      FROM leave_requests
      WHERE user_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusBreakdown = await query(statusBreakdownQuery, [id, currentYear]);

    // Get leave type preferences
    const leaveTypeQuery = `
      SELECT
        lt.name as leave_type,
        COUNT(lr.id) as request_count,
        SUM(lr.total_days) as total_days
      FROM leave_types lt
      LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id AND lr.user_id = $1 AND EXTRACT(YEAR FROM lr.created_at) = $2
      GROUP BY lt.id, lt.name
      ORDER BY request_count DESC
    `;

    const leaveTypeStats = await query(leaveTypeQuery, [id, currentYear]);

    // Get monthly request distribution
    const monthlyDistributionQuery = `
      SELECT
        EXTRACT(MONTH FROM created_at) as month,
        COUNT(*) as request_count,
        SUM(total_days) as total_days
      FROM leave_requests
      WHERE user_id = $1 AND EXTRACT(YEAR FROM created_at) = $2
      GROUP BY EXTRACT(MONTH FROM created_at)
      ORDER BY month
    `;

    const monthlyDistribution = await query(monthlyDistributionQuery, [id, currentYear]);

    // Get current leave balances
    const currentBalancesQuery = `
      SELECT
        lt.name as leave_type,
        lb.total_days,
        lb.used_days,
        lb.pending_days,
        lb.remaining_days,
        lb.carry_forward_days
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.type
    `;

    const currentBalances = await query(currentBalancesQuery, [id, currentYear]);

    const stats = leaveStats.rows[0] || {
      total_requests: 0,
      total_days_requested: 0,
      approved_requests: 0,
      rejected_requests: 0,
      pending_requests: 0,
      avg_days_per_request: 0
    };

    res.json({
      success: true,
      data: {
        year: currentYear,
        overview: {
          totalRequests: parseInt(stats.total_requests || 0),
          totalDaysRequested: parseFloat(stats.total_days_requested || 0),
          approvedRequests: parseInt(stats.approved_requests || 0),
          rejectedRequests: parseInt(stats.rejected_requests || 0),
          pendingRequests: parseInt(stats.pending_requests || 0),
          averageDaysPerRequest: parseFloat(stats.avg_days_per_request || 0)
        },
        statusBreakdown: statusBreakdown.rows,
        leaveTypePreferences: leaveTypeStats.rows,
        monthlyDistribution: monthlyDistribution.rows,
        currentBalances: currentBalances.rows
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics',
        code: 'FETCH_USER_STATS_ERROR'
      });
    }
  }
};

const User = require('../models/User');

// Approve user account
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    console.log(`Approval request by ${currentUser.email} (${currentUser.role}) for user ID: ${id}`);

    // Check permissions - only managers, HR managers and admins can approve
    if (!['admin', 'manager', 'hr_manager'].includes(currentUser.role)) {
      console.log(`Permission denied: User ${currentUser.email} has role ${currentUser.role}`);
      throw new ForbiddenError('Only managers, HR managers and admins can approve user accounts');
    }

    // Check if user exists and is pending
    const userResult = await query('SELECT id, email, first_name, last_name, role, status FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      console.log(`User not found: ${id}`);
      throw new NotFoundError('User');
    }

    const user = userResult.rows[0];

    if (user.status !== 'pending') {
      console.log(`User ${user.email} has status ${user.status}, not pending`);
      return res.status(400).json({
        success: false,
        message: `User has already been ${user.status}`,
        code: 'ALREADY_PROCESSED'
      });
    }

    // Prevent self-approval
    if (currentUser.id === id) {
      console.log(`User ${currentUser.email} tried to approve themselves`);
      return res.status(400).json({
        success: false,
        message: 'You cannot approve your own account',
        code: 'CANNOT_SELF_APPROVE'
      });
    }

    console.log(`Approving user ${user.email} by ${currentUser.email}`);

    const updatedUser = await User.approveUser(id, currentUser.id);

    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    // Notify the user about approval
    try {
      await notifyUserStatusUpdate(updatedUser, 'approved', {
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        role: currentUser.role
      });
      console.log(`Notification sent to ${updatedUser.email}`);
    } catch (notificationError) {
      console.error('Failed to send approval notification:', notificationError);
    }

    console.log(`User ${updatedUser.email} approved successfully`);

    res.json({
      success: true,
      message: 'User account approved successfully',
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          status: updatedUser.status
        }
      }
    });

  } catch (error) {
    console.error('Approve user error:', {
      user: req.user?.email,
      targetUserId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to approve user',
        code: 'APPROVE_USER_ERROR'
      });
    }
  }
};

// Reject user account
const rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const managerId = req.user.id;

    // Check permissions - only managers, HR managers and admins can reject
    if (!['admin', 'manager', 'hr_manager'].includes(req.user.role)) {
      throw new ForbiddenError('Only managers, HR managers and admins can reject user accounts');
    }

    const user = await User.rejectUser(id, managerId);

    if (!user) {
      throw new NotFoundError('User');
    }

    // Notify the user about rejection
    try {
      await notifyUserStatusUpdate(user, 'rejected', { first_name: req.user.first_name, last_name: req.user.last_name, role: req.user.role });
    } catch (notificationError) {
      console.error('Failed to send rejection notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'User account rejected successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.status
        }
      }
    });

  } catch (error) {
    console.error('Reject user error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reject user',
        code: 'REJECT_USER_ERROR'
      });
    }
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  getTeamMembers,
  getUserStats,
  approveUser,
  rejectUser
};