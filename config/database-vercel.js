// Database configuration for Vercel deployment
// Uses memory database for development/demo, but you should use a cloud database for production

const sqlite3 = require('sqlite3').verbose();

let database;

// Initialize database based on environment
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // For Vercel deployment, use in-memory database (temporary)
  // In production, you should use a cloud database like PlanetScale, Supabase, or Neon
  console.log('🔄 Using in-memory database for Vercel deployment');
  database = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error('Error connecting to in-memory database:', err.message);
    } else {
      console.log('✅ Connected to in-memory SQLite database');
      initializeTables();
    }
  });
} else {
  // Local development - use file database
  const path = require('path');
  const DB_PATH = path.resolve(__dirname, '../data/village_machaan.db');
  database = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
    } else {
      console.log('✅ Connected to local SQLite database');
    }
  });
}

// Initialize tables for in-memory database
async function initializeTables() {
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
    console.log('✅ Database tables initialized with sample data');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
  }
}

// Insert sample data
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

module.exports = { database, run, getRows, getRow };
