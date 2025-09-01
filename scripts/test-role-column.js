const { Pool } = require('pg');
require('dotenv').config();

async function testRoleColumn() {
  console.log('🧪 Testing role and is_active columns...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Test if we can SELECT from role column
    console.log('\n🔍 Testing SELECT from role column...');
    try {
      const roleTest = await client.query('SELECT id, email, role FROM users WHERE email = $1', ['admin@villagemachaan.com']);
      console.log('✅ SELECT role successful:', roleTest.rows[0]);
    } catch (error) {
      console.log('❌ SELECT role failed:', error.message);
    }

    // Test if we can SELECT from is_active column
    console.log('\n🔍 Testing SELECT from is_active column...');
    try {
      const activeTest = await client.query('SELECT id, email, is_active FROM users WHERE email = $1', ['admin@villagemachaan.com']);
      console.log('✅ SELECT is_active successful:', activeTest.rows[0]);
    } catch (error) {
      console.log('❌ SELECT is_active failed:', error.message);
    }

    // Test if we can UPDATE role column
    console.log('\n🔍 Testing UPDATE role column...');
    try {
      const updateRole = await client.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', 'admin@villagemachaan.com']);
      console.log('✅ UPDATE role successful, rows affected:', updateRole.rowCount);
    } catch (error) {
      console.log('❌ UPDATE role failed:', error.message);
    }

    // Test if we can UPDATE is_active column
    console.log('\n🔍 Testing UPDATE is_active column...');
    try {
      const updateActive = await client.query('UPDATE users SET is_active = $1 WHERE email = $2', [true, 'admin@villagemachaan.com']);
      console.log('✅ UPDATE is_active successful, rows affected:', updateActive.rowCount);
    } catch (error) {
      console.log('❌ UPDATE is_active failed:', error.message);
    }

    // Check final state
    console.log('\n🔍 Final state of admin user...');
    try {
      const finalState = await client.query('SELECT id, email, role, is_active FROM users WHERE email = $1', ['admin@villagemachaan.com']);
      console.log('✅ Final state:', finalState.rows[0]);
    } catch (error) {
      console.log('❌ Could not get final state:', error.message);
    }

  } catch (error) {
    console.error('❌ Error testing role column:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testRoleColumn();
}

module.exports = { testRoleColumn };



