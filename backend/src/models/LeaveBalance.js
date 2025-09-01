const { query, getClient } = require('../../config/database');

class LeaveBalance {
  static async findByUserAndYear(userId, year = null) {
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

  static async findByUserLeaveTypeAndYear(userId, leaveTypeId, year = null) {
    const yearParam = year || new Date().getFullYear();

    const result = await query(`
      SELECT * FROM leave_balances
      WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
    `, [userId, leaveTypeId, yearParam]);

    return result.rows[0] || null;
  }

  static async updateBalance(userId, leaveTypeId, year, changes) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    // Define allowed fields for updates
    const allowedFields = ['used_days', 'pending_days', 'carry_forward_days'];

    Object.keys(changes).forEach(key => {
      if (allowedFields.includes(key) && changes[key] !== undefined) {
        // Handle increment/decrement operations
        if (typeof changes[key] === 'object' && changes[key].operation) {
          const { operation, value } = changes[key];
          if (operation === 'increment') {
            fields.push(`${key} = ${key} + $${++paramCount}`);
          } else if (operation === 'decrement') {
            fields.push(`${key} = GREATEST(${key} - $${++paramCount}, 0)`);
          }
          values.push(value);
        } else {
          fields.push(`${key} = $${++paramCount}`);
          values.push(changes[key]);
        }
      }
    });

    if (fields.length === 0) {
      return null;
    }

    values.push(userId, leaveTypeId, year);

    const result = await query(`
      UPDATE leave_balances
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${++paramCount} AND leave_type_id = $${++paramCount} AND year = $${++paramCount}
      RETURNING *
    `, values);

    // Recalculate remaining days
    if (result.rows.length > 0) {
      await query(`
        UPDATE leave_balances
        SET remaining_days = GREATEST(total_days - used_days - pending_days + carry_forward_days, 0)
        WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
      `, [userId, leaveTypeId, year]);
    }

    return result.rows[0] || null;
  }

  static async createBulkLeaveBalances(userIds, year = null) {
    const yearParam = year || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1

    // Get only casual and health leave types
    const leaveTypes = await query("SELECT * FROM leave_types WHERE type IN ('casual', 'health')");

    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const userId of userIds) {
        for (const leaveType of leaveTypes.rows) {
          // Check if balance already exists
          const existingBalance = await client.query(
            'SELECT id FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
            [userId, leaveType.id, yearParam]
          );

          if (existingBalance.rows.length === 0) {
            await client.query(`
              INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days, carry_forward_days)
              VALUES ($1, $2, $3, $4, 0, 0, $4, 0)
            `, [userId, leaveType.id, yearParam, leaveType.annual_days]);
          }

          // Also check and create monthly usage tracking for current month
          const existingMonthlyUsage = await client.query(
            'SELECT id FROM monthly_leave_usage WHERE user_id = $1 AND leave_type_id = $2 AND year = $3 AND month = $4',
            [userId, leaveType.id, yearParam, currentMonth]
          );

          if (existingMonthlyUsage.rows.length === 0) {
            await client.query(`
              INSERT INTO monthly_leave_usage (user_id, leave_type_id, year, month, used_days, max_allowed)
              VALUES ($1, $2, $3, $4, 0, 1)
            `, [userId, leaveType.id, yearParam, currentMonth]);
          }
        }
      }

      await client.query('COMMIT');
      return { success: true, message: `Leave balances created for ${userIds.length} users` };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getUserLeaveSummary(userId, year = null) {
    const balances = await this.findByUserAndYear(userId, year);

    const summary = {
      total_balance: 0,
      used_days: 0,
      pending_days: 0,
      remaining_days: 0,
      balances: balances
    };

    balances.forEach(balance => {
      summary.total_balance += balance.total_days;
      summary.used_days += balance.used_days;
      summary.pending_days += balance.pending_days;
      summary.remaining_days += balance.remaining_days;
    });

    return summary;
  }

  static async rolloverBalances(fromYear, toYear) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Get leave types that allow carry forward
      const leaveTypes = await client.query('SELECT * FROM leave_types WHERE carry_forward_days > 0');

      for (const leaveType of leaveTypes.rows) {
        // Get balances that have unused days to carry forward
        const balancesToRollover = await client.query(`
          SELECT * FROM leave_balances
          WHERE leave_type_id = $1 AND year = $2 AND remaining_days > 0
        `, [leaveType.id, fromYear]);

        for (const balance of balancesToRollover.rows) {
          const carryForwardDays = Math.min(balance.remaining_days, leaveType.carry_forward_days);

          // Create new balance for the next year with carry forward
          await client.query(`
            INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days, carry_forward_days)
            VALUES ($1, $2, $3, $4, 0, 0, $4, $5)
            ON CONFLICT (user_id, leave_type_id, year) DO UPDATE SET
              carry_forward_days = EXCLUDED.carry_forward_days,
              total_days = EXCLUDED.total_days,
              remaining_days = EXCLUDED.remaining_days
          `, [balance.user_id, leaveType.id, toYear, balance.total_days, carryForwardDays]);
        }
      }

      await client.query('COMMIT');
      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = LeaveBalance;