const { initializeDatabase } = require('../config/database');

async function testConnection() {
  console.log('🔍 TESTING DATABASE CONNECTION...\n');

  try {
    await initializeDatabase();
    console.log('✅ Database connection successful!');
    console.log('✅ Schema validation passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);

    if (error.message.includes('SASL') || error.message.includes('SCRAM')) {
      console.log('\n🔧 This appears to be a PostgreSQL authentication issue.');
      console.log('Please check:');
      console.log('   1. PostgreSQL service is running');
      console.log('   2. Password format is correct');
      console.log('   3. User has correct permissions');
      console.log('   4. Database exists');
      console.log('   5. Consider using different authentication method');
    }

    if (error.message.includes('connect ETIMEDOUT')) {
      console.log('\n🔧 Connection timeout - check PostgreSQL server is running on port 5432');
    }

    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n🔧 Database does not exist - create it first');
    }

    process.exit(1);
  }
}

testConnection();