const express = require('express');
const { query, getRow, run } = require('../config/database');
const router = express.Router();

// Get all active packages
router.get('/', async (req, res) => {
  try {
    const packages = await query(
      'SELECT * FROM packages WHERE is_active = 1 ORDER BY price_multiplier ASC'
    );

    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch packages'
    });
  }
});

// Get package by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const package = await getRow(
      'SELECT * FROM packages WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!package) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    res.json({
      success: true,
      data: package
    });
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch package'
    });
  }
});

// Calculate package pricing
router.post('/calculate-pricing', async (req, res) => {
  try {
    const { packageId, cottageType, nights, guests } = req.body;

    if (!packageId || !cottageType || !nights || !guests) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: packageId, cottageType, nights, guests'
      });
    }

    // Get package details
    const package = await getRow(
      'SELECT * FROM packages WHERE id = ? AND is_active = 1',
      [packageId]
    );

    if (!package) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Get cottage details
    const cottage = await getRow(
      'SELECT * FROM cottages WHERE type = ? AND is_active = 1',
      [cottageType]
    );

    if (!cottage) {
      return res.status(404).json({
        success: false,
        error: 'Cottage not found'
      });
    }

    // Calculate base villa cost
    let villaTotal = cottage.base_price * nights;

    // Apply guest multiplier for villa (20% extra per guest after 2)
    if (guests > 2) {
      const extraGuests = guests - 2;
      villaTotal += extraGuests * (cottage.base_price * 0.2 * nights);
    }

    // Apply package multiplier
    const packageTotal = villaTotal * package.price_multiplier;
    const packageDiscount = packageTotal - villaTotal;

    // Calculate safari costs if included
    let safariTotal = 0;
    let includedSafaris = [];
    
    if (package.includes_safari && package.max_safaris > 0) {
      // Get available safari types
      const safariTypes = await query(
        'SELECT * FROM safari_types WHERE is_active = 1 ORDER BY price ASC'
      );

      // Include basic safaris based on package
      const basicSafariCount = Math.min(package.max_safaris, 2);
      for (let i = 0; i < basicSafariCount && i < safariTypes.length; i++) {
        includedSafaris.push({
          id: safariTypes[i].id,
          name: safariTypes[i].name,
          price: 0, // Included in package
          participants: guests
        });
      }
    }

    // Calculate totals
    const subtotal = packageTotal + safariTotal;
    const gst = subtotal * 0.18; // 18% GST
    const serviceFee = subtotal * 0.05; // 5% service fee
    const grandTotal = subtotal + gst + serviceFee;

    res.json({
      success: true,
      data: {
        package: {
          id: package.id,
          name: package.name,
          type: package.type,
          description: package.description,
          multiplier: package.price_multiplier
        },
        cottage: {
          id: cottage.id,
          name: cottage.name,
          type: cottage.type,
          basePrice: cottage.base_price
        },
        pricing: {
          villaBasePrice: cottage.base_price,
          nights,
          guests,
          villaSubtotal: villaTotal,
          packageMultiplier: package.price_multiplier,
          packageTotal: packageTotal,
          packageDiscount: packageDiscount > 0 ? packageDiscount : 0,
          safariTotal: safariTotal,
          subtotal: subtotal,
          gst: gst,
          serviceFee: serviceFee,
          grandTotal: grandTotal
        },
        includedSafaris,
        breakdown: {
          villa: Math.round(villaTotal),
          package: Math.round(packageTotal - villaTotal),
          safaris: Math.round(safariTotal),
          taxes: Math.round(gst + serviceFee),
          total: Math.round(grandTotal)
        }
      }
    });

  } catch (error) {
    console.error('Error calculating package pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate package pricing'
    });
  }
});

// Admin: Get all packages with statistics
router.get('/admin/all', async (req, res) => {
  try {
    const packages = await query(`
      SELECT p.*, 
             COUNT(b.id) as total_bookings,
             COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
             AVG(CASE WHEN b.status = 'confirmed' THEN b.total_amount END) as avg_booking_value
      FROM packages p
      LEFT JOIN bookings b ON p.id = b.package_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    console.error('Error fetching admin packages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch packages'
    });
  }
});

// Admin: Create new package
router.post('/admin', async (req, res) => {
  try {
    const { 
      name, 
      type, 
      description, 
      price_multiplier, 
      includes_safari = 0, 
      max_safaris = 0 
    } = req.body;

    if (!name || !type || !price_multiplier) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and price multiplier are required'
      });
    }

    if (price_multiplier <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Price multiplier must be greater than 0'
      });
    }

    const result = await run(
      `INSERT INTO packages (name, type, description, price_multiplier, includes_safari, max_safaris)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, type, description, price_multiplier, includes_safari, max_safaris]
    );

    const newPackage = await getRow(
      'SELECT * FROM packages WHERE id = ?',
      [result.id]
    );

    // Emit real-time update to admin dashboard
    if (req.io) {
      req.io.to('admin-room').emit('package-created', {
        package: newPackage,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: newPackage
    });

  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create package'
    });
  }
});

// Admin: Update package
router.put('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      type, 
      description, 
      price_multiplier, 
      includes_safari, 
      max_safaris,
      is_active 
    } = req.body;

    if (!name || !type || !price_multiplier) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and price multiplier are required'
      });
    }

    if (price_multiplier <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Price multiplier must be greater than 0'
      });
    }

    const result = await run(
      `UPDATE packages 
       SET name = ?, type = ?, description = ?, price_multiplier = ?, 
           includes_safari = ?, max_safaris = ?, is_active = ?, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, type, description, price_multiplier, includes_safari, max_safaris, is_active, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    const updatedPackage = await getRow(
      'SELECT * FROM packages WHERE id = ?',
      [id]
    );

    // Emit real-time update
    if (req.io) {
      req.io.emit('package-updated', {
        package: updatedPackage,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Package updated successfully',
      data: updatedPackage
    });

  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update package'
    });
  }
});

// Admin: Delete package
router.delete('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if package has any bookings
    const bookingsCount = await getRow(
      'SELECT COUNT(*) as count FROM bookings WHERE package_id = ?',
      [id]
    );

    if (bookingsCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete package with existing bookings. Deactivate it instead.'
      });
    }

    const result = await run(
      'DELETE FROM packages WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Emit real-time update
    if (req.io) {
      req.io.to('admin-room').emit('package-deleted', {
        packageId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete package'
    });
  }
});

// Get package popularity statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        p.name,
        p.type,
        COUNT(b.id) as total_bookings,
        COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_bookings,
        SUM(CASE WHEN b.status = 'confirmed' THEN b.total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN b.status = 'confirmed' THEN b.total_amount ELSE 0 END) as avg_booking_value
      FROM packages p
      LEFT JOIN bookings b ON p.id = b.package_id
      WHERE p.is_active = 1
      GROUP BY p.id, p.name, p.type
      ORDER BY confirmed_bookings DESC
    `);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching package stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch package statistics'
    });
  }
});

module.exports = router;