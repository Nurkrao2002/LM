const { getClient, query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function createAllUserBalances() {
  const client = await getClient();
  const currentYear = new Date().getFullYear();

  try {
    console.log('🔄 Creating leave balances for all active users...\n');
    console.log(`📅 Current Year: ${currentYear}\n`);

    // Get all active users
    const usersQuery = await client.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE is_active = true ORDER BY role, first_name'
    );

    if (usersQuery.rows.length === 0) {
      console.log('❌ No active users found');
      return;
    }

    console.log(`👥 Found ${usersQuery.rows.length} active users:`);
    usersQuery.rows.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name} (${user.email}) - ${user.role}`);
    });
    console.log('');

    // Get all leave types
    const leaveTypesQuery = await client.query('SELECT id, name, type, annual_days FROM leave_types ORDER BY type');

    console.log('📋 Available leave types:');
    leaveTypesQuery.rows.forEach(lt => {
      console.log(`   - ${lt.name} (${lt.type}): ${lt.annual_days} days`);
    });
    console.log('');

    let totalBalancesCreated = 0;
    let skippedBalances = 0;

    // For each user
    for (const user of usersQuery.rows) {
      console.log(`\n📝 Processing user: ${user.first_name} ${user.last_name} (${user.role})`);

      // Check existing balances for this user
      const existingBalancesQuery = await client.query(
        'SELECT lb.*, lt.name as leave_type_name FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id WHERE lb.user_id = $1 AND lb.year = $2',
        [user.id, currentYear]
      );

      if (existingBalancesQuery.rows.length > 0) {
        console.log(`ℹ️  Existing balances found for ${user.first_name}:`);
        existingBalancesQuery.rows.forEach(row => {
          console.log(`   - ${row.leave_type_name}: Total=${row.total_days}, Used=${row.used_days}, Remaining=${row.remaining_days}`);
        });
        skippedBalances += existingBalancesQuery.rows.length;
        continue; // Skip to next user
      }

      console.log(`✅ Creating new balances for ${user.first_name} (${user.role})`);

      // Create balances for each leave type
      for (const leaveType of leaveTypesQuery.rows) {
        const balanceId = uuidv4();

        await client.query(`
          INSERT INTO leave_balances (
            id, user_id, leave_type_id, year, total_days, used_days, pending_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
        `, [
          balanceId,
          user.id,
          leaveType.id,
          currentYear,
          leaveType.annual_days,
          0,
          0
        ]);

        console.log(`   ✅ ${leaveType.name}: ${leaveType.annual_days} days`);
        totalBalancesCreated++;
      }

      // Verify balances were created for this user
      const verifyQuery = await client.query(
        'SELECT lb.*, lt.name FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id WHERE lb.user_id = $1 AND lb.year = $2',
        [user.id, currentYear]
      );

      console.log(`   📊 Created ${verifyQuery.rows.length} balances for ${user.first_name}`);
    }

    console.log(`\n🎉 Summary:`);
    console.log(`   👥 Users processed: ${usersQuery.rows.length}`);
    console.log(`   ✅ New balances created: ${totalBalancesCreated}`);
    console.log(`   ⏭️  Skipped (already exist): ${skippedBalances}`);
    console.log(`   📋 Total processed: ${totalBalancesCreated + skippedBalances}`);

    // Overall verification
    if (totalBalancesCreated > 0) {
      console.log('\n📈 Overall verification:');
      const totalBalancesCheck = await client.query(`
        SELECT COUNT(*) as total_balances, COUNT(DISTINCT user_id) as unique_users
        FROM leave_balances
        WHERE year = $1
      `, [currentYear]);

      console.log(`   - Total balances in system: ${totalBalancesCheck.rows[0].total_balances}`);
      console.log(`   - Users with balances: ${totalBalancesCheck.rows[0].unique_users}`);
    }

  } catch (error) {
    console.error('❌ Error creating user balances:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function createAdminBalances() {
  console.log('⚠️  Legacy function - Please use createAllUserBalances() for comprehensive setup');
  await createAllUserBalances();
}

// Run if called directly
if (require.main === module) {
  createAdminBalances().then(() => process.exit(0));
}

module.exports = { createAdminBalances };