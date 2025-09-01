#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
});

async function inspectLeaveTypes() {
  try {
    console.log('🔍 Inspecting leave types in database...');

    // Check if leave_types table exists
    console.log('\n1. Checking if leave_types table exists...');
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'leave_types'
    `);
    const tableExists = tableCheck.rows.length > 0;
    console.log('   Table exists:', tableExists ? 'YES' : 'NO');

    if (!tableExists) {
      console.log('❌ Leave types table does not exist!');
      return;
    }

    // Get data from leave_types table
    console.log('\n2. Fetching leave types data...');
    const dataQuery = await pool.query(`
      SELECT
        t.id,
        t.type,
        t.name,
        t.description,
        t.annual_days,
        t.notice_period_days
      FROM leave_types t
      ORDER BY t.id
    `);

    console.log(`   Number of leave types found: ${dataQuery.rows.length}`);
    if (dataQuery.rows.length > 0) {
      console.log('\n   Leave types data:');
      dataQuery.rows.forEach(lt => {
        console.log(`   - ID: ${lt.id}`);
        console.log(`     Type: ${lt.type}`);
        console.log(`     Name: ${lt.name}`);
        console.log(`     Description: ${lt.description}`);
        console.log(`     Annual Days: ${lt.annual_days}`);
        console.log(`     Notice Period: ${lt.notice_period_days}`);
        console.log('   ---');
      });
    }

  } catch (error) {
    console.error('❌ Database inspection error:', error.message);
  } finally {
    await pool.end();
  }
}

inspectLeaveTypes();