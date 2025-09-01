#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('👤 Creating Admin Test User Script');
console.log('==================================\n');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
});

async function createTestAdmin() {
  try {
    console.log('🔍 Checking database connection...');
    const connCheck = await pool.query('SELECT 1');
    console.log('✅ Database connected');

    // Check if admin test user exists
    const existingUser = await pool.query(
      'SELECT id, email, status, is_active FROM users WHERE email = $1',
      ['admintest@company.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('🔄 Admin test user already exists:', existingUser.rows[0]);
    } else {
      console.log('➕ Creating admin test user...');

      // Create admin test user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Test123!', 12);

      await pool.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['admintest@company.com', hashedPassword, 'Admin', 'Test', 'admin', 'approved', true]
      );

      console.log('✅ Admin test user created successfully!');
    }

    console.log('\n📧 Email: admintest@company.com');
    console.log('🔑 Password: Test123!');
    console.log('\n🎉 Ready to login and test user approval!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createTestAdmin();