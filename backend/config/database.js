const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000,
});

// Test database connection
const testConnection = async () => {
  console.log('🗄️  Testing database connection...');
  console.log('Connection config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? '***SET***' : 'NOT SET',
    ssl: process.env.DB_SSL === 'true'
  });

  try {
    const client = await pool.connect();
    console.log('🗄️  Connected to database successfully');

    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful at:', result.rows[0].now);

    // Test basic queries
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log('✅ Users table check passed, count:', userCount.rows[0].count);

    const leaveTypeCount = await client.query('SELECT COUNT(*) FROM leave_types');
    console.log('✅ Leave types table check passed, count:', leaveTypeCount.rows[0].count);

    client.release();
    console.log('✅ Database connection test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('🔧 PostgreSQL server may not be running or refusing connections');
    }
    if (error.message.includes('authentication') || error.message.includes('password')) {
      console.error('🔧 Authentication failed - check password and user permissions');
    }
    return false;
  }
};

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Check if tables exist and create them if needed
    const client = await pool.connect();

    try {
      // Check if users table exists
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'users'
        );
      `);

      if (!result.rows[0].exists) {
        console.log('🔧 Creating database schema...');

        // Read and execute schema file
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, '..', 'database-schema.sql');

        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, 'utf8');

          // Split schema into individual statements
          const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

          for (const statement of statements) {
            if (statement.trim()) {
              await client.query(statement);
            }
          }

          console.log('✅ Database schema created successfully');

          // Optional: Seed initial data
          await seedDatabase(client);
        } else {
          console.log('ℹ️  Schema file not found, please run it manually');
        }
      } else {
        console.log('✅ Database schema already exists');
      }
    } finally {
      client.release();
    }

    return pool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Seed database with initial data
const seedDatabase = async (client) => {
  try {
    console.log('🌱 Seeding database with initial data...');

    // Note: Use the create-admin.js script to create admin users
    console.log('ℹ️  Use scripts/create-admin.js to create admin users');
    console.log('✅ Database schema is ready');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  }
};

// Query helper functions
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`Query executed (${duration}ms):`, text);
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Transaction helper
const getClient = () => {
  return pool.connect();
};

// Close all connections
const closeConnection = async () => {
  try {
    await pool.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  pool,
  query,
  getClient,
  initializeDatabase,
  closeConnection,
  testConnection
};