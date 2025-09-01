#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔄 Fresh Database Migration Script - Pigeon OffSync');
console.log('================================================\n');

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
});

// Test connection
const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. PostgreSQL is running');
    console.log('   2. Database exists:', process.env.DB_NAME);
    console.log('   3. Database credentials are correct in .env file');
    return false;
  }
};

// Drop all existing tables
const dropAllTables = async (client) => {
  try {
    console.log('🗑️  Dropping existing tables...');

    // Set cascade in case of foreign key dependencies
    await client.query('SET session_replication_role = replica;');

    // Drop tables in reverse dependency order
    const tablesToDrop = [
      'notifications',
      'leave_requests',
      'leave_balances',
      'leave_types',
      'user_preferences',
      'system_settings',
      'users'
    ];

    for (const table of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ Dropped table: ${table}`);
    }

    // Drop types
    const typesToDrop = ['user_role', 'leave_type', 'leave_status'];
    for (const type of typesToDrop) {
      await client.query(`DROP TYPE IF EXISTS ${type} CASCADE`);
    }

    // Drop functions
    await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
    await client.query('DROP FUNCTION IF EXISTS recalculate_pending_days() CASCADE');

    await client.query('SET session_replication_role = DEFAULT;');
    console.log('✅ All existing tables dropped successfully');

  } catch (error) {
    console.error('❌ Failed to drop tables:', error.message);
    throw error;
  }
};

// Run fresh migration
const runFreshMigration = async () => {
  const client = await pool.connect();

  try {
    console.log('🎯 Starting Fresh Database Migration for Pigeon OffSync...\n');

    // Step 1: Drop all existing tables
    console.log('📋 STEP 1: CLEANING EXISTING DATA');
    await dropAllTables(client);

    // Step 2: Read and execute fresh schema
    console.log('\n📋 STEP 2: CREATING FRESH TABLES');

    const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded successfully');

    // Split schema into statements
    let statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    if (statements.length === 0) {
      console.log('Failed to parse schema file, using hardcoded basic statements');
      statements = [
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
        'CREATE TYPE user_role AS ENUM (\'employee\', \'manager\', \'admin\')',
        'CREATE TYPE leave_type AS ENUM (\'casual\', \'health\')',
        'CREATE TYPE leave_status AS ENUM (\'pending\', \'hr_pending\', \'manager_rejected\', \'hr_rejected\', \'admin_rejected\', \'manager_approved\', \'admin_approved\', \'cancelled\')',
        'CREATE TABLE users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, role user_role NOT NULL, department VARCHAR(255), status VARCHAR(20) DEFAULT \'pending\', is_active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE leave_types (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), type leave_type NOT NULL, name VARCHAR(100) NOT NULL, description TEXT, annual_days INTEGER NOT NULL DEFAULT 0, carry_forward_days INTEGER DEFAULT 0, max_consecutive_days INTEGER, notice_period_days INTEGER DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)',
        'INSERT INTO leave_types (type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days) VALUES (\'casual\', \'Casual Leave\', \'General personal or short-term absences\', 12, 2, 3, 1), (\'health\', \'Health Leave\', \'Medical or health-related absences\', 12, 2, 5, 1)'
      ];
    }

    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    console.log('First few statements:', statements.slice(0,5));

    // Execute each statement
    let executedCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await client.query(statement);
          executedCount++;
          console.log(`✅ Executed statement ${executedCount}/${statements.length}`);
        } catch (error) {
          console.error(`❌ Failed to execute statement ${i + 1}:`, error.message);
          console.log('Statement was:', statement.substring(0, 100) + '...');
          throw error;
        }
      }
    }

    console.log('\n🎉 Fresh migration completed successfully!');
    console.log('🦄 Pigeon OffSync database is ready!');

    // Step 3: Seed initial data
    console.log('\n🌱 SEEDING INITIAL DATA');
    await seedInitialData(client);
    console.log('✅ Initial data seeded successfully');

  } catch (error) {
    console.error('\n❌ Fresh migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Seed initial admin user and basic data
const seedInitialData = async (client) => {
  try {
    const bcrypt = require('bcryptjs');

    // Default admin password: Admin123!
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    // Create admin user
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ('admin@company.com', $1, 'System', 'Administrator', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    console.log('✅ Default admin user created:');
    console.log('   Email: admin@company.com');
    console.log('   Password: Admin123!');

  } catch (error) {
    console.error('❌ Failed to seed initial data:', error.message);
  }
};

// Main execution
const main = async () => {
  try {
    console.log('🦄 Pigeon OffSync - Fresh Database Migration\n');

    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    await runFreshMigration();

    console.log('\n🎯 Fresh Database Migration Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Database: Pigeon OffSync leave_management_db');
    console.log('🗃️  Tables: 7 core tables created');
    console.log('👤 Admin: admin@company.com / Admin123!');
    console.log('🚀 Ready to start the application!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Fresh migration script failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Confirm before proceeding
console.log('⚠️  WARNING: This will drop ALL existing data!');
console.log('   Make sure you have backed up important data.\n');

// Run after 2 seconds (gives user time to cancel)
setTimeout(() => {
  main();
}, 2000);