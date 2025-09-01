#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('👥 Creating HR Manager Role Test User Script');
console.log('============================================\n');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
});

async function createHRManager() {
  try {
    console.log('🔍 Checking database connection...');
    const connCheck = await pool.query('SELECT 1');
    console.log('✅ Database connected');

    // Update an existing HR manager to have hr_manager role
    const updateResult = await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2 AND department = $3',
      ['hr_manager', 'sarah.johnson@company.com', 'Human Resources']
    );

    if (updateResult.rowCount > 0) {
      console.log('✅ Updated user: sarah.johnson@company.com to hr_manager role');
    } else {
      console.log('⚠️  No users found to update. User may not exist yet.');
      console.log('   Run seed.js first to create users, then run this script.');
      return;
    }

    // Check if the user was updated
    const checkUser = await pool.query(
      'SELECT id, email, first_name, last_name, role, department FROM users WHERE email = $1',
      ['sarah.johnson@company.com']
    );

    if (checkUser.rows.length > 0) {
      const user = checkUser.rows[0];
      console.log(`\n📋 Updated User Details:`);
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Department: ${user.department}`);
    }

    console.log('\n🔑 Login Credentials for HR Manager:');
    console.log('   Email: sarah.johnson@company.com');
    console.log('   Password: Password123!'); // Default password from seed.js
    console.log('\n🎉 HR Manager created and ready to test user approval!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createHRManager();