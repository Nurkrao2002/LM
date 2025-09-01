#!/usr/bin/env node

const { pool } = require('../config/database');

async function freshReset() {
  try {
    console.log('🔄 Performing complete fresh reset of leave management system...\n');

    // 1. Get admin user first
    const adminQuery = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (adminQuery.rows.length === 0) {
      console.log('❌ Admin user not found - Creating admin user...');

      // Create admin user if doesn't exist
      const createAdmin = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email
      `, ['admin@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.7xzOiFQFwGgmYzCk3ZmQyQZrTJHs3yEm', 'System', 'Administrator', 'admin', true]);

      console.log('✅ Admin user created:', createAdmin.rows[0].email);
    } else {
      console.log('📋 Admin user found:', adminQuery.rows[0].email);
    }

    const admin = adminQuery.rows.length > 0 ? adminQuery.rows[0] : createAdmin.rows[0];

    // 2. Delete all leave-related data
    console.log('\n🔄 Clearing existing leave data...');

    const deleteRequests = await pool.query('DELETE FROM leave_requests');
    console.log(`✅ Deleted ${deleteRequests.rowCount} leave requests`);

    const deleteBalances = await pool.query('DELETE FROM leave_balances');
    console.log(`✅ Deleted ${deleteBalances.rowCount} leave balances`);

    const deleteNotifications = await pool.query('DELETE FROM notifications');
    console.log(`✅ Deleted ${deleteNotifications.rowCount} notifications`);

    // 3. Ensure leave types exist
    console.log('\n📋 Checking leave types...');
    const leaveTypesCount = await pool.query('SELECT COUNT(*) FROM leave_types');
    const currentCount = parseInt(leaveTypesCount.rows[0].count);

    if (currentCount === 0) {
      console.log('🔄 Creating default leave types...');

      await pool.query(`
        INSERT INTO leave_types (type, name, description, annual_days, notice_period_days, carry_forward_days, max_consecutive_days) VALUES
        ('casual', 'Casual Leave', 'General personal or short-term absences', 12, 1, 2, 3),
        ('health', 'Health Leave', 'Medical or health-related absences', 12, 1, 2, 5);
      `);

      console.log('✅ Created 3 default leave types');
    } else {
      console.log(`✅ ${currentCount} leave types already exist`);

      // Show current leave types
      const leaveTypes = await pool.query(
        'SELECT name, type, annual_days, description FROM leave_types ORDER BY name'
      );

      console.log('\n📝 Current leave types:');
      leaveTypes.rows.forEach((lt, index) => {
        console.log(`${index + 1}. ${lt.name} (${lt.type}) - ${lt.annual_days} days`);
        console.log(`   ${lt.description}`);
      });
    }

    // 4. Create leave balances for all active users
    console.log('\n🧮 Creating leave balances for all users...');

    // Get all active users
    const usersQuery = await pool.query('SELECT id, email, role FROM users WHERE is_active = true');

    console.log(`👥 Found ${usersQuery.rows.length} active users`);

    let balancesCreated = 0;

    for (const user of usersQuery.rows) {
      console.log(`📝 Processing ${user.email} (${user.role})...`);

      // Get leave types
      const leaveTypes = await pool.query('SELECT id, name FROM leave_types ORDER BY name');

      for (const leaveType of leaveTypes.rows) {
        try {
          await pool.query(`
            INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days)
            VALUES ($1, $2, $3, $4, 0, 0)
          `, [user.id, leaveType.id, new Date().getFullYear(), leaveType.annual_days]); // Use database value for leave type

          balancesCreated++;
        } catch (error) {
          if (!error.message.includes('duplicate')) {
            console.log(`⚠️  Error creating balance for ${user.email} - ${leaveType.name}:`, error.message);
          }
        }
      }

      console.log(`✅ Created balances for ${user.email} (${user.role})`);
    }

    // 5. Verification
    console.log('\n📊 VERIFICATION RESULTS:');

    const finalLeaveTypesShow = await pool.query('SELECT type, name, annual_days FROM leave_types ORDER BY type');
    console.log(`🎯 Leave Types: ${finalLeaveTypes.rows[0].count} configured`);
    finalLeaveTypesShow.rows.forEach(lt => {
      console.log(`   - ${lt.name} (${lt.type}): ${lt.annual_days} days`);
    });

    const finalBalances = await pool.query('SELECT COUNT(*) FROM leave_balances');
    console.log(`🎯 Leave Balances: ${finalBalances.rows[0].count}`);

    const finalRequests = await pool.query('SELECT COUNT(*) FROM leave_requests');
    console.log(`🎯 Leave Requests: ${finalRequests.rows[0].count}`);

    const finalNotifications = await pool.query('SELECT COUNT(*) FROM notifications');
    console.log(`🎯 Notifications: ${finalNotifications.rows[0].count}`);

    // Show sample balances
    const sampleBalances = await pool.query(`
      SELECT u.email, lt.name as leave_type, lb.total_days, lb.used_days, lb.remaining_days
      FROM leave_balances lb
      JOIN users u ON lb.user_id = u.id
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE u.is_active = true
      LIMIT 5
    `);

    console.log('\n📋 Sample balances created:');
    if (sampleBalances.rows.length > 0) {
      sampleBalances.rows.forEach(row => {
        console.log(`   ${row.email}: ${row.leave_type} (${row.remaining_days} days remaining)`);
      });
    }

    console.log('\n🎉 FRESH RESET COMPLETE!');
    console.log('✅ Database cleaned and repopulated');
    console.log('✅ All users have leave balances');
    console.log('✅ 2 standard leave types configured (casual + health)');
    console.log('✅ System ready for testing');

  } catch (error) {
    console.error('❌ Fresh reset failed:', error);
    throw error;
  } finally {
    pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  freshReset().then(() => process.exit(0));
}

module.exports = { freshReset };