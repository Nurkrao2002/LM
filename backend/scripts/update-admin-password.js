#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function updateAdminPassword() {
  try {
    console.log('🔑 Updating admin password...');

    // Generate correct hash for Admin123!
    const correctPasswordHash = await bcrypt.hash('Admin123!', 12);
    console.log('✅ Generated new password hash');

    // Update the admin user's password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [correctPasswordHash, 'admin@company.com']
    );

    console.log('✅ Admin password updated successfully');

    // Verify the update
    const verifyRes = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (verifyRes.rows.length > 0) {
      const isValid = await bcrypt.compare('Admin123!', verifyRes.rows[0].password_hash);
      console.log('🔍 Password verification:', isValid ? '✅ VALID' : '❌ INVALID');
    }

    console.log('\n🎉 Admin credentials are now correct!');
    console.log('📧 Email: admin@company.com');
    console.log('🔑 Password: Admin123!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

updateAdminPassword();