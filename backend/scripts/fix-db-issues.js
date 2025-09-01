const { pool } = require('../config/database');

async function fixDatabaseIssues() {
  try {
    console.log('🔧 FIXING DATABASE ISSUES...\n');

    const adminEmail = 'admin@company.com';
    const currentYear = new Date().getFullYear();

    // Get admin user ID and check current state
    console.log('1️⃣ Getting admin user info:');
    const adminQuery = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (adminQuery.rows.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const adminId = adminQuery.rows[0].id;
    console.log(`   Found admin user: ${adminId}\n`);

    // Check and clean up leave balances
    console.log('2️⃣ Cleaning up duplicate leave balances:');
    const currentBalances = await pool.query(`
      SELECT lb.id, lb.leave_type_id, lt.name, lb.total_days, lb.used_days, lb.remaining_days
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = $1 AND lb.year = $2
      ORDER BY lt.type
    `, [adminId, currentYear]);

    console.log(`   Current balances: ${currentBalances.rows.length}`);

    if (currentBalances.rows.length > 6) { // More than expected (should be 1 per leave type)
      console.log('   🔄 Removing duplicates and keeping highest remaining balance');

      const leaveTypeBalances = {};
      currentBalances.rows.forEach(balance => {
        const typeId = balance.leave_type_id;
        if (!leaveTypeBalances[typeId] || balance.remaining_days > leaveTypeBalances[typeId].remaining_days) {
          leaveTypeBalances[typeId] = balance;
        }
      });

      // Delete all balances for this user/year
      await pool.query('DELETE FROM leave_balances WHERE user_id = $1 AND year = $2', [adminId, currentYear]);
      console.log('   ✅ Deleted all admin balances');

      // Re-insert the best remaining balances for each leave type
      for (const [typeId, balance] of Object.entries(leaveTypeBalances)) {
        await pool.query(`
          INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, pending_days, remaining_days)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [adminId, parseInt(typeId), currentYear, balance.total_days, balance.used_days, 0, balance.remaining_days]);
      }

      console.log(`   ✅ Recreated ${Object.keys(leaveTypeBalances).length} clean balance records`);
    } else {
      console.log('   ✅ Balances look good, no cleanup needed');
    }

    // Clean up leave requests for admin
    console.log('\n3️⃣ Cleaning up admin leave requests:');
    const deleteRequests = await pool.query(
      'DELETE FROM leave_requests WHERE user_id = $1',
      [adminId]
    );
    console.log(`   ✅ Cleared ${deleteRequests.rowCount} leave requests`);

    // Verify final state
    console.log('\n4️⃣ Verifying final database state:');

    // Check leave balances
    const finalBalances = await pool.query(`
      SELECT COUNT(*) as count
      FROM leave_balances
      WHERE user_id = $1 AND year = $2
    `, [adminId, currentYear]);
    console.log(`   💰 Admin leave balances: ${finalBalances.rows[0].count}`);

    // Check leave requests
    const finalRequests = await pool.query(
      'SELECT COUNT(*) as count FROM leave_requests WHERE user_id = $1',
      [adminId]
    );
    console.log(`   📄 Admin leave requests: ${finalRequests.rows[0].count}`);

    // Test enum values to make sure they're working
    console.log('\n5️⃣ Testing enum values:');
    try {
      const testQuery = await pool.query(`
        SELECT 'pending'::leave_status,
               'admin_pending'::leave_status,
               'admin_approved'::leave_status
      `);
      console.log('   ✅ Enum values are working correctly');
    } catch (enumError) {
      console.error('   ❌ Enum issue detected:', enumError.message);

      // If enum issue exists, try to recreate it
      try {
        await pool.query('DROP TYPE IF EXISTS leave_status');
        await pool.query("CREATE TYPE leave_status AS ENUM ('pending', 'admin_pending', 'manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected', 'cancelled')");
        console.log('   ✅ Recreated leave_status enum');
      } catch (recreateError) {
        console.error('   ❌ Failed to recreate enum:', recreateError.message);
      }
    }

    console.log('\n🎉 Database cleanup and fixes completed successfully!');
    console.log('   🧹 Database is now clean and ready for testing');

  } catch (error) {
    console.error('❌ Error fixing database issues:', error);
  } finally {
    pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixDatabaseIssues().catch(console.error);
}

module.exports = { fixDatabaseIssues };