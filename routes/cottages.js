const express = require('express');
const { query, getRow, run } = require('../config/database');
const router = express.Router();

// Get all cottages
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching cottages from database...');
    const cottages = await query(
      'SELECT * FROM cottages WHERE is_active = 1 ORDER BY price_per_night ASC'
    );
    
    console.log('✅ Found cottages:', cottages.length);
    
    // Format cottages for frontend compatibility
    const formattedCottages = cottages.map(cottage => ({
      id: cottage.id,
      name: cottage.name,
      type: cottage.type,
      description: cottage.description,
      capacity: cottage.capacity,
      price_per_night: cottage.price_per_night,
      base_price: cottage.price_per_night, // Alias for compatibility
      amenities: cottage.amenities || 'AC, WiFi, Kitchen, Private Bathroom',
      images: cottage.images ? JSON.parse(cottage.images) : [],
      is_active: cottage.is_active,
      total_bookings: 0 // Will be calculated in a real scenario
    }));
    
    // If no cottages found, return sample data structure
    if (formattedCottages.length === 0) {
      console.log('⚠️ No cottages found in database, returning sample structure');
      return res.json({
        success: true,
        data: [
          {
            id: 1,
            name: 'Glass Cottage',
            type: 'glass-cottage',
            description: 'Luxurious glass-walled cottage with panoramic views',
            capacity: 4,
            price_per_night: 15000,
            base_price: 15000,
            amenities: 'AC, WiFi, Kitchen, Private Bathroom, Mountain View',
            images: ['/images/villas/glass-cottage.png'],
            is_active: 1,
            total_bookings: 0
          }
        ]
      });
    }
    
    res.json({
      success: true,
      data: formattedCottages
    });
  } catch (error) {
    console.error('❌ Error fetching cottages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cottages',
      details: error.message
    });
  }
});

// Get cottage by type or ID
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find by type first, then by ID
    let cottage = await getRow(
      'SELECT * FROM cottages WHERE type = ? AND is_active = 1',
      [identifier]
    );
    
    if (!cottage) {
      cottage = await getRow(
        'SELECT * FROM cottages WHERE id = ? AND is_active = 1',
        [identifier]
      );
    }
    
    if (!cottage) {
      return res.status(404).json({
        success: false,
        error: 'Cottage not found'
      });
    }
    
    // Parse JSON fields
    cottage.amenities = cottage.amenities ? JSON.parse(cottage.amenities) : [];
    cottage.images = cottage.images ? JSON.parse(cottage.images) : [];
    
    res.json({
      success: true,
      data: cottage
    });
  } catch (error) {
    console.error('Error fetching cottage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cottage'
    });
  }
});

// Check cottage availability by type
router.post('/:cottageType/availability', async (req, res) => {
  try {
    const { checkIn, checkOut, guests, rooms = 1 } = req.body;
    const cottageType = req.params.cottageType;
    
    // Validate input
    if (!checkIn || !checkOut || !guests) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: checkIn, checkOut, guests'
      });
    }

    // Calculate nights
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range'
      });
    }

    // Get cottage by type
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
    
    if (guests > cottage.max_guests) {
      return res.status(400).json({
        success: false,
        error: `This cottage can only accommodate ${cottage.max_guests} guests`
      });
    }
    
    // Check for existing bookings
    const existingBookings = await query(
      `SELECT * FROM bookings 
       WHERE cottage_id = ? 
       AND status IN ('confirmed', 'pending')
       AND (
         (check_in_date <= ? AND check_out_date > ?) OR
         (check_in_date < ? AND check_out_date >= ?) OR
         (check_in_date >= ? AND check_out_date <= ?)
       )`,
      [cottage.id, checkIn, checkIn, checkOut, checkOut, checkIn, checkOut]
    );
    
    const isAvailable = existingBookings.length === 0;
    
    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: 'Cottage is not available for the selected dates',
        data: {
          available: false,
          conflictingBookings: existingBookings.length
        }
      });
    }
    
    // Calculate price
    let baseTotal = cottage.base_price * nights;
    
    // Apply guest multiplier (20% extra per additional guest after 2)
    let guestMultiplier = 1;
    let extraGuestCost = 0;
    if (guests > 2) {
      const extraGuests = guests - 2;
      extraGuestCost = extraGuests * (cottage.base_price * 0.2 * nights);
      guestMultiplier = 1 + (extraGuests * 0.2);
    }
    
    const totalPrice = baseTotal + extraGuestCost;
    
    // Emit real-time update to admin dashboard
    if (req.io) {
      req.io.to('admin-room').emit('availability-check', {
        cottageType,
        checkIn,
        checkOut,
        guests,
        available: isAvailable,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Cottage is available for your selected dates',
      data: {
        available: true,
        cottage: {
          id: cottage.id,
          name: cottage.name,
          type: cottageType,
          basePrice: cottage.base_price,
          maxGuests: cottage.max_guests,
          amenities: cottage.amenities ? JSON.parse(cottage.amenities) : []
        },
        dates: {
          checkIn,
          checkOut,
          nights
        },
        guests,
        totalPrice: Math.round(totalPrice),
        priceBreakdown: {
          basePrice: cottage.base_price,
          nights,
          baseTotal: baseTotal,
          guestMultiplier: guestMultiplier,
          extraGuestCost: Math.round(extraGuestCost),
          finalTotal: Math.round(totalPrice)
        },
        villaAvailable: true // For frontend compatibility
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability. Please try again later.',
      data: {
        // Fallback data for frontend
        available: true,
        cottage: {
          id: 'temp',
          name: 'Villa (Offline Mode)',
          type: req.params.cottageType,
          basePrice: 15000,
          maxGuests: 6
        },
        totalPrice: 15000,
        isOfflineMode: true,
        villaAvailable: true
      }
    });
  }
});

// Get cottage availability calendar
router.get('/:cottageType/calendar', async (req, res) => {
  try {
    const { cottageType } = req.params;
    const { month, year } = req.query;
    
    const cottage = await getRow(
      'SELECT id FROM cottages WHERE type = ? AND is_active = 1',
      [cottageType]
    );
    
    if (!cottage) {
      return res.status(404).json({
        success: false,
        error: 'Cottage not found'
      });
    }
    
    // Get bookings for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const bookings = await query(
      `SELECT check_in_date, check_out_date, status 
       FROM bookings 
       WHERE cottage_id = ? 
       AND status IN ('confirmed', 'pending')
       AND (check_in_date <= ? AND check_out_date >= ?)`,
      [cottage.id, endDate, startDate]
    );
    
    res.json({
      success: true,
      data: {
        cottageId: cottage.id,
        month: parseInt(month),
        year: parseInt(year),
        bookings
      }
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar data'
    });
  }
});

// Admin: Update cottage pricing
router.patch('/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const { base_price } = req.body;
    
    if (!base_price || base_price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid base price is required'
      });
    }
    
    const result = await run(
      'UPDATE cottages SET base_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [base_price, id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cottage not found'
      });
    }
    
    // Get updated cottage
    const updatedCottage = await getRow(
      'SELECT * FROM cottages WHERE id = ?',
      [id]
    );
    
    // Emit real-time update to admin dashboard and customers
    if (req.io) {
      req.io.emit('cottage-price-updated', {
        cottageId: id,
        newPrice: base_price,
        cottage: updatedCottage,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Cottage pricing updated successfully',
      data: updatedCottage
    });
  } catch (error) {
    console.error('Error updating cottage pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cottage pricing'
    });
  }
});

// Admin: Create new cottage
router.post('/admin/create', async (req, res) => {
  try {
    const { name, type, description, base_price, max_guests, amenities } = req.body;
    
    // Convert amenities to JSON string if it's an array
    const amenitiesJson = Array.isArray(amenities) ? JSON.stringify(amenities) : (amenities || JSON.stringify([]));
    const cottageType = type || name.toLowerCase().replace(/\s+/g, '-');
    
    const result = await run(`
      INSERT INTO cottages (name, type, description, base_price, max_guests, amenities, images, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [name, cottageType, description, base_price || 15000, max_guests || 4, amenitiesJson, JSON.stringify([]), 1]);

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

// Admin: Update cottage
router.put('/admin/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, base_price, max_guests, amenities, status } = req.body;
    
    // Convert amenities to JSON string if it's an array
    const amenitiesJson = Array.isArray(amenities) ? JSON.stringify(amenities) : amenities;
    
    const result = await run(`
      UPDATE cottages 
      SET name = ?, type = ?, description = ?, base_price = ?, max_guests = ?, 
          amenities = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, type, description, base_price, max_guests, amenitiesJson, status === 'active' ? 1 : 0, id]);

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

// Admin: Delete cottage
router.delete('/admin/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await run('UPDATE cottages SET is_active = 0 WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Cottage not found' 
      });
    }

    res.json({
      success: true,
      message: 'Cottage deleted successfully'
    });
  } catch (error) {
    console.error('Delete cottage error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete cottage' 
    });
  }
});

module.exports = router;