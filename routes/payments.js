const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getRow, run } = require('../config/database');
const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, bookingReference, guestDetails } = req.body;

    if (!amount || !bookingReference) {
      return res.status(400).json({
        success: false,
        error: 'Amount and booking reference are required'
      });
    }

    // Verify booking exists
    const booking = await getRow(
      'SELECT * FROM bookings WHERE booking_reference = ?',
      [bookingReference]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already paid'
      });
    }

    // Create Razorpay order
    const orderOptions = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: bookingReference,
      payment_capture: 1,
      notes: {
        booking_reference: bookingReference,
        guest_name: guestDetails ? `${guestDetails.firstName} ${guestDetails.lastName}` : 'Guest',
        guest_email: guestDetails ? guestDetails.email : ''
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    // Store order details
    await run(
      `INSERT INTO payments (booking_id, amount, payment_method, razorpay_order_id, status)
       VALUES (?, ?, 'razorpay', ?, 'pending')`,
      [booking.id, amount, order.id]
    );

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
        bookingReference
      }
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
});

// Verify Razorpay payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      bookingReference 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification parameters'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Get booking
    const booking = await getRow(
      'SELECT * FROM bookings WHERE booking_reference = ?',
      [bookingReference]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Update payment record
    await run(
      `UPDATE payments 
       SET razorpay_payment_id = ?, status = 'successful', updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_order_id]
    );

    // Update booking payment status
    await run(
      `UPDATE bookings 
       SET payment_status = 'paid', payment_method = 'razorpay', status = 'confirmed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [booking.id]
    );

    // Get updated booking with details
    const updatedBooking = await getRow(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       WHERE b.id = ?`,
      [booking.id]
    );

    // Emit real-time notifications
    if (req.io) {
      // Notify admin
      req.io.to('admin-room').emit('payment-received', {
        booking: updatedBooking,
        paymentDetails: {
          razorpay_payment_id,
          razorpay_order_id,
          amount: booking.total_amount
        },
        timestamp: new Date().toISOString()
      });

      // Notify customer if connected
      if (booking.user_id) {
        req.io.to(`customer-${booking.user_id}`).emit('payment-success', {
          bookingReference,
          paymentId: razorpay_payment_id,
          amount: booking.total_amount,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        bookingReference,
        paymentId: razorpay_payment_id,
        status: 'confirmed',
        booking: updatedBooking
      }
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Handle payment failure
router.post('/payment-failed', async (req, res) => {
  try {
    const { razorpay_order_id, bookingReference, error } = req.body;

    // Update payment record
    await run(
      `UPDATE payments 
       SET status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = ?`,
      [razorpay_order_id]
    );

    // Get booking
    const booking = await getRow(
      'SELECT * FROM bookings WHERE booking_reference = ?',
      [bookingReference]
    );

    if (booking) {
      // Emit real-time notification
      if (req.io) {
        req.io.to('admin-room').emit('payment-failed', {
          bookingReference,
          orderId: razorpay_order_id,
          error: error,
          timestamp: new Date().toISOString()
        });

        if (booking.user_id) {
          req.io.to(`customer-${booking.user_id}`).emit('payment-failed', {
            bookingReference,
            error: 'Payment failed. Please try again.',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Payment failure recorded'
    });

  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment failure'
    });
  }
});

// Process offline payment (Pay at Property)
router.post('/offline-payment', async (req, res) => {
  try {
    const { bookingReference, guestDetails } = req.body;

    if (!bookingReference) {
      return res.status(400).json({
        success: false,
        error: 'Booking reference is required'
      });
    }

    // Get booking
    const booking = await getRow(
      'SELECT * FROM bookings WHERE booking_reference = ?',
      [bookingReference]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already paid'
      });
    }

    // Update booking for offline payment
    await run(
      `UPDATE bookings 
       SET payment_method = 'pay_at_property', payment_status = 'pending', 
           status = 'confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [booking.id]
    );

    // Create payment record
    await run(
      `INSERT INTO payments (booking_id, amount, payment_method, status)
       VALUES (?, ?, 'pay_at_property', 'pending')`,
      [booking.id, booking.total_amount]
    );

    // Get updated booking
    const updatedBooking = await getRow(
      `SELECT b.*, c.name as cottage_name, c.type as cottage_type
       FROM bookings b
       JOIN cottages c ON b.cottage_id = c.id
       WHERE b.id = ?`,
      [booking.id]
    );

    // Emit real-time notifications
    if (req.io) {
      req.io.to('admin-room').emit('offline-booking-created', {
        booking: updatedBooking,
        guestDetails,
        timestamp: new Date().toISOString()
      });

      if (booking.user_id) {
        req.io.to(`customer-${booking.user_id}`).emit('booking-confirmed', {
          bookingReference,
          paymentMethod: 'pay_at_property',
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Offline booking confirmed successfully',
      data: {
        booking: updatedBooking,
        paymentMethod: 'pay_at_property',
        paymentStatus: 'pending'
      }
    });

  } catch (error) {
    console.error('Error processing offline payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process offline payment'
    });
  }
});

// Get payment details by booking reference
router.get('/booking/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const payments = await query(
      `SELECT p.*, b.booking_reference, b.total_amount as booking_amount
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE b.booking_reference = ?
       ORDER BY p.created_at DESC`,
      [reference]
    );

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment details'
    });
  }
});

// Admin: Get all payments with filters
router.get('/admin', async (req, res) => {
  try {
    const { 
      status, 
      payment_method, 
      date_from, 
      date_to, 
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push(`p.status = ?`);
      params.push(status);
    }

    if (payment_method) {
      whereConditions.push(`p.payment_method = ?`);
      params.push(payment_method);
    }

    if (date_from) {
      whereConditions.push(`p.created_at >= ?`);
      params.push(date_from);
    }

    if (date_to) {
      whereConditions.push(`p.created_at <= ?`);
      params.push(date_to + ' 23:59:59');
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const payments = await query(
      `SELECT p.*, b.booking_reference, b.check_in_date, b.check_out_date,
              c.name as cottage_name, c.type as cottage_type
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN cottages c ON b.cottage_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const totalResult = await getRow(
      `SELECT COUNT(*) as total
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total: totalResult.total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalResult.total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

// Admin: Get payment statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await getRow(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'successful' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        SUM(CASE WHEN status = 'successful' THEN amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'successful' THEN amount ELSE 0 END) as avg_transaction_value,
        COUNT(CASE WHEN payment_method = 'razorpay' THEN 1 END) as online_payments,
        COUNT(CASE WHEN payment_method = 'pay_at_property' THEN 1 END) as offline_payments
      FROM payments
      WHERE created_at >= date('now', '-30 days')
    `);

    // Get daily revenue for last 30 days
    const dailyRevenue = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status = 'successful' THEN amount ELSE 0 END) as revenue,
        COUNT(CASE WHEN status = 'successful' THEN 1 END) as transactions
      FROM payments
      WHERE created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        overview: stats,
        dailyRevenue
      }
    });

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment statistics'
    });
  }
});

module.exports = router;