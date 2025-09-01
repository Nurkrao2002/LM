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

async function checkAdmin() {
  try {
    console.log('🔍 Checking admin user...');

    const res = await pool.query(
      'SELECT id, email, status, is_active, first_name, last_name, password_hash FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (res.rows.length === 0) {
      console.log('❌ Admin user not found');
    } else {
      console.log('✅ Admin user found:', {
        id: res.rows[0].id,
        email: res.rows[0].email,
        status: res.rows[0].status,
        is_active: res.rows[0].is_active,
        first_name: res.rows[0].first_name,
        last_name: res.rows[0].last_name
      });

      // Test password hash
      const isValid = await bcrypt.compare('Admin123!', res.rows[0].password_hash);
      console.log('🔍 Password hash verification:', isValid ? '✅ VALID' : '❌ INVALID');

      // Check why login might fail
      if (res.rows[0].status !== 'approved') {
        console.log('❌ Issue: User status is not approved');
      }
      if (!res.rows[0].is_active) {
        console.log('❌ Issue: User is not active');
      }
      if (!isValid) {
        console.log('❌ Issue: Password does not match');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdmin();