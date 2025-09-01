const { query, getClient } = require('../../config/database');

class Notification {
  static async create(notificationData) {
    const { user_id, leave_request_id, title, message, type } = notificationData;

    const result = await query(`
      INSERT INTO notifications (user_id, leave_request_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [user_id, leave_request_id, title, message, type]);

    return result.rows[0];
  }

  static async findByUserId(userId, filters = {}) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramCount = 1;

    const { is_read, type, limit = 20, offset = 0 } = filters;

    if (is_read !== undefined) {
      conditions.push(`is_read = $${++paramCount}`);
      values.push(is_read);
    }

    if (type) {
      conditions.push(`type = $${++paramCount}`);
      values.push(type);
    }

    values.push(limit, offset);

    const whereClause = conditions.join(' AND ');

    const result = await query(`
      SELECT
        n.*,
        lr.start_date, lr.end_date, lr.total_days, lr.status,
        lt.name as leave_type_name
      FROM notifications n
      LEFT JOIN leave_requests lr ON n.leave_request_id = lr.id
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `, values);

    return result.rows;
  }

  static async markAsRead(notificationId, userId) {
    const result = await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    return result.rows[0] || null;
  }

  static async markAllAsRead(userId) {
    const result = await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING *',
      [userId]
    );

    return result.rows;
  }

  static async getCountByUserId(userId, unreadOnly = false) {
    let queryStr = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1';
    const values = [userId];

    if (unreadOnly) {
      queryStr += ' AND is_read = false';
    }

    const result = await query(queryStr, values);
    return parseInt(result.rows[0].count);
  }

  static async deleteOldNotifications(daysOld = 30) {
    const result = await query(`
      DELETE FROM notifications
      WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '${daysOld} days')
      RETURNING *
    `);

    return result.rows.length;
  }

  static async createBulk(notifications) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const values = [];
      const placeholders = [];
      let paramCount = 0;

      notifications.forEach(notification => {
        placeholders.push(`($${++paramCount}, $${++paramCount}, $${++paramCount}, $${++paramCount}, $${++paramCount})`);
        values.push(
          notification.user_id,
          notification.leave_request_id,
          notification.title,
          notification.message,
          notification.type
        );
      });

      const queryStr = `
        INSERT INTO notifications (user_id, leave_request_id, title, message, type)
        VALUES ${placeholders.join(', ')}
        RETURNING *
      `;

      const result = await client.query(queryStr, values);

      await client.query('COMMIT');

      return result.rows;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async notifyLeaveRequestStatus(leaveRequestId, status, recipientUserId, message) {
    // Get leave request details
    const requestDetails = await query(`
      SELECT
        lr.*,
        u.first_name, u.last_name,
        lt.name as leave_type_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [leaveRequestId]);

    if (requestDetails.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestDetails.rows[0];

    // Create appropriate notification based on status
    let title, notificationMessage, type;

    switch (status) {
      case 'manager_approved':
        title = 'Leave Request Approved by Manager';
        notificationMessage = `Your leave request for ${request.total_days} days (${request.leave_type_name}) has been approved by your manager.`;
        type = 'approved';
        break;
      case 'admin_approved':
        title = 'Leave Request Finally Approved';
        notificationMessage = `Your leave request for ${request.total_days} days (${request.leave_type_name}) has been finally approved.`;
        type = 'approved';
        break;
      case 'manager_rejected':
        title = 'Leave Request Rejected by Manager';
        notificationMessage = `Your leave request for ${request.total_days} days (${request.leave_type_name}) has been rejected by your manager.`;
        type = 'rejected';
        break;
      case 'admin_rejected':
        title = 'Leave Request Rejected';
        notificationMessage = `Your leave request for ${request.total_days} days (${request.leave_type_name}) has been rejected.`;
        type = 'rejected';
        break;
      case 'cancelled':
        title = 'Leave Request Cancelled';
        notificationMessage = 'Your leave request has been cancelled.';
        type = 'cancelled';
        break;
      default:
        title = 'Leave Request Status Update';
        notificationMessage = message || `Your leave request status has been updated to ${status}`;
        type = 'status_update';
    }

    return await this.create({
      user_id: recipientUserId,
      leave_request_id: leaveRequestId,
      title,
      message: notificationMessage,
      type
    });
  }

  static async notifyNewLeaveRequest(leaveRequestId, requesterUserId, managerUserId) {
    const requestDetails = await query(`
      SELECT
        lr.*,
        u.first_name, u.last_name,
        lt.name as leave_type_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [leaveRequestId]);

    if (requestDetails.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestDetails.rows[0];

    const title = 'New Leave Request Submitted';
    const message = `${request.first_name} ${request.last_name} has submitted a leave request for ${request.total_days} days (${request.leave_type_name}) from ${new Date(request.start_date).toLocaleDateString()} to ${new Date(request.end_date).toLocaleDateString()}.`;

    let type = 'request_submitted';
    if (request.emergency) {
      type = 'emergency_request';
    }

    return await this.create({
      user_id: managerUserId,
      leave_request_id: leaveRequestId,
      title: request.emergency ? 'Emergency Leave Request' : title,
      message,
      type
    });
  }

  static async getNotificationsStats(userId) {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
        COUNT(CASE WHEN type = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN type = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN type = 'request_submitted' THEN 1 END) as pending_count
      FROM notifications
      WHERE user_id = $1
    `, [userId]);

    return result.rows[0];
  }
}

module.exports = Notification;