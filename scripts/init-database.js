const database = require('../config/database');

async function initializeDatabase() {
  console.log('🚀 Initializing Village Machaan Database...');
  
  try {
    // Create tables
    await database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        is_active INTEGER DEFAULT 1,
        date_of_birth DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS cottages (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        base_price REAL NOT NULL,
        max_guests INTEGER NOT NULL,
        amenities TEXT,
        images TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await database.run(`
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

    await database.run(`
      CREATE TABLE IF NOT EXISTS safari_types (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        duration TEXT NOT NULL,
        max_guests INTEGER NOT NULL,
        includes TEXT,
        highlights TEXT,
        time_slots TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        booking_reference TEXT UNIQUE NOT NULL,
        user_id TEXT,
        cottage_id TEXT NOT NULL,
        package_id TEXT,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        adults INTEGER NOT NULL,
        children INTEGER DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'pending',
        payment_method TEXT,
        special_requests TEXT,
        guest_details TEXT,
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS safari_bookings (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        booking_id TEXT NOT NULL,
        safari_type_id TEXT NOT NULL,
        participants INTEGER NOT NULL,
        date DATE NOT NULL,
        time_slot TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await database.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
        booking_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        payment_method TEXT NOT NULL,
        razorpay_payment_id TEXT,
        razorpay_order_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert sample data
    await insertSampleData();
    
    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function insertSampleData() {
  // Insert cottages
  const cottages = [
    ['Hornbill Cottage', 'hornbill', 'Cozy cottage with garden view', 150.00, 2, '["WiFi", "AC", "Garden", "Kitchen"]', '["hornbill1.jpg"]'],
    ['Kingfisher Suite', 'kingfisher', 'Luxury suite with river view', 250.00, 4, '["WiFi", "AC", "River View", "Balcony"]', '["kingfisher1.jpg"]'],
    ['Glass Cottage', 'glass', 'Modern glass house with panoramic views', 350.00, 6, '["WiFi", "AC", "Panoramic View", "Glass Walls"]', '["glass1.jpg"]']
  ];

  for (const cottage of cottages) {
    try {
      await database.run(`
        INSERT OR IGNORE INTO cottages (name, type, description, base_price, max_guests, amenities, images)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, cottage);
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting cottage:', err);
      }
    }
  }

  // Insert packages
  const packages = [
    ['Honeymoon Package', 'Romantic getaway with special amenities', 1.30, 0, 0],
    ['Elderly Package', 'Comfortable stay with accessibility features', 1.10, 0, 0],
    ['Family Fun Package', 'Family-friendly activities and amenities', 1.20, 0, 0],
    ['Safari Adventure Package', 'Wildlife experience with guided safaris', 1.50, 1, 3]
  ];

  for (const pkg of packages) {
    try {
      await database.run(`
        INSERT OR IGNORE INTO packages (name, description, price_multiplier, includes_safari, max_safaris)
        VALUES (?, ?, ?, ?, ?)
      `, pkg);
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting package:', err);
      }
    }
  }

  // Insert safari types
  const safariTypes = [
    ['Morning Safari', 'Explore wildlife during the golden hours', 500, '3 hours', 6, '["Professional Guide", "Binoculars"]', '["Bird watching", "Wildlife photography"]', '["06:00", "07:00"]'],
    ['Evening Safari', 'Experience the jungle at dusk', 500, '3 hours', 6, '["Professional Guide", "Binoculars"]', '["Sunset views", "Wildlife spotting"]', '["16:00", "17:00"]'],
    ['Full Day Safari', 'Complete wilderness experience', 1200, '8 hours', 4, '["Guide", "Meals", "Transport"]', '["Multiple locations", "Packed lunch"]', '["08:00"]'],
    ['Night Safari', 'Discover nocturnal wildlife', 800, '4 hours', 4, '["Night vision equipment", "Guide"]', '["Nocturnal animals", "Unique experience"]', '["19:00", "20:00"]']
  ];

  for (const safari of safariTypes) {
    try {
      await database.run(`
        INSERT OR IGNORE INTO safari_types (name, description, price, duration, max_guests, includes, highlights, time_slots)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, safari);
    } catch (err) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        console.error('Error inserting safari type:', err);
      }
    }
  }

  console.log('✅ Sample data inserted');
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database ready for use!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
