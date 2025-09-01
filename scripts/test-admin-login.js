const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testAdminLogin() {
  console.log('🧪 Testing admin login functionality...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Test 1: Check if admin user exists and has correct role
    console.log('\n🔍 Checking admin user in database...');
    const adminUser = await client.query(`
      SELECT id, email, first_name, last_name, role, is_active 
      FROM public.users 
      WHERE email = 'admin@villagemachaan.com'
    `);

    if (adminUser.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }

    const user = adminUser.rows[0];
    console.log('✅ Admin user found:', {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      is_active: user.is_active
    });

    // Test 2: Verify password hash exists
    console.log('\n🔍 Checking password hash...');
    const passwordCheck = await client.query(`
      SELECT password_hash 
      FROM public.users 
      WHERE email = 'admin@villagemachaan.com'
    `);

    if (!passwordCheck.rows[0].password_hash) {
      console.log('❌ Password hash not found!');
      return;
    }

    console.log('✅ Password hash exists');

    // Test 3: Test password verification
    console.log('\n🔍 Testing password verification...');
    const testPassword = 'admin123';
    const storedHash = passwordCheck.rows[0].password_hash;
    
    const isPasswordValid = await bcrypt.compare(testPassword, storedHash);
    console.log('Password verification result:', isPasswordValid ? '✅ Valid' : '❌ Invalid');

    // Test 4: Simulate the admin login query
    console.log('\n🔍 Simulating admin login query...');
    try {
      const loginQuery = await client.query(`
        SELECT * FROM public.users 
        WHERE email = $1 
        AND role IN ($2, $3) 
        AND is_active = true
      `, ['admin@villagemachaan.com', 'admin', 'manager']);

      console.log('✅ Login query successful, found users:', loginQuery.rows.length);
      
      if (loginQuery.rows.length > 0) {
        const foundUser = loginQuery.rows[0];
        console.log('Found user:', {
          id: foundUser.id,
          email: foundUser.email,
          role: foundUser.role,
          is_active: foundUser.is_active
        });
      }
    } catch (error) {
      console.log('❌ Login query failed:', error.message);
      console.log('Error details:', error);
    }

    console.log('\n🎉 Admin login test completed!');

  } catch (error) {
    console.error('❌ Error testing admin login:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testAdminLogin();
}

module.exports = { testAdminLogin };



