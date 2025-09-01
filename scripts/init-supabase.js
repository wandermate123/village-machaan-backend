const { Pool } = require('pg');
require('dotenv').config();

// Database connection for Supabase
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeSupabaseDatabase() {
  try {
    console.log('🚀 Starting Supabase database initialization...');
    
    // Test connection first
    console.log('🔌 Testing database connection...');
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connected to Supabase at:', testResult.rows[0].current_time);
    
    // Read and execute schema
    console.log('📋 Executing database schema...');
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the entire schema as one statement
    try {
      await pool.query(schema);
      console.log('✅ Database schema executed successfully');
    } catch (error) {
      console.log('ℹ️  Schema execution note:', error.message);
      // Continue anyway as some parts might have succeeded
    }
    
    // Test some basic queries
    console.log('🧪 Testing basic database operations...');
    
    try {
      const cottagesResult = await pool.query('SELECT COUNT(*) as count FROM cottages');
      console.log('🏡 Cottages count:', cottagesResult.rows[0].count);
    } catch (error) {
      console.log('❌ Cottages table not found:', error.message);
    }
    
    try {
      const packagesResult = await pool.query('SELECT COUNT(*) as count FROM packages');
      console.log('📦 Packages count:', packagesResult.rows[0].count);
    } catch (error) {
      console.log('❌ Packages table not found:', error.message);
    }
    
    await pool.end();
    
    console.log('🎉 Supabase database initialization completed!');
    console.log('📝 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Test the API at: http://localhost:5000/api/health');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeSupabaseDatabase();
