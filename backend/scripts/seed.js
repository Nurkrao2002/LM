#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('🌱 Database Seeding Script');
console.log('==========================\n');

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
});



const dummyUsers = [
  // Additional Admin
  {
    email: 'admin2@company.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'admin',
    department: 'IT',
    employee_id: 'ADM002',
    date_of_joining: '2023-01-15'
  },

  // HR Managers
  {
    email: 'sarah.johnson@company.com',
    first_name: 'Sarah',
    last_name: 'Johnson',
    role: 'manager',
    department: 'Human Resources',
    employee_id: 'MGR001',
    date_of_joining: '2023-02-01'
  },
  {
    email: 'mike.davis@company.com',
    first_name: 'Mike',
    last_name: 'Davis',
    role: 'manager',
    department: 'Human Resources',
    employee_id: 'MGR002',
    date_of_joining: '2023-03-10'
  },

  // IT Managers
  {
    email: 'alex.chen@company.com',
    first_name: 'Alex',
    last_name: 'Chen',
    role: 'manager',
    department: 'Information Technology',
    employee_id: 'MGR003',
    date_of_joining: '2023-01-20'
  },
  {
    email: 'rachel.brown@company.com',
    first_name: 'Rachel',
    last_name: 'Brown',
    role: 'manager',
    department: 'Information Technology',
    employee_id: 'MGR004',
    date_of_joining: '2023-04-05'
  },

  // Finance Managers
  {
    email: 'david.wilson@company.com',
    first_name: 'David',
    last_name: 'Wilson',
    role: 'manager',
    department: 'Finance',
    employee_id: 'MGR005',
    date_of_joining: '2023-02-15'
  },

  // Sales Managers
  {
    email: 'lisa.anderson@company.com',
    first_name: 'Lisa',
    last_name: 'Anderson',
    role: 'manager',
    department: 'Sales',
    employee_id: 'MGR006',
    date_of_joining: '2023-03-01'
  },

  // Marketing Manager
  {
    email: 'james.taylor@company.com',
    first_name: 'James',
    last_name: 'Taylor',
    role: 'manager',
    department: 'Marketing',
    employee_id: 'MGR007',
    date_of_joining: '2023-05-10'
  },

  // HR Employees
  {
    email: 'anna.martinez@company.com',
    first_name: 'Anna',
    last_name: 'Martinez',
    role: 'employee',
    department: 'Human Resources',
    employee_id: 'EMP001',
    date_of_joining: '2023-06-01'
  },
  {
    email: 'chris.garcia@company.com',
    first_name: 'Chris',
    last_name: 'Garcia',
    role: 'employee',
    department: 'Human Resources',
    employee_id: 'EMP002',
    date_of_joining: '2023-07-15'
  },
  {
    email: 'nancy.lopez@company.com',
    first_name: 'Nancy',
    last_name: 'Lopez',
    role: 'employee',
    department: 'Human Resources',
    employee_id: 'EMP003',
    date_of_joining: '2023-08-20'
  },

  // IT Employees
  {
    email: 'tom.kim@company.com',
    first_name: 'Tom',
    last_name: 'Kim',
    role: 'employee',
    department: 'Information Technology',
    employee_id: 'EMP004',
    date_of_joining: '2023-06-10'
  },
  {
    email: 'amy.white@company.com',
    first_name: 'Amy',
    last_name: 'White',
    role: 'employee',
    department: 'Information Technology',
    employee_id: 'EMP005',
    date_of_joining: '2023-07-05'
  },
  {
    email: 'bob.lee@company.com',
    first_name: 'Bob',
    last_name: 'Lee',
    role: 'employee',
    department: 'Information Technology',
    employee_id: 'EMP006',
    date_of_joining: '2023-08-01'
  },
  {
    email: 'sara.patel@company.com',
    first_name: 'Sara',
    last_name: 'Patel',
    role: 'employee',
    department: 'Information Technology',
    employee_id: 'EMP007',
    date_of_joining: '2023-09-15'
  },

  // Finance Employees
  {
    email: 'kevin.jones@company.com',
    first_name: 'Kevin',
    last_name: 'Jones',
    role: 'employee',
    department: 'Finance',
    employee_id: 'EMP008',
    date_of_joining: '2023-07-01'
  },
  {
    email: 'helen.zhang@company.com',
    first_name: 'Helen',
    last_name: 'Zhang',
    role: 'employee',
    department: 'Finance',
    employee_id: 'EMP009',
    date_of_joining: '2023-08-10'
  },

  // Sales Employees
  {
    email: 'ryan.thomas@company.com',
    first_name: 'Ryan',
    last_name: 'Thomas',
    role: 'employee',
    department: 'Sales',
    employee_id: 'EMP010',
    date_of_joining: '2023-06-20'
  },
  {
    email: 'olivia.miller@company.com',
    first_name: 'Olivia',
    last_name: 'Miller',
    role: 'employee',
    department: 'Sales',
    employee_id: 'EMP011',
    date_of_joining: '2023-07-25'
  },

  // Marketing Employees
  {
    email: 'jacob.rodriguez@company.com',
    first_name: 'Jacob',
    last_name: 'Rodriguez',
    role: 'employee',
    department: 'Marketing',
    employee_id: 'EMP012',
    date_of_joining: '2023-08-05'
  },
  {
    email: 'emily.robinson@company.com',
    first_name: 'Emily',
    last_name: 'Robinson',
    role: 'employee',
    department: 'Marketing',
    employee_id: 'EMP013',
    date_of_joining: '2023-09-01'
  }
];

// Test database connection
const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    const client = await pool.connect();
    client.release();
    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Hash a password
const hashPassword = async (password) => {
  const bcrypt = require('bcryptjs');
  return await bcrypt.hash(password, 12);
};

// Seed leave types
const seedLeaveTypes = async (client) => {
  console.log('\n📋 Creating leave types...');

  const leaveTypes = [
    {
      type: 'annual',
      name: 'Annual Leave',
      description: 'Regular vacation days accumulated annually',
      annual_days: 25,
      carry_forward_days: 10,
      max_consecutive_days: 30,
      notice_period_days: 14
    },
    {
      type: 'sick',
      name: 'Sick Leave',
      description: 'Medical leave for illness or injury',
      annual_days: 12,
      carry_forward_days: 0,
      max_consecutive_days: 30,
      notice_period_days: 1
    },
    {
      type: 'personal',
      name: 'Personal Leave',
      description: 'Personal matters or emergency leave',
      annual_days: 5,
      carry_forward_days: 0,
      max_consecutive_days: 10,
      notice_period_days: 7
    }
  ];

  for (const leaveType of leaveTypes) {
    try {
      await client.query(`
        INSERT INTO leave_types (type, name, description, annual_days, carry_forward_days, max_consecutive_days, notice_period_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        leaveType.type,
        leaveType.name,
        leaveType.description,
        leaveType.annual_days,
        leaveType.carry_forward_days,
        leaveType.max_consecutive_days,
        leaveType.notice_period_days
      ]);

      console.log(`✅ Created leave type: ${leaveType.name}`);
    } catch (error) {
      console.error(`❌ Failed to create leave type ${leaveType.type}:`, error.message);
    }
  }
};

// Insert dummy users
const seedDummyUsers = async (client) => {
  console.log('\n👥 Creating dummy users...');

  const currentYear = new Date().getFullYear();

  for (let i = 0; i < dummyUsers.length; i++) {
    const user = dummyUsers[i];
    try {
      const hashedPassword = await hashPassword('Password123!'); // Default password for all dummy users

      await client.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, department,
          employee_id, date_of_joining, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (email) DO NOTHING
      `, [
        user.email,
        hashedPassword,
        user.first_name,
        user.last_name,
        user.role,
        user.department,
        user.employee_id,
        user.date_of_joining
      ]);

      console.log(`✅ Created user: ${user.first_name} ${user.last_name} (${user.role}) - ${user.department}`);

      // Create leave balances for the user
      await createLeaveBalances(client, user, currentYear);

    } catch (error) {
      console.error(`❌ Failed to create user ${user.email}:`, error.message);
    }
  }
};

// Create leave balances for a user
const createLeaveBalances = async (client, user, year) => {
  try {
    // Get leave type IDs
    const leaveTypesResult = await client.query('SELECT id, type FROM leave_types');
    const leaveTypes = leaveTypesResult.rows;

    for (const leaveType of leaveTypes) {
      // Default balances based on leave type
      let totalDays = 0;
      if (leaveType.type === 'annual') {
        totalDays = 25.0;
      } else if (leaveType.type === 'sick') {
        totalDays = 12.0;
      } else if (leaveType.type === 'personal') {
        totalDays = 5.0;
      }

      await client.query(`
        INSERT INTO leave_balances (
          user_id, leave_type_id, year, total_days, used_days, pending_days
        ) VALUES (
          (SELECT id FROM users WHERE email = $1),
          $2, $3, $4, 0, 0
        )
        ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
      `, [user.email, leaveType.id, year, totalDays]);
    }
  } catch (error) {
    console.error(`❌ Failed to create leave balances for ${user.email}:`, error.message);
  }
};

// Set up manager-employee relationships
const setupManagerRelationships = async (client) => {
  console.log('\n👔 Setting up manager-employee relationships...');

  const relationships = [
    // HR Manager -> HR Employees
    ['sarah.johnson@company.com', ['anna.martinez@company.com', 'chris.garcia@company.com']],
    ['mike.davis@company.com', ['nancy.lopez@company.com']],

    // IT Managers -> IT Employees
    ['alex.chen@company.com', ['tom.kim@company.com', 'amy.white@company.com']],
    ['rachel.brown@company.com', ['bob.lee@company.com', 'sara.patel@company.com']],

    // Finance Manager -> Finance Employees
    ['david.wilson@company.com', ['kevin.jones@company.com', 'helen.zhang@company.com']],

    // Sales Manager -> Sales Employees
    ['lisa.anderson@company.com', ['ryan.thomas@company.com', 'olivia.miller@company.com']],

    // Marketing Manager -> Marketing Employees
    ['james.taylor@company.com', ['jacob.rodriguez@company.com', 'emily.robinson@company.com']]
  ];

  for (const [managerEmail, employeeEmails] of relationships) {
    for (const employeeEmail of employeeEmails) {
      try {
        await client.query(`
          UPDATE users
          SET manager_id = (SELECT id FROM users WHERE email = $1)
          WHERE email = $2
        `, [managerEmail, employeeEmail]);
        console.log(`✅ Assigned ${employeeEmail} to manager ${managerEmail}`);
      } catch (error) {
        console.error(`❌ Failed to assign manager for ${employeeEmail}:`, error.message);
      }
    }
  }
};

// Create some sample leave requests
const createSampleLeaveRequests = async (client) => {
  console.log('\n📋 Creating sample leave requests...');

  const leaveRequests = [
    {
      email: 'tom.kim@company.com',
      leaveType: 'annual',
      startDate: '2024-02-15',
      endDate: '2024-02-20',
      totalDays: 3,
      reason: 'Family vacation',
      status: 'manager_approved'
    },
    {
      email: 'anna.martinez@company.com',
      leaveType: 'sick',
      startDate: '2024-01-25',
      endDate: '2024-01-26',
      totalDays: 2,
      reason: 'Medical appointment',
      status: 'pending'
    },
    {
      email: 'ryan.thomas@company.com',
      leaveType: 'personal',
      startDate: '2024-03-01',
      endDate: '2024-03-01',
      totalDays: 1,
      reason: 'Personal matters',
      status: 'pending'
    },
    {
      email: 'amy.white@company.com',
      leaveType: 'annual',
      startDate: '2024-01-08',
      endDate: '2024-01-12',
      totalDays: 5,
      reason: 'Holiday trip',
      status: 'admin_approved'
    }
  ];

  for (const request of leaveRequests) {
    try {
      await client.query(`
        INSERT INTO leave_requests (
          user_id, leave_type_id, start_date, end_date, total_days,
          reason, status, manager_approved_at
        ) VALUES (
          (SELECT id FROM users WHERE email = $1),
          (SELECT id FROM leave_types WHERE type = $2),
          $3, $4, $5, $6, $7,
          CASE WHEN $7 = 'manager_approved' THEN CURRENT_TIMESTAMP ELSE NULL END
        )
      `, [
        request.email,
        request.leaveType,
        request.startDate,
        request.endDate,
        request.totalDays,
        request.reason,
        request.status
      ]);

      console.log(`✅ Created leave request for ${request.email} (${request.totalDays} days, ${request.status})`);
    } catch (error) {
      console.error(`❌ Failed to create leave request for ${request.email}:`, error.message);
    }
  }
};

// Main seeding function
const seedDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seeding...');

    // Create leave types first
    await seedLeaveTypes(client);

    // Create dummy users
    await seedDummyUsers(client);

    // Setup manager-employee relationships
    await setupManagerRelationships(client);

    // Create sample leave requests
    await createSampleLeaveRequests(client);

    // Recalculate leave balances
    console.log('\n🔄 Recalculating leave balances...');
    await client.query('SELECT recalculate_pending_days();');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   • Created ${dummyUsers.length} dummy users`);
    console.log(`   • Managers: ${dummyUsers.filter(u => u.role === 'manager').length}`);
    console.log(`   • Employees: ${dummyUsers.filter(u => u.role === 'employee').length}`);
    console.log(`   • Admins: ${dummyUsers.filter(u => u.role === 'admin').length}`);
    console.log(`   • Departments: IT, HR, Finance, Sales, Marketing`);
    console.log(`   • Sample leave requests created`);

    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@company.com / Admin123!');
    console.log('   Managers: [manager]@company.com / Password123!');
    console.log('   Employees: [employee]@company.com / Password123!');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Main execution
const main = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    await seedDatabase();

  } catch (error) {
    console.error('❌ Seeding script failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the seeding
if (require.main === module) {
  main();
}

module.exports = { testConnection, seedDatabase };