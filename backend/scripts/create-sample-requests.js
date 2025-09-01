const { query } = require('../config/database');

async function createSampleRequests() {
  try {
    console.log('🔄 Creating sample leave requests...\n');

    // Get an existing user from the database
    const userResult = await query('SELECT id, email FROM users WHERE is_active = true LIMIT 1');

    if (userResult.rows.length === 0) {
      throw new Error('No active users found. Please create a user first.');
    }

    const user = userResult.rows[0];
    console.log(`📝 Creating requests for user: ${user.email} (${user.id})`);

    // Get leave types
    const leaveTypeResult = await query('SELECT id, name FROM leave_types LIMIT 1');

    if (leaveTypeResult.rows.length === 0) {
      throw new Error('No leave types found. Please ensure database schema is set up.');
    }

    const leaveType = leaveTypeResult.rows[0];
    console.log(`🎯 Using leave type: ${leaveType.name} (${leaveType.id})`);

    // Create sample requests with different statuses
    const sampleRequests = [
      {
        start_date: '2025-09-01',
        end_date: '2025-09-03',
        reason: 'Sample request - pending',
        status: 'pending',
        total_days: 3
      },
      {
        start_date: '2025-08-15',
        end_date: '2025-08-17',
        reason: 'Sample request - approved',
        status: 'admin_approved',
        total_days: 3
      },
      {
        start_date: '2025-08-10',
        end_date: '2025-08-11',
        reason: 'Sample request - rejected',
        status: 'admin_rejected',
        total_days: 2
      }
    ];

    console.log('📋 Creating sample requests...\n');

    for (const request of sampleRequests) {
      const result = await query(`
        INSERT INTO leave_requests (
          user_id, leave_type_id, start_date, end_date,
          total_days, reason, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, status, created_at
      `, [
        user.id,
        leaveType.id,
        request.start_date,
        request.end_date,
        request.total_days,
        request.reason,
        request.status
      ]);

      console.log(`✅ Created request: ${result.rows[0].id} - ${request.status} - ${request.reason}`);
    }

    // Verify created requests
    const countResult = await query('SELECT COUNT(*) FROM leave_requests WHERE user_id = $1', [user.id]);
    console.log(`\n📊 Total requests for user: ${countResult.rows[0].count}`);

    console.log('\n🎉 SAMPLE REQUESTS CREATED SUCCESSFULLY!');
    console.log('🔄 You should now see requests on the Leave Requests page');

  } catch (error) {
    console.error('❌ Failed to create sample requests:', error);
  } finally {
    process.exit();
  }
}

createSampleRequests();