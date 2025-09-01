const express = require('express');
const { query, getRow, run } = require('../config/database');
const { adminAuth, requireSuperAdmin } = require('../middleware/adminAuth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply admin authentication to all routes
router.use(adminAuth);

// ==================== DASHBOARD & ANALYTICS ====================

// Get dashboard overview statistics
router.get('/dashboard', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Get total bookings
    const bookingsResult = await client.query(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        SUM(CASE WHEN status = 'confirmed' THEN total_amount ELSE 0 END) as total_revenue
      FROM bookings
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Get recent bookings
    const recentBookingsResult = await client.query(`
      SELECT b.*, u.name as customer_name, u.email as customer_email
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    // Get cottage occupancy
    const cottageOccupancyResult = await client.query(`
      SELECT 
        c.name as cottage_name,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings
      FROM cottages c
      LEFT JOIN bookings b ON c.id = b.cottage_id
      WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days' OR b.id IS NULL
      GROUP BY c.id, c.name
    `);

    // Get monthly revenue
    const monthlyRevenueResult = await client.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(total_amount) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE status = 'confirmed' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);

    client.release();

    res.json({
      overview: {
        totalBookings: parseInt(bookingsResult.rows[0]?.total_bookings || 0),
        confirmedBookings: parseInt(bookingsResult.rows[0]?.confirmed_bookings || 0),
        pendingBookings: parseInt(bookingsResult.rows[0]?.pending_bookings || 0),
        cancelledBookings: parseInt(bookingsResult.rows[0]?.cancelled_bookings || 0),
        totalRevenue: parseFloat(bookingsResult.rows[0]?.total_revenue || 0)
      },
      recentBookings: recentBookingsResult.rows,
      cottageOccupancy: cottageOccupancyResult.rows,
      monthlyRevenue: monthlyRevenueResult.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== COTTAGE MANAGEMENT ====================

// Get all cottages with admin details
router.get('/cottages', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        c.*,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings
      FROM cottages c
      LEFT JOIN bookings b ON c.id = b.cottage_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get cottages error:', error);
    res.status(500).json({ error: 'Failed to fetch cottages' });
  }
});

// Create new cottage
router.post('/cottages', upload.single('image'), async (req, res) => {
  try {
    const { name, type, description, base_price, max_guests, amenities, status } = req.body;
    const image_url = req.file ? `/images/${req.file.filename}` : null;
    
    // Convert amenities to JSON string if it's an array
    const amenitiesJson = Array.isArray(amenities) ? JSON.stringify(amenities) : amenities;
    const imagesJson = image_url ? JSON.stringify([image_url]) : JSON.stringify([]);
    
    const result = await run(`
      INSERT INTO cottages (name, type, description, base_price, max_guests, amenities, images, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, type || name.toLowerCase().replace(/\s+/g, '-'), description, base_price, max_guests, amenitiesJson, imagesJson, status === 'active' ? 1 : 0]);

    const newCottage = await getRow('SELECT * FROM cottages WHERE id = ?', [result.id]);

    res.status(201).json({
      success: true,
      message: 'Cottage created successfully',
      data: newCottage
    });
  } catch (error) {
    console.error('Create cottage error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create cottage' 
    });
  }
});

// Update cottage
router.put('/cottages/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, base_price, max_guests, amenities, status } = req.body;
    
    let image_url = null;
    if (req.file) {
      image_url = `/images/${req.file.filename}`;
    }

    // Convert amenities to JSON string if it's an array
    const amenitiesJson = Array.isArray(amenities) ? JSON.stringify(amenities) : amenities;
    
    // Build update query
    const updateFields = [];
    const values = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      values.push(name);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      values.push(type);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      values.push(description);
    }
    if (base_price !== undefined) {
      updateFields.push('base_price = ?');
      values.push(base_price);
    }
    if (max_guests !== undefined) {
      updateFields.push('max_guests = ?');
      values.push(max_guests);
    }
    if (amenities !== undefined) {
      updateFields.push('amenities = ?');
      values.push(amenitiesJson);
    }
    if (status !== undefined) {
      updateFields.push('is_active = ?');
      values.push(status === 'active' ? 1 : 0);
    }
    if (image_url) {
      updateFields.push('images = ?');
      values.push(JSON.stringify([image_url]));
    }

    // Add updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await run(`
      UPDATE cottages 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Cottage not found' 
      });
    }

    const updatedCottage = await getRow('SELECT * FROM cottages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cottage updated successfully',
      data: updatedCottage
    });
  } catch (error) {
    console.error('Update cottage error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update cottage' 
    });
  }
});

// Delete cottage
router.delete('/cottages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if cottage has any bookings
    const bookingsCheck = await query(
      'SELECT COUNT(*) FROM bookings WHERE cottage_id = $1',
      [id]
    );

    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete cottage with existing bookings' 
      });
    }

    const result = await query(
      'DELETE FROM cottages WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cottage not found' });
    }

    res.json({ message: 'Cottage deleted successfully' });
  } catch (error) {
    console.error('Delete cottage error:', error);
    res.status(500).json({ error: 'Failed to delete cottage' });
  }
});

// ==================== PACKAGE MANAGEMENT ====================

// Get all packages
router.get('/packages', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        COUNT(b.id) as total_bookings
      FROM packages p
      LEFT JOIN bookings b ON p.id = b.package_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// Create new package
router.post('/packages', async (req, res) => {
  try {
    const { name, description, price, duration, inclusions, exclusions, status } = req.body;

    const result = await query(`
      INSERT INTO packages (name, description, price, duration, inclusions, exclusions, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, price, duration, inclusions, exclusions, status]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// Update package
router.put('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, inclusions, exclusions, status } = req.body;

    const result = await query(`
      UPDATE packages 
      SET name = $1, description = $2, price = $3, duration = $4, 
          inclusions = $5, exclusions = $6, status = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, description, price, duration, inclusions, exclusions, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// Delete package
router.delete('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if package has any bookings
    const bookingsCheck = await query(
      'SELECT COUNT(*) FROM bookings WHERE package_id = $1',
      [id]
    );

    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete package with existing bookings' 
      });
    }

    const result = await query(
      'DELETE FROM packages WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

// ==================== SAFARI MANAGEMENT ====================

// Get all safaris
router.get('/safaris', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.*,
        COUNT(e.id) as total_enquiries
      FROM safaris s
      LEFT JOIN safari_enquiries e ON s.id = e.safari_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get safaris error:', error);
    res.status(500).json({ error: 'Failed to fetch safaris' });
  }
});

// Create new safari
router.post('/safaris', async (req, res) => {
  try {
    const { name, description, price, duration, max_participants, status } = req.body;

    const result = await query(`
      INSERT INTO safaris (name, description, price, duration, max_participants, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, price, duration, max_participants, status]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create safari error:', error);
    res.status(500).json({ error: 'Failed to create safari' });
  }
});

// Update safari
router.put('/safaris/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, max_participants, status } = req.body;

    const result = await query(`
      UPDATE safaris 
      SET name = $1, description = $2, price = $3, duration = $4, 
          max_participants = $5, status = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, description, price, duration, max_participants, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Safari not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update safari error:', error);
    res.status(500).json({ error: 'Failed to update safari' });
  }
});

// Delete safari
router.delete('/safaris/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if safari has any enquiries
    const enquiriesCheck = await query(
      'SELECT COUNT(*) FROM safari_enquiries WHERE safari_id = $1',
      [id]
    );

    if (parseInt(enquiriesCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete safari with existing enquiries' 
      });
    }

    const result = await query(
      'DELETE FROM safaris WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Safari not found' });
    }

    res.json({ message: 'Safari deleted successfully' });
  } catch (error) {
    console.error('Delete safari error:', error);
    res.status(500).json({ error: 'Failed to delete safari' });
  }
});

// ==================== BOOKING MANAGEMENT ====================

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const { status, date_from, date_to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (status) {
      whereClause += ` AND b.status = $${paramCount++}`;
      values.push(status);
    }
    if (date_from) {
      whereClause += ` AND b.check_in_date >= $${paramCount++}`;
      values.push(date_from);
    }
    if (date_to) {
      whereClause += ` AND b.check_in_date <= $${paramCount++}`;
      values.push(date_to);
    }

    values.push(limit, offset);

    const result = await query(`
      SELECT 
        b.*,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        c.name as cottage_name,
        p.name as package_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN cottages c ON b.cottage_id = c.id
      LEFT JOIN packages p ON b.package_id = p.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `, values);

    // Get total count for pagination
    const countResult = await query(`
      SELECT COUNT(*) FROM bookings b ${whereClause}
    `, values.slice(0, -2));

    res.json({
      bookings: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking status
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const result = await query(`
      UPDATE bookings 
      SET status = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, admin_notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users (admin only)
router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (role) {
      whereClause += ` AND role = $${paramCount++}`;
      values.push(role);
    }
    if (search) {
      whereClause += ` AND (name ILIKE $${paramCount++} OR email ILIKE $${paramCount++})`;
      values.push(`%${search}%`, `%${search}%`);
    }

    values.push(limit, offset);

    const result = await query(`
      SELECT 
        id, name, email, phone, role, is_active, created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `, values);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) FROM users ${whereClause}
    `, values.slice(0, -2));

    res.json({
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role/status (admin only)
router.patch('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    const result = await query(`
      UPDATE users 
      SET role = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, email, role, is_active, updated_at
    `, [role, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ==================== PRICING MANAGEMENT ====================

// Get pricing overview
router.get('/pricing', async (req, res) => {
  try {
    const [cottages, packages, safaris] = await Promise.all([
      query('SELECT id, name, price_per_night, status FROM cottages ORDER BY price_per_night'),
      query('SELECT id, name, price, status FROM packages ORDER BY price'),
      query('SELECT id, name, price, status FROM safaris ORDER BY price')
    ]);

    res.json({
      cottages: cottages.rows,
      packages: packages.rows,
      safaris: safaris.rows
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});

// Bulk update prices
router.post('/pricing/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const update of updates) {
        const { type, id, price } = update;
        
        switch (type) {
          case 'cottage':
            await client.query(
              'UPDATE cottages SET price_per_night = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [price, id]
            );
            break;
          case 'package':
            await client.query(
              'UPDATE packages SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [price, id]
            );
            break;
          case 'safari':
            await client.query(
              'UPDATE safaris SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [price, id]
            );
            break;
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Prices updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Bulk price update error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

// ==================== REPORTS & ANALYTICS ====================

// Get revenue report
router.get('/reports/revenue', async (req, res) => {
  try {
    const { period = 'monthly', start_date, end_date } = req.query;
    
    let dateFilter = '';
    const values = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      values.push(start_date, end_date);
    }

    let groupBy = '';
    switch (period) {
      case 'daily':
        groupBy = 'DATE(created_at)';
        break;
      case 'weekly':
        groupBy = 'DATE_TRUNC(\'week\', created_at)';
        break;
      case 'monthly':
        groupBy = 'DATE_TRUNC(\'month\', created_at)';
        break;
      case 'yearly':
        groupBy = 'DATE_TRUNC(\'year\', created_at)';
        break;
    }

    const result = await query(`
      SELECT 
        ${groupBy} as period,
        COUNT(*) as total_bookings,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_booking_value
      FROM bookings
      ${dateFilter}
      WHERE status = 'confirmed'
      GROUP BY ${groupBy}
      ORDER BY period DESC
    `, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
});

// Get occupancy report
router.get('/reports/occupancy', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const result = await query(`
      SELECT 
        c.name as cottage_name,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
        ROUND(
          (COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END)::DECIMAL / 
           GREATEST(COUNT(b.id), 1)) * 100, 2
        ) as occupancy_rate
      FROM cottages c
      LEFT JOIN bookings b ON c.id = b.cottage_id
      WHERE ($1::DATE IS NULL OR b.check_in_date >= $1)
        AND ($2::DATE IS NULL OR b.check_out_date <= $2)
      GROUP BY c.id, c.name
      ORDER BY occupancy_rate DESC
    `, [start_date || null, end_date || null]);

    res.json(result.rows);
  } catch (error) {
    console.error('Occupancy report error:', error);
    res.status(500).json({ error: 'Failed to generate occupancy report' });
  }
});

module.exports = router;



