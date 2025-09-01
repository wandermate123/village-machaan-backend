const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
  console.log('🔍 Checking database structure...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Check users table structure
    console.log('\n📋 Users table structure:');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    tableStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check if users table has any data
    console.log('\n👥 Users table data:');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`   Total users: ${userCount.rows[0].count}`);

    if (parseInt(userCount.rows[0].count) > 0) {
      const sampleUsers = await client.query('SELECT id, email, first_name, last_name FROM users LIMIT 3');
      console.log('   Sample users:');
      sampleUsers.rows.forEach(user => {
        console.log(`     - ${user.email} (${user.first_name} ${user.last_name})`);
      });
    }

    // Try to describe the users table
    console.log('\n🔍 Detailed table info:');
    try {
      const describeTable = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      describeTable.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} - ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('   Could not get detailed table info:', error.message);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkDatabase();
}

module.exports = { checkDatabase };



