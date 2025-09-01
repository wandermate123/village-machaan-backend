const express = require('express');
const { query, getRow, run } = require('../config/database');
const router = express.Router();

// Get all active safari types
router.get('/', async (req, res) => {
  try {
    const safariTypes = await query(
      'SELECT * FROM safari_types WHERE is_active = 1 ORDER BY price ASC'
    );

    // Parse JSON fields
    const formattedSafaris = safariTypes.map(safari => ({
      ...safari,
      includes: safari.includes ? JSON.parse(safari.includes) : [],
      highlights: safari.highlights ? JSON.parse(safari.highlights) : [],
      time_slots: safari.time_slots ? JSON.parse(safari.time_slots) : []
    }));

    res.json({
      success: true,
      data: formattedSafaris
    });
  } catch (error) {
    console.error('Error fetching safari types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch safari types'
    });
  }
});

// Get safari type by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const safari = await getRow(
      'SELECT * FROM safari_types WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!safari) {
      return res.status(404).json({
        success: false,
        error: 'Safari type not found'
      });
    }

    // Parse JSON fields
    safari.includes = safari.includes ? JSON.parse(safari.includes) : [];
    safari.highlights = safari.highlights ? JSON.parse(safari.highlights) : [];
    safari.time_slots = safari.time_slots ? JSON.parse(safari.time_slots) : [];

    res.json({
      success: true,
      data: safari
    });
  } catch (error) {
    console.error('Error fetching safari type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch safari type'
    });
  }
});

// Get available dates for a safari type
router.get('/:id/available-dates', async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    // Get safari type
    const safari = await getRow(
      'SELECT * FROM safari_types WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!safari) {
      return res.status(404).json({
        success: false,
        error: 'Safari type not found'
      });
    }

    // Calculate date range for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;

    // Get existing bookings for this safari in the date range
    const existingBookings = await query(
      `SELECT date, time_slot, COUNT(*) as bookings
       FROM safari_bookings
       WHERE safari_type_id = ? AND date BETWEEN ? AND ?
       GROUP BY date, time_slot`,
      [id, startDate, endDate]
    );

    // Generate available dates (for simplicity, assume all future dates are available)
    const today = new Date();
    const availableDates = [];

    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month - 1, day);
      if (date < today || date.getMonth() !== month - 1) continue;

      const dateStr = date.toISOString().split('T')[0];
      const timeSlots = safari.time_slots ? JSON.parse(safari.time_slots) : [];

      const availableSlots = timeSlots.map(slot => {
        const existingBooking = existingBookings.find(
          booking => booking.date === dateStr && booking.time_slot === slot
        );
        const currentBookings = existingBooking ? existingBooking.bookings : 0;
        
        return {
          time: slot,
          available: currentBookings < safari.max_guests,
          capacity: safari.max_guests,
          booked: currentBookings
        };
      });

      if (availableSlots.some(slot => slot.available)) {
        availableDates.push({
          date: dateStr,
          timeSlots: availableSlots
        });
      }
    }

    res.json({
      success: true,
      data: {
        safariId: id,
        month: parseInt(month),
        year: parseInt(year),
        availableDates
      }
    });

  } catch (error) {
    console.error('Error fetching available dates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available dates'
    });
  }
});

// Get available time slots for a specific date and safari
router.get('/:id/slots/:date', async (req, res) => {
  try {
    const { id, date } = req.params;

    // Get safari type
    const safari = await getRow(
      'SELECT * FROM safari_types WHERE id = ? AND is_active = 1',
      [id]
    );

    if (!safari) {
      return res.status(404).json({
        success: false,
        error: 'Safari type not found'
      });
    }

    // Check if date is in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book safari for past dates'
      });
    }

    // Get existing bookings for this date
    const existingBookings = await query(
      `SELECT time_slot, SUM(participants) as total_participants
       FROM safari_bookings
       WHERE safari_type_id = ? AND date = ?
       GROUP BY time_slot`,
      [id, date]
    );

    // Get available time slots
    const timeSlots = safari.time_slots ? JSON.parse(safari.time_slots) : [];
    const availableSlots = timeSlots.map(slot => {
      const existingBooking = existingBookings.find(
        booking => booking.time_slot === slot
      );
      const bookedParticipants = existingBooking ? existingBooking.total_participants : 0;
      const availableSpots = safari.max_guests - bookedParticipants;

      return {
        time: slot,
        available: availableSpots > 0,
        capacity: safari.max_guests,
        booked: bookedParticipants,
        availableSpots
      };
    });

    res.json({
      success: true,
      data: {
        safariId: id,
        date,
        timeSlots: availableSlots
      }
    });

  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time slots'
    });
  }
});

// Validate safari selection
router.post('/validate-selection', async (req, res) => {
  try {
    const { selectedSafaris } = req.body;

    if (!selectedSafaris || !Array.isArray(selectedSafaris)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid safari selection'
      });
    }

    const validationResults = [];
    let totalPrice = 0;

    for (const safari of selectedSafaris) {
      const { safariId, date, timeSlot, participants } = safari;

      // Get safari type
      const safariType = await getRow(
        'SELECT * FROM safari_types WHERE id = ? AND is_active = 1',
        [safariId]
      );

      if (!safariType) {
        validationResults.push({
          safariId,
          valid: false,
          error: 'Safari type not found'
        });
        continue;
      }

      // Check capacity
      const existingBookings = await getRow(
        `SELECT SUM(participants) as total_participants
         FROM safari_bookings
         WHERE safari_type_id = ? AND date = ? AND time_slot = ?`,
        [safariId, date, timeSlot]
      );

      const bookedParticipants = existingBookings.total_participants || 0;
      const availableSpots = safariType.max_guests - bookedParticipants;

      if (participants > availableSpots) {
        validationResults.push({
          safariId,
          valid: false,
          error: `Only ${availableSpots} spots available for this time slot`
        });
        continue;
      }

      // Calculate price
      const safariPrice = safariType.price * participants;
      totalPrice += safariPrice;

      validationResults.push({
        safariId,
        valid: true,
        safari: {
          name: safariType.name,
          price: safariType.price,
          participants,
          totalPrice: safariPrice
        }
      });
    }

    const allValid = validationResults.every(result => result.valid);

    res.json({
      success: allValid,
      data: {
        validationResults,
        totalPrice,
        allValid,
        message: allValid ? 'All safari selections are valid' : 'Some safari selections have issues'
      }
    });

  } catch (error) {
    console.error('Error validating safari selection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate safari selection'
    });
  }
});

// Admin: Get all safari types with statistics
router.get('/admin/all', async (req, res) => {
  try {
    const safaris = await query(`
      SELECT st.*, 
             COUNT(sb.id) as total_bookings,
             SUM(sb.participants) as total_participants,
             SUM(st.price * sb.participants) as total_revenue
      FROM safari_types st
      LEFT JOIN safari_bookings sb ON st.id = sb.safari_type_id
      GROUP BY st.id
      ORDER BY st.created_at DESC
    `);

    // Parse JSON fields
    const formattedSafaris = safaris.map(safari => ({
      ...safari,
      includes: safari.includes ? JSON.parse(safari.includes) : [],
      highlights: safari.highlights ? JSON.parse(safari.highlights) : [],
      time_slots: safari.time_slots ? JSON.parse(safari.time_slots) : []
    }));

    res.json({
      success: true,
      data: formattedSafaris
    });
  } catch (error) {
    console.error('Error fetching admin safaris:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch safari types'
    });
  }
});

// Admin: Create new safari type
router.post('/admin', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      duration, 
      max_guests, 
      includes = [], 
      highlights = [], 
      time_slots = [] 
    } = req.body;

    if (!name || !price || !duration || !max_guests) {
      return res.status(400).json({
        success: false,
        error: 'Name, price, duration, and max guests are required'
      });
    }

    if (price <= 0 || max_guests <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Price and max guests must be greater than 0'
      });
    }

    const result = await run(
      `INSERT INTO safari_types (name, description, price, duration, max_guests, includes, highlights, time_slots)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        description, 
        price, 
        duration, 
        max_guests, 
        JSON.stringify(includes),
        JSON.stringify(highlights),
        JSON.stringify(time_slots)
      ]
    );

    const newSafari = await getRow(
      'SELECT * FROM safari_types WHERE id = ?',
      [result.id]
    );

    // Parse JSON fields for response
    newSafari.includes = JSON.parse(newSafari.includes);
    newSafari.highlights = JSON.parse(newSafari.highlights);
    newSafari.time_slots = JSON.parse(newSafari.time_slots);

    // Emit real-time update
    if (req.io) {
      req.io.to('admin-room').emit('safari-created', {
        safari: newSafari,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Safari type created successfully',
      data: newSafari
    });

  } catch (error) {
    console.error('Error creating safari type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create safari type'
    });
  }
});

// Admin: Update safari type
router.put('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      price, 
      duration, 
      max_guests, 
      includes, 
      highlights, 
      time_slots,
      is_active 
    } = req.body;

    if (!name || !price || !duration || !max_guests) {
      return res.status(400).json({
        success: false,
        error: 'Name, price, duration, and max guests are required'
      });
    }

    const result = await run(
      `UPDATE safari_types 
       SET name = ?, description = ?, price = ?, duration = ?, max_guests = ?, 
           includes = ?, highlights = ?, time_slots = ?, is_active = ?, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name, 
        description, 
        price, 
        duration, 
        max_guests, 
        JSON.stringify(includes || []),
        JSON.stringify(highlights || []),
        JSON.stringify(time_slots || []),
        is_active,
        id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Safari type not found'
      });
    }

    const updatedSafari = await getRow(
      'SELECT * FROM safari_types WHERE id = ?',
      [id]
    );

    // Parse JSON fields
    updatedSafari.includes = JSON.parse(updatedSafari.includes);
    updatedSafari.highlights = JSON.parse(updatedSafari.highlights);
    updatedSafari.time_slots = JSON.parse(updatedSafari.time_slots);

    // Emit real-time update
    if (req.io) {
      req.io.emit('safari-updated', {
        safari: updatedSafari,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Safari type updated successfully',
      data: updatedSafari
    });

  } catch (error) {
    console.error('Error updating safari type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update safari type'
    });
  }
});

// Get safari booking statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        st.name,
        COUNT(sb.id) as total_bookings,
        SUM(sb.participants) as total_participants,
        SUM(st.price * sb.participants) as total_revenue,
        AVG(sb.participants) as avg_participants_per_booking
      FROM safari_types st
      LEFT JOIN safari_bookings sb ON st.id = sb.safari_type_id
      WHERE st.is_active = 1
      GROUP BY st.id, st.name
      ORDER BY total_revenue DESC
    `);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching safari stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch safari statistics'
    });
  }
});

module.exports = router;