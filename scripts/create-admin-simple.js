const { Pool } = require('pg');
require('dotenv').config();

async function createAdminUsers() {
  console.log('🔐 Creating admin users for Village Machaan Resort...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Check if users table has required columns
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('role', 'is_active')
      ORDER BY column_name
    `);

    console.log('📋 Found columns:', columnsCheck.rows.map(r => r.column_name));

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
      console.log('ℹ️  Admin user already exists');
    } else {
      // Hash password
      const bcrypt = require('bcryptjs');
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

      console.log('✅ Admin user created successfully:');
      console.log('   Email:', adminData.email);
      console.log('   Password:', adminData.password);
      console.log('   Role:', adminData.role);
      console.log('   User ID:', result.rows[0].id);
    }

    // Create manager user
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
      console.log('ℹ️  Manager user already exists');
    } else {
      // Hash password
      const bcrypt = require('bcryptjs');
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

      console.log('✅ Manager user created successfully:');
      console.log('   Email:', managerData.email);
      console.log('   Password:', managerData.password);
      console.log('   Role:', managerData.role);
      console.log('   User ID:', result.rows[0].id);
    }

    console.log('\n🎉 Admin users setup completed!');
    console.log('\n📝 Login Credentials:');
    console.log('   Admin: admin@villagemachaan.com / admin123');
    console.log('   Manager: manager@villagemachaan.com / manager123');

  } catch (error) {
    console.error('❌ Error creating admin users:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createAdminUsers();
}

module.exports = { createAdminUsers };



