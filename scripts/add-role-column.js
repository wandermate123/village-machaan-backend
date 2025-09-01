const { Pool } = require('pg');
require('dotenv').config();

async function addRoleColumn() {
  console.log('🔧 Adding role column to public.users table...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Check if role column already exists in public.users
    const roleCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'role'
    `);

    if (roleCheck.rows.length === 0) {
      console.log('➕ Adding role column to public.users...');
      await client.query(`
        ALTER TABLE public.users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'customer'
      `);
      console.log('✅ Role column added successfully');
    } else {
      console.log('ℹ️  Role column already exists in public.users');
    }

    // Verify the column was added
    const verifyColumns = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      AND column_name IN ('role', 'is_active')
      ORDER BY column_name
    `);

    console.log('\n📋 Current columns in public.users:');
    verifyColumns.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (default: ${row.column_default}, nullable: ${row.is_nullable})`);
    });

    // Update existing admin users with roles
    console.log('\n🔧 Updating existing admin users with roles...');
    
    try {
      const updateAdmin = await client.query(`
        UPDATE public.users 
        SET role = 'admin' 
        WHERE email = 'admin@villagemachaan.com'
      `);
      console.log('✅ Admin role updated, rows affected:', updateAdmin.rowCount);

      const updateManager = await client.query(`
        UPDATE public.users 
        SET role = 'manager' 
        WHERE email = 'manager@villagemachaan.com'
      `);
      console.log('✅ Manager role updated, rows affected:', updateManager.rowCount);

    } catch (updateError) {
      console.log('⚠️  Could not update roles:', updateError.message);
    }

    console.log('\n🎉 Role column setup completed!');

  } catch (error) {
    console.error('❌ Error adding role column:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addRoleColumn();
}

module.exports = { addRoleColumn };



