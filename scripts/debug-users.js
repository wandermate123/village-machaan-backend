const { Pool } = require('pg');
require('dotenv').config();

async function debugUsersTable() {
  console.log('🔍 Debugging users table structure...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Get exact column names and types
    console.log('\n📋 Exact column names:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    columns.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type})`);
    });

    // Try to get table info using \d command equivalent
    console.log('\n🔍 Table description:');
    try {
      const tableInfo = await client.query(`
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_name = 'users'
        ORDER BY c.ordinal_position
      `);
      
      tableInfo.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type} - ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('   Could not get table info:', error.message);
    }

    // Try a simple insert to see what happens
    console.log('\n🧪 Testing simple insert...');
    try {
      const testResult = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email
      `, ['test@example.com', 'testhash', 'Test', 'User']);
      
      console.log('✅ Test insert successful:', testResult.rows[0]);
      
      // Clean up test user
      await client.query('DELETE FROM users WHERE email = $1', ['test@example.com']);
      console.log('🧹 Test user cleaned up');
      
    } catch (error) {
      console.log('❌ Test insert failed:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error position:', error.position);
    }

    // Check if we're in the right schema
    console.log('\n🏗️  Current schema info:');
    const currentSchema = await client.query('SELECT current_schema()');
    console.log('   Current schema:', currentSchema.rows[0].current_schema);
    
    const searchPath = await client.query('SHOW search_path');
    console.log('   Search path:', searchPath.rows[0].search_path);

  } catch (error) {
    console.error('❌ Error debugging users table:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  debugUsersTable();
}

module.exports = { debugUsersTable };



