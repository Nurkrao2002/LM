#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
});

async function migrateLeaveStatuses() {
  const client = await pool.connect();

  try {
    console.log('🔄 Migrating leave_status enum to support multi-level approval...\n');

    // Add new enum values if they don't exist
    const newStatuses = ['hr_pending', 'manager_rejected', 'hr_rejected', 'admin_rejected'];

    console.log('📋 Adding new status values...');
    for (const status of newStatuses) {
      try {
        await client.query(`ALTER TYPE leave_status ADD VALUE '${status}'`);
        console.log(`✅ Added: ${status}`);
      } catch (error) {
        if (error.code !== '42710') { // 42710 is duplicate object error
          console.log(`ℹ️  Status '${status}' might already exist: ${error.message}`);
        } else {
          console.log(`✅ Status '${status}' already exists`);
        }
      }
    }

    // Check current enum values
    const enumCheck = await client.query(`
      SELECT enum_range(NULL::leave_status) as current_values
    `);

    console.log('\n📋 Current leave_status enum values:');
    console.log(enumCheck.rows[0].current_values);

    // Update existing records to match new workflow
    console.log('\n🔄 Updating existing leave requests to new statuses...');

    // Convert admin_pending to hr_pending
    const adminPendingUpdate = await client.query(`
      UPDATE leave_requests
      SET status = 'hr_pending'
      WHERE status = 'admin_pending'
    `);
    console.log(`✅ Updated ${adminPendingUpdate.rowCount} requests from 'admin_pending' to 'hr_pending'`);

    // Check for any admin_approved requests that should be hr_pending
    const adminApprovedUpdate = await client.query(`
      UPDATE leave_requests
      SET status = 'hr_pending'
      WHERE status = 'manager_approved'
    `);
    console.log(`✅ Updated ${adminApprovedUpdate.rowCount} requests from 'manager_approved' to 'hr_pending'`);

    // Verify migration
    const statusCounts = await client.query(`
      SELECT status, COUNT(*) as count
      FROM leave_requests
      GROUP BY status
      ORDER BY status
    `);

    console.log('\n📊 Status distribution after migration:');
    if (statusCounts.rows.length === 0) {
      console.log('   - No leave requests found');
    } else {
      statusCounts.rows.forEach(row => {
        console.log(`   - ${row.status}: ${row.count}`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateLeaveStatuses().catch(console.error);
}

module.exports = { migrateLeaveStatuses };