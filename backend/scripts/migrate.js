#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🏗️  Database Migration Script');
console.log('=============================\n');

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
    const result = await client.query('SELECT NOW()');
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

// Execute migration
const runMigration = async () => {
  const client = await pool.connect();

  try {
    console.log('📖 Reading database schema...');

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded successfully');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

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

    console.log('🎉 Migration completed successfully!');

    // Optional: Seed initial data
    console.log('\n🌱 Seeding initial data...');
    await seedInitialData(client);
    console.log('✅ Initial data seeded successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Seed initial admin user
const seedInitialData = async (client) => {
  try {
    const bcrypt = require('bcryptjs');

    // Default admin password: Admin123!
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ('admin@company.com', $1, 'System', 'Administrator', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    console.log('✅ Default admin user created/verified');
    console.log('   Email: admin@company.com');
    console.log('   Password: Admin123!');
  } catch (error) {
    console.error('❌ Failed to seed initial data:', error.message);
  }
};

// Main execution
const main = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    await runMigration();

    console.log('\n🎯 Migration completed successfully!');
    console.log('📋 You can now run: npm run seed');
    console.log('🚀 Ready to start the application');

  } catch (error) {
    console.error('❌ Migration script failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { testConnection, runMigration };