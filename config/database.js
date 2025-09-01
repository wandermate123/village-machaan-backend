const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Check if running on Vercel (serverless) vs Render (persistent)
const isVercel = process.env.VERCEL;
const isRender = process.env.RENDER;

let database;

if (isVercel) {
  // For Vercel deployment, use in-memory database
  console.log('🔄 Using in-memory database for Vercel deployment');
  database = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error('Error connecting to in-memory database:', err.message);
    } else {
      console.log('✅ Connected to in-memory SQLite database');
      initializeVercelDatabase();
    }
  });
} else {
  // Local development and Render - use file database
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Use persistent database for Render and local development
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'village_machaan.db');
  
  console.log('🔄 Using persistent SQLite database:', DB_PATH);
  
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  database = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('✅ Connected to persistent SQLite database');
      // Initialize database for Render deployment
      if (isRender) {
        initializeRenderDatabase();
      }
    }
  });
}

// Initialize database for Vercel (in-memory)
async function initializeVercelDatabase() {
  try {
    // Create all necessary tables
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS cottages (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL,
        base_price REAL NOT NULL,
        amenities TEXT,
        image_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        description TEXT,
        price_multiplier REAL NOT NULL,
        includes_safari INTEGER DEFAULT 0,
        max_safaris INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS safari_types (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        description TEXT,
        duration TEXT,
        price REAL NOT NULL,
        max_guests INTEGER DEFAULT 6,
        includes TEXT,
        highlights TEXT,
        time_slots TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        booking_reference TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        cottage_type TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        adults INTEGER DEFAULT 1,
        children INTEGER DEFAULT 0,
        package_id TEXT,
        total_amount REAL NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        booking_status TEXT DEFAULT 'confirmed',
        special_requests TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        booking_reference TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        payment_status TEXT DEFAULT 'pending',
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT,
        razorpay_signature TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert sample data
    await insertSampleData();
    console.log('✅ Vercel database initialized with sample data');
  } catch (error) {
    console.error('❌ Error initializing Vercel database:', error);
  }
}

// Initialize database for Render (file-based)
async function initializeRenderDatabase() {
  try {
    console.log('🚀 Starting Render database initialization...');
    
    // Check if database is already initialized
    const existingUsers = await getRow('SELECT COUNT(*) as count FROM users');
    if (existingUsers && existingUsers.count > 0) {
      console.log('✅ Database already initialized, skipping...');
      return;
    }

    // Create all necessary tables
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS cottages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        capacity INTEGER NOT NULL,
        price_per_night REAL NOT NULL,
        amenities TEXT,
        images TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price_multiplier REAL NOT NULL,
        includes_safari INTEGER DEFAULT 0,
        max_safaris INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS safari_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        duration TEXT,
        price REAL NOT NULL,
        max_guests INTEGER DEFAULT 6,
        includes TEXT,
        highlights TEXT,
        time_slots TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_reference TEXT UNIQUE NOT NULL,
        cottage_id INTEGER,
        package_id INTEGER,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        adults INTEGER DEFAULT 1,
        children INTEGER DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'pending',
        special_requests TEXT,
        guest_details TEXT,
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cottage_id) REFERENCES cottages (id),
        FOREIGN KEY (package_id) REFERENCES packages (id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS safari_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        safari_type_id INTEGER NOT NULL,
        participants INTEGER NOT NULL,
        date DATE NOT NULL,
        time_slot TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings (id),
        FOREIGN KEY (safari_type_id) REFERENCES safari_types (id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_id TEXT,
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT,
        razorpay_signature TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
      )
    `);

    console.log('✅ All tables created successfully');
    
    // Insert sample data
    await insertRenderSampleData();
    
    console.log('🎉 Render database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error initializing Render database:', error);
  }
}

// Insert sample data for Render
async function insertRenderSampleData() {
  try {
    console.log('📝 Inserting sample data for Render...');

    // Sample cottages
    await run(`
      INSERT INTO cottages (name, type, description, capacity, price_per_night, amenities, images)
      VALUES 
      ('Glass Cottage', 'glass-cottage', 'Luxurious glass-walled cottage with panoramic views', 4, 15000, 'AC, WiFi, Kitchen, Private Bathroom, Mountain View', '["glass-cottage.png"]'),
      ('Hornbill Villa', 'hornbill-villa', 'Spacious villa with modern amenities', 6, 18000, 'AC, WiFi, Kitchen, Private Bathroom, Garden, BBQ', '["hornbill-villa.png"]'),
      ('Kingfisher Villa', 'kingfisher-villa', 'Premium villa with river view', 8, 22000, 'AC, WiFi, Kitchen, Private Bathroom, River View, Pool', '["kingfisher-villa.png"]')
    `);

    // Sample packages
    await run(`
      INSERT INTO packages (name, description, price_multiplier, includes_safari, max_safaris)
      VALUES 
      ('Honeymoon Package', 'Romantic getaway with special amenities', 1.3, 0, 0),
      ('Family Fun Package', 'Family-friendly activities and amenities', 1.2, 0, 0),
      ('Safari Adventure Package', 'Wildlife experience with guided safaris', 1.5, 1, 3),
      ('Elderly Package', 'Comfortable stay with accessibility features', 1.1, 0, 0)
    `);

    // Sample safari types
    await run(`
      INSERT INTO safari_types (name, description, duration, price, max_guests, includes, highlights, time_slots)
      VALUES 
      ('Morning Safari', 'Early morning wildlife viewing', '3.5 hours', 800, 6, '["Professional Guide", "Safari Vehicle", "Refreshments"]', '["Best wildlife sighting", "Cool weather", "Bird watching"]', '["06:00", "06:30", "07:00"]'),
      ('Evening Safari', 'Sunset wildlife experience', '3 hours', 750, 6, '["Professional Guide", "Safari Vehicle", "Evening Tea"]', '["Sunset views", "Active wildlife", "Photography"]', '["15:30", "16:00", "16:30"]'),
      ('Night Safari', 'Nocturnal wildlife adventure', '2.5 hours', 900, 4, '["Professional Guide", "Safari Vehicle", "Flashlights"]', '["Nocturnal animals", "Unique experience", "Adventure"]', '["19:00", "19:30", "20:00"]')
    `);

    // Create default admin user with proper password hash
    const bcrypt = require('bcryptjs');
    const adminPassword = 'admin123'; // Default password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
    
    await run(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Admin', 'admin@villagemachaan.com', ?, 'admin')
    `, [passwordHash]);
    
    console.log('🔑 Admin user created with credentials:');
    console.log('   Email: admin@villagemachaan.com');
    console.log('   Password: admin123');

    console.log('✅ Sample data inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  }
}

// Insert sample data for Vercel
async function insertSampleData() {
  try {
    // Sample cottages
    await run(`
      INSERT OR IGNORE INTO cottages (name, description, capacity, base_price, amenities)
      VALUES 
      ('Glass Cottage', 'Luxurious glass-walled cottage with panoramic views', 4, 15000, 'AC, WiFi, Kitchen, Private Bathroom, Mountain View'),
      ('Hornbill Villa', 'Spacious villa with modern amenities', 6, 18000, 'AC, WiFi, Kitchen, Private Bathroom, Garden, BBQ'),
      ('Kingfisher Villa', 'Premium villa with river view', 8, 22000, 'AC, WiFi, Kitchen, Private Bathroom, River View, Pool')
    `);

    // Sample packages
    await run(`
      INSERT OR IGNORE INTO packages (name, description, price_multiplier, includes_safari, max_safaris)
      VALUES 
      ('Honeymoon Package', 'Romantic getaway with special amenities', 1.3, 0, 0),
      ('Family Fun Package', 'Family-friendly activities and amenities', 1.2, 0, 0),
      ('Safari Adventure Package', 'Wildlife experience with guided safaris', 1.5, 1, 3),
      ('Elderly Package', 'Comfortable stay with accessibility features', 1.1, 0, 0)
    `);

    // Sample safari types
    await run(`
      INSERT OR IGNORE INTO safari_types (name, description, duration, price, max_guests, includes, highlights, time_slots)
      VALUES 
      ('Morning Safari', 'Early morning wildlife viewing', '3.5 hours', 800, 6, '["Professional Guide", "Safari Vehicle", "Refreshments"]', '["Best wildlife sighting", "Cool weather", "Bird watching"]', '["06:00", "06:30", "07:00"]'),
      ('Evening Safari', 'Sunset wildlife experience', '3 hours', 750, 6, '["Professional Guide", "Safari Vehicle", "Evening Tea"]', '["Sunset views", "Active wildlife", "Photography"]', '["15:30", "16:00", "16:30"]'),
      ('Night Safari', 'Nocturnal wildlife adventure', '2.5 hours', 900, 4, '["Professional Guide", "Safari Vehicle", "Flashlights"]', '["Nocturnal animals", "Unique experience", "Adventure"]', '["19:00", "19:30", "20:00"]')
    `);

    console.log('✅ Sample data inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  }
}

// Helper functions
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const getRows = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const getRow = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Export database instance and helper functions
module.exports = {
  database,
  run,
  getRows,
  getRow,
  query: getRows  // Alias for compatibility
};