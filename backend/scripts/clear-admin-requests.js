const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function clearAdminRequests() {
  try {
    console.log('🧹 Clearing existing admin leave requests...\n');

    // Get admin user
    const adminQuery = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (adminQuery.rows.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const admin = adminQuery.rows[0];
    console.log(`📝 Admin User: ${admin.email} (${admin.id})`);

    // Check existing requests
    const existingRequests = await pool.query(
      'SELECT COUNT(*) as count FROM leave_requests WHERE user_id = $1',
      [admin.id]
    );

    const requestCount = existingRequests.rows[0].count;
    console.log(`📋 Found ${requestCount} existing requests`);

    if (requestCount === 0) {
      console.log('✅ No existing requests to clear');
      return;
    }

    // Clear existing requests
    const result = await pool.query(
      'DELETE FROM leave_requests WHERE user_id = $1',
      [admin.id]
    );

    console.log(`✅ Cleared ${result.rowCount} leave requests for admin`);
    console.log('🎉 Database cleared successfully');

  } catch (error) {
    console.error('❌ Error clearing admin requests:', error);
  } finally {
    pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  clearAdminRequests().then(() => process.exit(0));
}

module.exports = { clearAdminRequests };