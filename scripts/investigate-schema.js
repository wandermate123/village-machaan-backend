const { Pool } = require('pg');
require('dotenv').config();

async function investigateSchema() {
  console.log('🔍 Investigating database schema...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Find all tables that might contain users
    console.log('\n📋 All tables in database:');
    const tables = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'auth')
      AND table_name LIKE '%user%'
      ORDER BY table_schema, table_name
    `);
    
    tables.rows.forEach(table => {
      console.log(`   ${table.table_schema}.${table.table_name}`);
    });

    // Check if there's an auth.users table
    console.log('\n🔍 Checking auth schema...');
    try {
      const authTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'auth'
      `);
      
      if (authTables.rows.length > 0) {
        console.log('   Auth schema tables:');
        authTables.rows.forEach(table => {
          console.log(`     - ${table.table_name}`);
        });
      } else {
        console.log('   No auth schema found');
      }
    } catch (error) {
      console.log('   Could not check auth schema:', error.message);
    }

    // Check current search path
    console.log('\n🏗️  Current search path:');
    const searchPath = await client.query('SHOW search_path');
    console.log('   Search path:', searchPath.rows[0].search_path);

    // Check if we're in the right schema
    console.log('\n📍 Current schema:');
    const currentSchema = await client.query('SELECT current_schema()');
    console.log('   Current schema:', currentSchema.rows[0].current_schema);

    // Try to find the actual users table structure
    console.log('\n🔍 Users table details:');
    try {
      const userTableInfo = await client.query(`
        SELECT 
          table_schema,
          table_name,
          column_name,
          data_type
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY table_schema, ordinal_position
      `);
      
      userTableInfo.rows.forEach(row => {
        console.log(`   ${row.table_schema}.${row.table_name}.${row.column_name}: ${row.data_type}`);
      });
    } catch (error) {
      console.log('   Could not get users table info:', error.message);
    }

  } catch (error) {
    console.error('❌ Error investigating schema:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  investigateSchema();
}

module.exports = { investigateSchema };



