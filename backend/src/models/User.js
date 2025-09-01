const { query, getClient } = require('../../config/database');

class User {
  static async create(userData) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { email, password_hash, firstName, lastName, role, managerId, department, employeeId, dateOfJoining } = userData;

      const result = await client.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, manager_id,
          department, employee_id, date_of_joining, is_active, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'pending')
        RETURNING *
      `, [
        email, password_hash, firstName, lastName, role || 'employee',
        managerId || null, department, employeeId, dateOfJoining
      ]);

      // Create initial leave balances for the user (only casual and health, 12 each)
      const currentYear = new Date().getFullYear();

      const leaveTypes = await client.query('SELECT id, type, annual_days FROM leave_types');

      for (const leaveType of leaveTypes.rows) {
        // Only create balances for casual and health leaves
        if (['casual', 'health'].includes(leaveType.type)) {
          const annualDays = leaveType.annual_days; // Use database value, should be 12

          await client.query(`
            INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days, carry_forward_days)
            VALUES ($1, $2, $3, $4, 0, 0, $4, 0)
          `, [result.rows[0].id, leaveType.id, currentYear, annualDays]);

          // Also create monthly tracking records for the current month
          const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1
          await client.query(`
            INSERT INTO monthly_leave_usage (user_id, leave_type_id, year, month, used_days, max_allowed)
            VALUES ($1, $2, $3, $4, 0, 1)
          `, [result.rows[0].id, leaveType.id, currentYear, currentMonth]);
        }
      }

      await client.query('COMMIT');
      return result.rows[0];

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
        u.*,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async approveUser(userId, managerId) {
    const result = await query(`
      UPDATE users
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [userId]);

    return result.rows[0] || null;
  }

  static async rejectUser(userId, managerId) {
    const result = await query(`
      UPDATE users
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [userId]);

    return result.rows[0] || null;
  }

  static async findAll(filters = {}) {
    const conditions = [];
    const values = [];
    let paramCount = 0;

    const { role, department, search, status = 'active', managerId } = filters;

    // Status filter
    if (status === 'active') {
      conditions.push(`is_active = $${++paramCount}`);
      values.push(true);
    } else if (status === 'inactive') {
      conditions.push(`is_active = $${++paramCount}`);
      values.push(false);
    }

    // Role filter
    if (role) {
      conditions.push(`role = $${++paramCount}`);
      values.push(role);
    }

    // Department filter
    if (department) {
      conditions.push(`department ILIKE $${++paramCount}`);
      values.push(`%${department}%`);
    }

    // Manager filter
    if (managerId) {
      conditions.push(`manager_id = $${++paramCount}`);
      values.push(managerId);
    }

    // Search filter
    if (search) {
      conditions.push(`(first_name ILIKE $${++paramCount} OR last_name ILIKE $${++paramCount} OR email ILIKE $${++paramCount})`);
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT
        u.*,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      ${whereClause}
      ORDER BY u.created_at DESC
    `, values);

    return result.rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && ['first_name', 'last_name', 'department', 'employee_id', 'manager_id', 'is_active'].includes(key)) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  static async changePassword(id, newPasswordHash) {
    const result = await query(`
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [newPasswordHash, id]);

    return result.rows[0] || null;
  }

  static async delete(id) {
    await query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    return true;
  }

  static async getTeamMembers(managerId) {
    const result = await query(`
      SELECT
        u.*,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.manager_id = $1 AND u.is_active = true
      ORDER BY u.first_name, u.last_name
    `, [managerId]);

    return result.rows;
  }

  static async getLeaveBalances(userId, year = null) {
    const yearParam = year || new Date().getFullYear();

    const result = await query(`
      SELECT
        lb.*,
        lt.name, lt.type, lt.description
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.type
    `, [userId, yearParam]);

    return result.rows;
  }
}

module.exports = User;