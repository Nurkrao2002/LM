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

async function checkEnumValues() {
  try {
    console.log('🔍 Checking leave_status enum values...');

    // Check what enum values are available for leave_status
    const enumResult = await pool.query(`
      SELECT enum_range(NULL::leave_status) as enum_values
    `);

    if (enumResult.rows.length > 0) {
      console.log('📋 Available leave_status enum values:');
      console.log(enumResult.rows[0].enum_values);

      // Also check current leave request statuses in DB
      const statusResult = await pool.query(`
        SELECT DISTINCT status FROM leave_requests ORDER BY status
      `);

      console.log('\n📋 Current statuses in leave_requests table:');
      statusResult.rows.forEach(row => {
        console.log(`  • ${row.status}`);
      });
    } else {
      console.log('❌ No enum found or table does not exist');
    }

  } catch (error) {
    console.error('❌ Database inspection error:', error.message);
    console.log('\n📋 Likely that leave_requests table or enum does not exist yet.');
    console.log('💡 This means the database may need to be initialized with schema.');
  } finally {
    await pool.end();
  }
}

checkEnumValues();