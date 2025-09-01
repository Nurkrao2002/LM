#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function debugLeaves() {
  try {
    console.log('🔍 Debugging leaves API issue...\n');

    // Check if leave_requests table exists and has data
    console.log('1. Checking leave_requests table:');
    const lrCount = await pool.query('SELECT COUNT(*) FROM leave_requests');
    console.log(`   - Leave requests count: ${lrCount.rows[0].count}`);

    // Check leave_types table
    console.log('\n2. Checking leave_types table:');
    const ltResult = await pool.query('SELECT id, type, name FROM leave_types ORDER BY type');
    console.log(`   - Leave types count: ${ltResult.rows.length}`);
    ltResult.rows.forEach(lt => console.log(`     - ${lt.type}: ${lt.name}`));

    // Check current user details
    console.log('\n3. Checking admin user:');
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, role, status, is_active FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (userResult.rows.length > 0) {
      const admin = userResult.rows[0];
      console.log(`   - Admin ID: ${admin.id}`);
      console.log(`   - Role: ${admin.role}`);
      console.log(`   - Status: ${admin.status}`);
      console.log(`   - Active: ${admin.is_active}`);

      // Test the actual query from leaveController
      console.log('\n4. Testing leave requests query (as admin):');
      const adminId = admin.id;

      const leaveQuery = `
        SELECT
          lr.id,
          lr.user_id,
          lr.start_date,
          lr.end_date,
          lr.total_days,
          lr.reason,
          lr.status,
          lr.emergency,
          lr.created_at,
          lr.updated_at,
          u.first_name,
          u.last_name,
          u.email,
          u.department,
          u.employee_id,
          lt.name as leave_type_name,
          lt.type as leave_type,
          m.first_name as manager_first_name,
          m.last_name as manager_last_name
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN users m ON lr.manager_id = m.id
        ORDER BY lr.created_at DESC
        LIMIT $1
      `;

      const leaveResult = await pool.query(leaveQuery, [5]);
      console.log(`   - Query executed successfully, returned ${leaveResult.rows.length} rows`);

      if (leaveResult.rows.length > 0) {
        console.log('   - Sample row:', {
          id: leaveResult.rows[0].id,
          status: leaveResult.rows[0].status,
          leave_type: leaveResult.rows[0].leave_type,
          user_name: `${leaveResult.rows[0].first_name} ${leaveResult.rows[0].last_name}`
        });
      }
    } else {
      console.log('   ❌ Admin user not found!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

debugLeaves();