const { Pool } = require('pg');
require('dotenv').config();

// Database connection for initialization
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default postgres database first
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Create database if it doesn't exist
    console.log('📊 Creating database...');
    await pool.query(`
      SELECT 'CREATE DATABASE village_machaan'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'village_machaan')
    `);
    
    console.log('✅ Database created or already exists');
    
    // Close connection to postgres database
    await pool.end();
    
    // Connect to the new database
    const dbPool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'village_machaan',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
    
    // Read and execute schema
    console.log('📋 Executing database schema...');
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await dbPool.query(statement);
          console.log('✅ Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error('❌ Error executing statement:', error.message);
          }
        }
      }
    }
    
    console.log('✅ Database schema executed successfully');
    
    // Test connection
    const result = await dbPool.query('SELECT NOW() as current_time');
    console.log('🕐 Database connection test:', result.rows[0].current_time);
    
    await dbPool.end();
    
    console.log('🎉 Database initialization completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Update your .env file with database credentials');
    console.log('   2. Run: npm run dev');
    console.log('   3. Test the API at: http://localhost:5000/api/health');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
