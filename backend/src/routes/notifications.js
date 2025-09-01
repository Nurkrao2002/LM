const express = require('express');
const { param, query, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { query: dbQuery } = require('../../config/database');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// GET /api/notifications - Get user notifications
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('unread_only').optional().isBoolean().toBoolean(),
    query('type').optional().isIn(['request_submitted', 'approved', 'rejected', 'admin_review', 'manager_review']),
    handleValidationErrors
  ],
  asyncHandler(async (req, res) => {
    const currentUser = req.user;
    const { page = 1, limit = 20, unread_only = false, type } = req.query;

    // Build WHERE conditions
    const conditions = ['n.user_id = $1'];
    const values = [currentUser.id];
    let paramCount = 1;

    if (unread_only) {
      conditions.push(`n.is_read = $${++paramCount}`);
      values.push(false);
    }

    if (type) {
      conditions.push(`n.type = $${++paramCount}`);
      values.push(type);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);
    values.push(parseInt(limit), offset);

    // Get notifications with leave request details
    const notificationsQuery = `
      SELECT
        n.id, n.title, n.message, n.type, n.is_read, n.email_sent,
        n.created_at, n.leave_request_id,
        CASE WHEN n.leave_request_id IS NOT NULL THEN
          json_build_object(
            'id', lr.id,
            'status', lr.status,
            'total_days', lr.total_days,
            'start_date', lr.start_date,
            'end_date', lr.end_date,
            'leave_type', lt.name
          )
        END as leave_request
      FROM notifications n
      LEFT JOIN leave_requests lr ON n.leave_request_id = lr.id
      LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${++paramCount}
      OFFSET $${++paramCount}
    `;

    const notifications = await dbQuery(notificationsQuery, values);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM notifications n WHERE ${whereClause}`;
    if (type) {
      countQuery = countQuery.replace('$2', '$3').replace('$1', '$1').replace('$3', '$2');
    }
    const countResult = await dbQuery(countQuery, values.slice(0, type ? 2 : 1));
    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        notifications: notifications.rows,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_notifications: totalCount,
          per_page: parseInt(limit),
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1
        }
      }
    });
  })
);

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if notification exists and belongs to user
    const notification = await dbQuery(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, currentUser.id]
    );

    if (notification.rows.length === 0) {
      throw new NotFoundError('Notification');
    }

    // Mark as read
    const result = await dbQuery(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id, is_read',
      [id]
    );

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: result.rows[0] }
    });
  })
);

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUser = req.user;

    // Mark all unread notifications as read
    const result = await dbQuery(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING COUNT(*) as updated_count',
      [currentUser.id]
    );

    res.json({
      success: true,
      message: `${result.rows[0].updated_count} notifications marked as read`,
      data: { updated_count: parseInt(result.rows[0].updated_count) }
    });
  })
);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if notification exists and belongs to user
    const notification = await dbQuery(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, currentUser.id]
    );

    if (notification.rows.length === 0) {
      throw new NotFoundError('Notification');
    }

    // Delete notification
    await dbQuery('DELETE FROM notifications WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  })
);

// GET /api/notifications/unread-count - Get count of unread notifications
router.get('/unread-count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUser = req.user;

    const result = await dbQuery(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [currentUser.id]
    );

    res.json({
      success: true,
      data: { unread_count: parseInt(result.rows[0].unread_count) }
    });
  })
);

// PUT /api/notifications/:id/archive - Archive notification (soft delete)
router.put('/:id/archive',
  authenticateToken,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if notification exists and belongs to user
    const notification = await dbQuery(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, currentUser.id]
    );

    if (notification.rows.length === 0) {
      throw new NotFoundError('Notification');
    }

    // Archive notification (we'll add an is_archived column if needed)
    // For now, just mark as read
    const result = await dbQuery(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id, is_read',
      [id]
    );

    res.json({
      success: true,
      message: 'Notification archived successfully',
      data: { notification: result.rows[0] }
    });
  })
);

// GET /api/notifications/stats - Get notification statistics
router.get('/stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const currentUser = req.user;

    const statsQuery = `
      SELECT
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
        COUNT(CASE WHEN type = 'approved' THEN 1 END) as approval_count,
        COUNT(CASE WHEN type = 'rejected' THEN 1 END) as rejection_count,
        COUNT(CASE WHEN type = 'request_submitted' THEN 1 END) as request_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_count
      FROM notifications
      WHERE user_id = $1
    `;

    const result = await dbQuery(statsQuery, [currentUser.id]);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        stats: {
          total_notifications: parseInt(stats.total_notifications),
          unread_count: parseInt(stats.unread_count),
          approval_count: parseInt(stats.approval_count),
          rejection_count: parseInt(stats.rejection_count),
          request_count: parseInt(stats.request_count),
          recent_count: parseInt(stats.recent_count)
        }
      }
    });
  })
);

module.exports = router;