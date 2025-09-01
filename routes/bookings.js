const express = require('express');
const { query, getRow, getRows, run } = require('../config/database');
const router = express.Router();

// Email sending function
const sendBookingEmails = async (bookingData) => {
  try {
    console.log('📧 Starting email sending process...');
    
    // EmailJS configuration
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
    const EMAILJS_USER_ID = process.env.EMAILJS_USER_ID;
    
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_USER_ID) {
      console.log('⚠️ EmailJS environment variables not configured, skipping email sending');
      return { success: false, error: 'EmailJS not configured' };
    }
    
    // Prepare email template data
    const emailTemplate = {
      to_email: bookingData.guest_email,
      to_name: bookingData.guest_name,
      booking_reference: bookingData.booking_reference,
      cottage_name: bookingData.cottage_name,
      check_in_date: bookingData.check_in_date,
      check_out_date: bookingData.check_out_date,
      total_amount: bookingData.total_amount,
      adults: bookingData.adults,
      children: bookingData.children,
      package_name: bookingData.package_name || 'Standard Package',
      special_requests: bookingData.special_requests || 'None',
      resort_name: 'Village Machaan Resort',
      resort_phone: '+91-7462-252052',
      resort_email: 'villagemachaan@gmail.com'
    };
    
    console.log('📧 Sending booking confirmation email...');
    
    // Send email via EmailJS
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_USER_ID,
        template_params: emailTemplate
      })
    });

    const result = await response.json();
    console.log('📧 EmailJS API Response:', result);
    
    if (response.ok && result.status === 200) {
      console.log('✅ Booking confirmation email sent successfully!');
      return { success: true, message: 'Email sent successfully' };
    } else {
      console.error('❌ EmailJS API error:', result);
      return { success: false, error: result.text || 'EmailJS API error' };
    }
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to generate booking reference
function generateBookingReference() {
  const prefix = 'VM';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Create new booking
router.post('/', async (req, res) => {
  console.log('📝 POST /api/bookings - Booking creation request received');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  try {
    const {
      cottageType,
      checkIn,
      checkOut,
      adults,
      children = 0,
      packageId,
      selectedSafaris = [],
      guestDetails,
      paymentMethod,
      totalAmount,
      specialRequests
    } = req.body;

    // Validate required fields
    if (!cottageType || !checkIn || !checkOut || !adults || !guestDetails || !totalAmount) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required booking information'
      });
    }

    console.log('✅ All required fields present, proceeding with booking creation...');

    // Get cottage by type
    console.log('🔍 Looking for cottage with type:', cottageType);
    const cottage = await getRow(
      'SELECT * FROM cottages WHERE type = ? AND is_active = 1',
      [cottageType]
    );
    console.log('🏠 Found cottage:', cottage ? cottage.name : 'Not found');

    if (!cottage) {
      return res.status(404).json({
        success: false,
        error: 'Cottage not found'
      });
    }

    // Check availability one more time
    const existingBookings = await getRows(
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

    if (existingBookings.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cottage is no longer available for the selected dates'
      });
    }

    // Generate booking reference
    const bookingReference = generateBookingReference();

    // Create booking
    const bookingResult = await run(
      `INSERT INTO bookings (
        booking_reference, cottage_id, package_id, check_in_date, check_out_date,
        adults, children, total_amount, payment_method, special_requests,
        guest_details, status, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        bookingReference,
        cottage.id,
        packageId || null,
        checkIn,
        checkOut,
        adults,
        children,
        totalAmount,
        paymentMethod || 'pending',
        specialRequests || null,
        JSON.stringify(guestDetails)
      ]
    );

    const bookingId = bookingResult.id;

    // Add safari bookings if any
    if (selectedSafaris && selectedSafaris.length > 0) {
      for (const safari of selectedSafaris) {
        await run(
          `INSERT INTO safari_bookings (
            booking_id, safari_type_id, participants, date, time_slot
          ) VALUES (?, ?, ?, ?, ?)`,
          [bookingId, safari.safariId, safari.participants, safari.date, safari.timeSlot]
        );
      }
    }

    // Get complete booking details
    const completeBooking = await getRow(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type, p.name as package_name
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       LEFT JOIN packages p ON b.package_id = p.id
       WHERE b.id = ?`,
      [bookingId]
    );

    // Get safari bookings
    const safariBookings = await getRows(
      `SELECT sb.*, st.name as safari_name, st.price
       FROM safari_bookings sb
       JOIN safari_types st ON sb.safari_type_id = st.id
       WHERE sb.booking_id = ?`,
      [bookingId]
    );

    // Send confirmation email (non-blocking)
    try {
      const emailData = {
        guest_email: guestDetails.email,
        guest_name: guestDetails.name || `${guestDetails.firstName} ${guestDetails.lastName}`,
        booking_reference: bookingReference,
        cottage_name: completeBooking.cottage_name,
        check_in_date: checkIn,
        check_out_date: checkOut,
        total_amount: totalAmount,
        adults: adults,
        children: children,
        package_name: completeBooking.package_name,
        special_requests: specialRequests
      };
      
      // Send email in background (don't wait for it)
      sendBookingEmails(emailData).then(result => {
        console.log('📧 Email sending result:', result);
      }).catch(error => {
        console.error('❌ Email sending error:', error);
      });
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      // Don't fail the booking if email fails
    }

    // Emit real-time notification to admin
    if (req.io) {
      req.io.to('admin-room').emit('new-booking', {
        booking: completeBooking,
        safaris: safariBookings,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking: completeBooking,
        safaris: safariBookings,
        bookingReference
      }
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      details: error.message
    });
  }
});

// Get booking by reference
router.get('/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const booking = await getRow(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type, 
              p.name as package_name, p.description as package_description
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       LEFT JOIN packages p ON b.package_id = p.id
       WHERE b.booking_reference = ?`,
      [reference]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Get safari bookings
    const safariBookings = await getRows(
      `SELECT sb.*, st.name as safari_name, st.price, st.duration
       FROM safari_bookings sb
       JOIN safari_types st ON sb.safari_type_id = st.id
       WHERE sb.booking_id = ?`,
      [booking.id]
    );

    // Parse guest details
    booking.guest_details = booking.guest_details ? JSON.parse(booking.guest_details) : null;

    res.json({
      success: true,
      data: {
        booking,
        safaris: safariBookings
      }
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking'
    });
  }
});

// Update booking status (Admin only)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const result = await run(
      `UPDATE bookings 
       SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, admin_notes || null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Get updated booking
    const updatedBooking = await getRow(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    // Emit real-time update to customer and admin
    if (req.io) {
      req.io.to('admin-room').emit('booking-status-updated', {
        booking: updatedBooking,
        previousStatus: req.body.previousStatus,
        timestamp: new Date().toISOString()
      });

      // Notify customer if they're connected
      if (updatedBooking.user_id) {
        req.io.to(`customer-${updatedBooking.user_id}`).emit('booking-update', {
          bookingId: id,
          newStatus: status,
          message: `Your booking ${updatedBooking.booking_reference} has been ${status}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: updatedBooking
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking status'
    });
  }
});

// Update payment status
router.patch('/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method, transaction_id } = req.body;

    if (!payment_status) {
      return res.status(400).json({
        success: false,
        error: 'Payment status is required'
      });
    }

    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status'
      });
    }

    const result = await run(
      `UPDATE bookings 
       SET payment_status = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payment_status, payment_method || null, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // If payment is successful, create payment record
    if (payment_status === 'paid' && transaction_id) {
      const booking = await getRow('SELECT total_amount FROM bookings WHERE id = ?', [id]);
      
      await run(
        `INSERT INTO payments (
          booking_id, amount, payment_method, transaction_id, status
        ) VALUES (?, ?, ?, ?, 'successful')`,
        [id, booking.total_amount, payment_method, transaction_id]
      );
    }

    // Get updated booking
    const updatedBooking = await getRow(
      `SELECT b.*, c.name as cottage_name
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    // Emit real-time update
    if (req.io) {
      req.io.to('admin-room').emit('payment-status-updated', {
        booking: updatedBooking,
        timestamp: new Date().toISOString()
      });

      if (updatedBooking.user_id) {
        req.io.to(`customer-${updatedBooking.user_id}`).emit('payment-update', {
          bookingId: id,
          paymentStatus: payment_status,
          message: `Payment ${payment_status} for booking ${updatedBooking.booking_reference}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: updatedBooking
    });

  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});

// Get all bookings (Admin with filters)
router.get('/admin', async (req, res) => {
  try {
    const { 
      status, 
      payment_status, 
      date_from, 
      date_to, 
      cottage_type,
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`b.status = ?`);
      params.push(status);
    }

    if (payment_status) {
      whereConditions.push(`b.payment_status = ?`);
      params.push(payment_status);
    }

    if (date_from) {
      whereConditions.push(`b.check_in_date >= ?`);
      params.push(date_from);
    }

    if (date_to) {
      whereConditions.push(`b.check_in_date <= ?`);
      params.push(date_to);
    }

    if (cottage_type) {
      whereConditions.push(`c.type = ?`);
      params.push(cottage_type);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const rawBookings = await getRows(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type,
              p.name as package_name
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       LEFT JOIN packages p ON b.package_id = p.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Transform bookings to extract customer details from guest_details JSON
    const bookings = rawBookings.map(booking => {
      let guestData = {};
      try {
        if (booking.guest_details) {
          guestData = JSON.parse(booking.guest_details);
        }
      } catch (e) {
        console.error('Error parsing guest_details:', e);
      }

      return {
        ...booking,
        customer_name: guestData.name || 'Unknown Customer',
        customer_email: guestData.email || '',
        customer_phone: guestData.phone || '',
        booking_date: booking.created_at
      };
    });

    // Get total count
    const totalResult = await getRow(
      `SELECT COUNT(*) as total
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          total: totalResult.total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalResult.total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Get booking statistics for dashboard
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_bookings,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as avg_booking_value
      FROM bookings
      WHERE created_at >= date('now', '-30 days')
    `);

    // Get recent bookings
    const rawRecentBookings = await getRows(`
      SELECT b.*, c.name as cottage_name, c.type as cottage_type
      FROM bookings b
      JOIN cottages c ON b.cottage_id = c.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    // Transform recent bookings to extract customer details
    const recentBookings = rawRecentBookings.map(booking => {
      let guestData = {};
      try {
        if (booking.guest_details) {
          guestData = JSON.parse(booking.guest_details);
        }
      } catch (e) {
        console.error('Error parsing guest_details:', e);
      }

      return {
        ...booking,
        customer_name: guestData.name || 'Unknown Customer',
        customer_email: guestData.email || '',
        customer_phone: guestData.phone || '',
        booking_date: booking.created_at
      };
    });

    res.json({
      success: true,
      data: {
        stats,
        recentBookings
      }
    });

  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking statistics'
    });
  }
});

module.exports = router;