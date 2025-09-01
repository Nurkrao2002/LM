const { pool } = require('../config/database');

async function inspectDatabase() {
  console.log('🔍 INSPECTING DATABASE TABLES...\n');

  try {
    // Check users table
    console.log('👥 USERS TABLE:');
    const users = await pool.query('SELECT id, email, first_name, last_name, role, manager_id, is_active FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT 5');
    console.log(`Found ${users.rows.length} active users:`);
    users.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ${user.first_name} ${user.last_name}`);
    });

    // Check leave types
    console.log('\n📋 LEAVE TYPES TABLE:');
    const leaveTypes = await pool.query('SELECT id, type, name, annual_days FROM leave_types ORDER BY type');
    console.log(`Found ${leaveTypes.rows.length} leave types:`);
    leaveTypes.rows.forEach(lt => {
      console.log(`  - ${lt.name} (${lt.type}): ${lt.annual_days} days`);
    });

    // Check leave balances for admin
    console.log('\n💰 LEAVE BALANCES FOR ADMIN:');
    const adminBalances = await pool.query(`
      SELECT lb.*, lt.name as leave_type_name
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = (SELECT id FROM users WHERE email = 'admin@company.com')
      AND lb.year = $1
    `, [new Date().getFullYear()]);

    console.log(`Admin has ${adminBalances.rows.length} leave balance records:`);
    adminBalances.rows.forEach(bal => {
      console.log(`  - ${bal.leave_type_name}: Total=${bal.total_days}, Used=${bal.used_days}, Remaining=${bal.remaining_days}`);
    });

    // Check leave requests
    console.log('\n📄 LEAVE REQUESTS TABLE:');
    const requests = await pool.query(`
      SELECT lr.id, lr.status, lr.start_date, lr.end_date, lr.total_days,
             lt.name as leave_type, u.email as user_email
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      ORDER BY lr.created_at DESC LIMIT 5
    `);

    console.log(`Found ${requests.rows.length} leave requests:`);
    requests.rows.forEach(req => {
      console.log(`  - ${req.user_email}: ${req.start_date} to ${req.end_date} (${req.total_days} days) - ${req.status}`);
    });

    // Check if there are any pending approvals
    console.log('\n⏳ PENDING APPROVALS:');
    const pending = await pool.query(`
      SELECT lr.id, lr.status, u.email as user_email, lt.name as leave_type
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'pending' OR lr.status = 'manager_approved'
      ORDER BY lr.created_at DESC
    `);

    console.log(`Found ${pending.rows.length} pending requests:`);
    pending.rows.forEach(req => {
      console.log(`  - ${req.user_email}: ${req.leave_type} (${req.status})`);
    });

    // Check system settings
    console.log('\n⚙️ SYSTEM SETTINGS:');
    const settings = await pool.query('SELECT category, key, value FROM system_settings WHERE is_active = true ORDER BY category, key');
    console.log(`Found ${settings.rows.length} active settings:`);
    settings.rows.forEach(setting => {
      console.log(`  - ${setting.category}.${setting.key}: ${setting.value}`);
    });

    // Check notifications
    console.log('\n🔔 NOTIFICATIONS:');
    const notifications = await pool.query('SELECT id, type, is_read FROM notifications ORDER BY created_at DESC LIMIT 3');
    console.log(`Latest ${notifications.rows.length} notifications:`);
    notifications.rows.forEach(notif => {
      console.log(`  - ${notif.type}: ${notif.is_read ? 'Read' : 'Unread'}`);
    });

    console.log('\n✅ Database inspection complete!');

  } catch (error) {
    console.error('❌ Error inspecting database:', error);
  } finally {
    pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  inspectDatabase().catch(console.error);
}

module.exports = { inspectDatabase };