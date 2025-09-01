#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Leave Management System - Setup Script');
console.log('==========================================\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js version: ${nodeVersion}`);

  if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
    console.log('⚠️  Recommended Node.js version: 18.x or 20.x');
  }
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org');
  process.exit(1);
}

// Check if PostgreSQL is installed
try {
  const pgVersion = execSync('psql --version', { encoding: 'utf8' }).trim();
  console.log(`✅ PostgreSQL detected: ${pgVersion}`);
} catch (error) {
  console.log('ℹ️  PostgreSQL not detected. Please install PostgreSQL:');
  console.log('   - Windows: https://www.postgresql.org/download/windows/');
  console.log('   - macOS: brew install postgresql');
  console.log('   - Linux: sudo apt-get install postgresql postgresql-contrib');
  console.log('\n⚠️  Please install PostgreSQL and create a database before proceeding.');
  process.exit(1);
}

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname + '/..' });
  console.log('✅ Backend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install backend dependencies');
  process.exit(1);
}

// Install frontend dependencies
console.log('\n📦 Installing frontend dependencies...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname + '/../../frontend' });
  console.log('✅ Frontend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install frontend dependencies');
  process.exit(1);
}

// Check if .env file exists, if not, copy from example
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created from .env.example');
  } else {
    console.log('⚠️  .env file not found. Please create one based on the template in .env file');
  }
}

// Database setup instructions
console.log('\n🗄️  Database Setup Instructions:');
console.log('=====================================');
console.log('1. Create a PostgreSQL database:');
console.log('   psql -U postgres');
console.log('   CREATE DATABASE leave_management_db;');
console.log('   \\q');
console.log('\n2. Create a database user (replace username and password):');
console.log('   psql -U postgres');
console.log('   CREATE USER your_username WITH PASSWORD \'your_password\';');
console.log('   GRANT ALL PRIVILEGES ON DATABASE leave_management_db TO your_username;');
console.log('   \\q');
console.log('\n3. Update the .env file with your database credentials');
console.log('\n4. Run the database migration:');
console.log('   cd backend && npm run migrate');

// Environment configuration check
console.log('\n⚙️  Environment Configuration:');
console.log('=============================');
console.log('Make sure to update the following in your .env file:');
console.log('- DB_USER: Your PostgreSQL username');
console.log('- DB_PASSWORD: Your PostgreSQL password');
console.log('- JWT_SECRET: A secure random string');
console.log('- EMAIL_USER and EMAIL_PASS: For email notifications (optional)');

// Next steps
console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('1. Set up PostgreSQL database as described above');
console.log('2. Update .env file with your configuration');
console.log('3. Run database migration: npm run migrate');
console.log('4. Start the backend server: npm run dev');
console.log('5. In another terminal, start the frontend: cd frontend && npm start');
console.log('\nDefault admin credentials:');
console.log('Email: admin@company.com');
console.log('Password: Admin123!');

console.log('\n✨ Setup complete! Follow the steps above to get started.');