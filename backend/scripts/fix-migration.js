#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
    return false;
  }
};

// Create tables manually
const createTables = async (client) => {
  try {
    console.log('🏗️ Creating tables...');

    // Create types first
    console.log('Creating types...');
    await client.query(`CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin')`);
    await client.query(`CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'personal')`);
    await client.query(`CREATE TYPE leave_status AS ENUM ('pending', 'manager_approved', 'manager_rejected', 'admin_approved', 'admin_rejected', 'cancelled')`);
    console.log('✅ Types created successfully');

    // Create tables
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role user_role NOT NULL,
        manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        department VARCHAR(255),
        employee_id VARCHAR(50) UNIQUE,
        date_of_joining DATE,
        status VARCHAR(20) DEFAULT 'pending',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating leave_types table...');
    await client.query(`
      CREATE TABLE leave_types (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type leave_type NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        annual_days INTEGER NOT NULL DEFAULT 0,
        carry_forward_days INTEGER DEFAULT 0,
        max_consecutive_days INTEGER,
        notice_period_days INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating leave_balances table...');
    await client.query(`
      CREATE TABLE leave_balances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        total_days DECIMAL(5,1) NOT NULL,
        used_days DECIMAL(5,1) DEFAULT 0,
        pending_days DECIMAL(5,1) DEFAULT 0,
        remaining_days DECIMAL(5,1) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
        carry_forward_days DECIMAL(5,1) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, leave_type_id, year)
      )
    `);

    console.log('Creating leave_requests table...');
    await client.query(`
      CREATE TABLE leave_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days DECIMAL(5,1) NOT NULL,
        reason TEXT,
        status leave_status DEFAULT 'pending',
        manager_id UUID REFERENCES users(id),
        admin_id UUID REFERENCES users(id),
        manager_approved_at TIMESTAMP WITH TIME ZONE,
        manager_rejected_at TIMESTAMP WITH TIME ZONE,
        manager_comments TEXT,
        admin_approved_at TIMESTAMP WITH TIME ZONE,
        admin_rejected_at TIMESTAMP WITH TIME ZONE,
        admin_comments TEXT,
        emergency BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_date_range CHECK (end_date >= start_date),
        CONSTRAINT valid_total_days CHECK (total_days > 0)
      )
    `);

    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read BOOLEAN DEFAULT false,
        email_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating user_preferences table...');
    await client.query(`
      CREATE TABLE user_preferences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, category, key)
      )
    `);

    console.log('Creating system_settings table...');
    await client.query(`
      CREATE TABLE system_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) NOT NULL UNIQUE,
        value JSONB,
        description TEXT,
        category VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tables created successfully');

  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    throw error;
  }
};

// Create indexes
const createIndexes = async (client) => {
  try {
    console.log('🔍 Creating indexes...');

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests(start_date, end_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON leave_balances(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(category)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category)');

    console.log('✅ Indexes created successfully');

  } catch (error) {
    console.error('❌ Failed to create indexes:', error.message);
    throw error;
  }
};

// Seed initial data
const seedData = async (client) => {
  try {
    console.log('🌱 Seeding data...');

    const bcrypt = require('bcryptjs');

    // Seed leave types
    await client.query(`
      INSERT INTO leave_types (type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days)
      VALUES
        ('annual', 'Annual Leave', 'Paid annual vacation days', 25, 5, 15, 7),
        ('sick', 'Sick Leave', 'Medical leave days', 12, 0, 5, 0),
        ('personal', 'Personal Leave', 'Personal time off', 5, 0, 3, 2)
      ON CONFLICT DO NOTHING
    `);

    // Seed admin user
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status)
      VALUES ('admin@company.com', $1, 'System', 'Administrator', 'admin', 'approved')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    console.log('✅ Data seeded successfully');

  } catch (error) {
    console.error('❌ Failed to seed data:', error.message);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    console.log('🛠️  Database Setup Script');
    console.log('=========================\n');

    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    const client = await pool.connect();

    try {
      await createTables(client);
      await createIndexes(client);
      await seedData(client);

      console.log('\n🎉 Database setup completed successfully!');
      console.log('🗃️ Tables created: 7');
      console.log('👤 Admin user: admin@company.com / Admin123!');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main();
}

module.exports = { server: main };