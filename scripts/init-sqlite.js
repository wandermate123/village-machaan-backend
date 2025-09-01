const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting SQLite database initialization...');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Created data directory');
}

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('📁 Created logs directory');
}

const DB_PATH = path.join(dataDir, 'village_machaan.db');

// Remove existing database if it exists
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑️ Removed existing database');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error creating database:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});

async function initializeDatabase() {
  try {
    console.log('📊 Creating tables...');

    // Users table
    await runQuery(`
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

    // Cottages table
    await runQuery(`
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

    // Packages table
    await runQuery(`
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

    // Safari types table
    await runQuery(`
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

    // Bookings table
    await runQuery(`
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

    // Safari bookings table
    await runQuery(`
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

    // Payments table
    await runQuery(`
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
    await insertSampleData();
    
    console.log('🎉 Database initialization completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

async function insertSampleData() {
  console.log('📝 Inserting sample data...');

  try {
    // Sample cottages
    await runQuery(`
      INSERT INTO cottages (name, type, description, capacity, price_per_night, amenities, images)
      VALUES 
      ('Glass Cottage', 'glass-cottage', 'Luxurious glass-walled cottage with panoramic views', 4, 15000, 'AC, WiFi, Kitchen, Private Bathroom, Mountain View', '["glass-cottage.png"]'),
      ('Hornbill Villa', 'hornbill-villa', 'Spacious villa with modern amenities', 6, 18000, 'AC, WiFi, Kitchen, Private Bathroom, Garden, BBQ', '["hornbill-villa.png"]'),
      ('Kingfisher Villa', 'kingfisher-villa', 'Premium villa with river view', 8, 22000, 'AC, WiFi, Kitchen, Private Bathroom, River View, Pool', '["kingfisher-villa.png"]')
    `);

    // Sample packages
    await runQuery(`
      INSERT INTO packages (name, description, price_multiplier, includes_safari, max_safaris)
      VALUES 
      ('Honeymoon Package', 'Romantic getaway with special amenities', 1.3, 0, 0),
      ('Family Fun Package', 'Family-friendly activities and amenities', 1.2, 0, 0),
      ('Safari Adventure Package', 'Wildlife experience with guided safaris', 1.5, 1, 3),
      ('Elderly Package', 'Comfortable stay with accessibility features', 1.1, 0, 0)
    `);

    // Sample safari types
    await runQuery(`
      INSERT INTO safari_types (name, description, duration, price, max_guests, includes, highlights, time_slots)
      VALUES 
      ('Morning Safari', 'Early morning wildlife viewing', '3.5 hours', 800, 6, '["Professional Guide", "Safari Vehicle", "Refreshments"]', '["Best wildlife sighting", "Cool weather", "Bird watching"]', '["06:00", "06:30", "07:00"]'),
      ('Evening Safari', 'Sunset wildlife experience', '3 hours', 750, 6, '["Professional Guide", "Safari Vehicle", "Evening Tea"]', '["Sunset views", "Active wildlife", "Photography"]', '["15:30", "16:00", "16:30"]'),
      ('Night Safari', 'Nocturnal wildlife adventure', '2.5 hours', 900, 4, '["Professional Guide", "Safari Vehicle", "Flashlights"]', '["Nocturnal animals", "Unique experience", "Adventure"]', '["19:00", "19:30", "20:00"]')
    `);

    // Create default admin user
    await runQuery(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Admin', 'admin@villagemachaan.com', '$2a$10$2qKjq5QZ5QZ5QZ5QZ5QZ5O', 'admin')
    `);

    console.log('✅ Sample data inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  }
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

