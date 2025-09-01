const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

// Import models for scheduled tasks
const LeaveBalance = require('./src/models/LeaveBalance');

const app = express();

// Trust proxy for rate limiting when behind a proxy
app.set('trust proxy', 1);

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const leaveRoutes = require('./src/routes/leaves');
const notificationRoutes = require('./src/routes/notifications');
const settingsRoutes = require('./src/routes/settings');

// Import middleware
const { errorHandler } = require('./src/middleware/errorHandler');
const { authenticateToken } = require('./src/middleware/auth');

// Import database configuration
const { initializeDatabase } = require('./config/database');

// Global middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Leave Management API'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/leaves', authenticateToken, leaveRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connected successfully');


    // Schedule annual leave balance reset (January 1st at 12:00 AM)
    cron.schedule('0 0 1 1 *', async () => {
      console.log('🎯 Starting yearly usage counter reset and annual leave balance reset...');
      try {
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;

        // Get all active users for audit logging
        const { query } = require('./config/database');
        const users = await query('SELECT id, email, first_name, last_name FROM users WHERE is_active = true');

        // Get current balances before reset for audit
        const currentBalances = await query(`
          SELECT lb.*, lt.name as leave_type_name, u.email
          FROM leave_balances lb
          JOIN leave_types lt ON lb.leave_type_id = lt.id
          JOIN users u ON lb.user_id = u.id
          WHERE lb.year = $1
        `, [previousYear]);

        // Hard reset all balances to 12 casual + 12 health
        let totalUsersResetted = 0;
        for (const user of users.rows) {
          // Reset leave balances
          await query(`
            UPDATE leave_balances
            SET total_days = 12, used_days = 0, pending_days = 0, remaining_days = 12, carry_forward_days = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND year = $2 AND leave_type_id IN (
              SELECT id FROM leave_types WHERE type IN ('casual', 'health')
            )
          `, [user.id, currentYear]);

          // Reset monthly usage tracking for new year
          await query(`
            DELETE FROM monthly_leave_usage
            WHERE user_id = $1 AND year = $2
          `, [user.id, previousYear]);

          totalUsersResetted++;
        }

        console.log(`✅ Yearly reset completed: ${totalUsersResetted} users resetted to 12 casual + 12 health leaves for ${currentYear} and usage counters reset`);

        // Log completion in system settings for audit trail
        await query(`
          INSERT INTO system_settings (key, value, description, category)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [
          'last_annual_reset',
          JSON.stringify({
            timestamp: new Date().toISOString(),
            users_resetted: totalUsersResetted,
            reset_year: currentYear,
            previous_year: previousYear,
            balances_before_reset: currentBalances.rows.slice(0, 10) // Log first 10 for audit
          }),
          'Last yearly usage counter and leave balance reset execution details',
          'system_audit'
        ]);

      } catch (error) {
        console.error('❌ Error during annual leave balance reset:', error);

        // Log error in system settings
        await query(`
          INSERT INTO system_settings (key, value, description, category)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [
          'last_reset_error',
          JSON.stringify({
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
          }),
          'Last failed reset operation details',
          'system_audit'
        ]);
      }
    });
    console.log('⏰ Yearly usage counter reset and leave balance reset scheduled for January 1st at 12:00 AM');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;