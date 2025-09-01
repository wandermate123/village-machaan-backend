const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    // Check if users table exists and has role column
    const tableCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('Adding role column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'customer',
        ADD COLUMN is_active BOOLEAN DEFAULT true
      `);
      console.log('Role column added successfully');
    }

    // Create admin user
    const adminData = {
      email: 'admin@villagemachaan.com',
      password: 'admin123',
      firstName: 'Resort',
      lastName: 'Admin',
      phone: '+919876543210',
      role: 'admin'
    };

    // Check if admin already exists
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminData.email]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

    // Insert admin user
    const result = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, role
    `, [
      adminData.email, 
      passwordHash, 
      adminData.firstName, 
      adminData.lastName, 
      adminData.phone, 
      adminData.role, 
      true
    ]);

    console.log('Admin user created successfully:');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('Role:', adminData.role);
    console.log('User ID:', result.rows[0].id);

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Create manager user
async function createManagerUser() {
  const client = await pool.connect();
  
  try {
    const managerData = {
      email: 'manager@villagemachaan.com',
      password: 'manager123',
      firstName: 'Resort',
      lastName: 'Manager',
      phone: '+919876543211',
      role: 'manager'
    };

    // Check if manager already exists
    const existingManager = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [managerData.email]
    );

    if (existingManager.rows.length > 0) {
      console.log('Manager user already exists');
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(managerData.password, saltRounds);

    // Insert manager user
    const result = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, role
    `, [
      managerData.email, 
      passwordHash, 
      managerData.firstName, 
      managerData.lastName, 
      managerData.phone, 
      managerData.role, 
      true
    ]);

    console.log('Manager user created successfully:');
    console.log('Email:', managerData.email);
    console.log('Password:', managerData.password);
    console.log('Role:', managerData.role);
    console.log('User ID:', result.rows[0].id);

  } catch (error) {
    console.error('Error creating manager user:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  console.log('Creating admin users for Village Machaan Resort...\n');
  
  createAdminUser()
    .then(() => createManagerUser())
    .then(() => {
      console.log('\nAdmin user setup completed!');
      console.log('\nDefault credentials:');
      console.log('Admin: admin@villagemachaan.com / admin123');
      console.log('Manager: manager@villagemachaan.com / manager123');
      console.log('\n⚠️  IMPORTANT: Change these passwords after first login!');
    })
    .catch(console.error);
}

module.exports = { createAdminUser, createManagerUser };



