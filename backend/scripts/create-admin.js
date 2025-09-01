#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('👤 Creating Admin User Script');
console.log('=============================\n');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
});

async function createAdminUser() {
  try {
    console.log('🔍 Checking database connection...');
    const connCheck = await pool.query('SELECT 1');
    console.log('✅ Database connected');

    // Check if admin user exists
    const existingUser = await pool.query(
      'SELECT id, email, status, is_active FROM users WHERE email = $1',
      ['admin@company.com']
    );

    if (existingUser.rows.length > 0) {
      console.log('🔄 Admin user already exists:', existingUser.rows[0]);
    } else {
      console.log('➕ Creating admin user...');

      // Create admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin123!', 12);

      await pool.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['admin@company.com', hashedPassword, 'System', 'Administrator', 'admin', 'approved', true]
      );

      console.log('✅ Admin user created successfully!');
    }

    console.log('\n📧 Email: admin@company.com');
    console.log('🔑 Password: Admin123!');
    console.log('\n🎉 Ready to login!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createAdminUser();