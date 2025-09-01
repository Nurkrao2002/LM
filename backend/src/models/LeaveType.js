const { query } = require('../../config/database');

class LeaveType {
  static async findAll() {
    const result = await query(
      'SELECT * FROM leave_types ORDER BY type'
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM leave_types WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async findByType(type) {
    const result = await query('SELECT * FROM leave_types WHERE type = $1', [type]);
    return result.rows[0] || null;
  }

  static async create(leaveTypeData) {
    const { type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days } = leaveTypeData;

    const result = await query(`
      INSERT INTO leave_types (type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days]);

    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['name', 'description', 'annual_days', 'carry_forward_days', 'max_consecutive_days', 'notice_period_days'];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const result = await query(`
      UPDATE leave_types
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${++paramCount}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await query('DELETE FROM leave_types WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }

  static async getDefaultDaysByType(type) {
    const leaveType = await this.findByType(type);
    return leaveType ? leaveType.annual_days : 0;
  }
}

module.exports = LeaveType;