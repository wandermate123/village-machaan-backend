// Single Vercel serverless function for all API endpoints
const cors = require('cors');

// Simple in-memory data for demo
const cottages = [
  {
    id: 'glass-cottage',
    name: 'Glass Cottage',
    description: 'Luxurious glass-walled cottage with panoramic views',
    capacity: 4,
    base_price: 15000,
    amenities: 'AC, WiFi, Kitchen, Private Bathroom, Mountain View',
    is_active: 1
  },
  {
    id: 'hornbill-villa',
    name: 'Hornbill Villa',
    description: 'Spacious villa with modern amenities',
    capacity: 6,
    base_price: 18000,
    amenities: 'AC, WiFi, Kitchen, Private Bathroom, Garden, BBQ',
    is_active: 1
  },
  {
    id: 'kingfisher-villa',
    name: 'Kingfisher Villa',
    description: 'Premium villa with river view',
    capacity: 8,
    base_price: 22000,
    amenities: 'AC, WiFi, Kitchen, Private Bathroom, River View, Pool',
    is_active: 1
  }
];

const packages = [
  {
    id: 'honeymoon-package',
    name: 'Honeymoon Package',
    description: 'Romantic getaway with special amenities',
    price_multiplier: 1.3,
    includes_safari: 0,
    max_safaris: 0,
    is_active: 1
  },
  {
    id: 'family-package',
    name: 'Family Fun Package',
    description: 'Family-friendly activities and amenities',
    price_multiplier: 1.2,
    includes_safari: 0,
    max_safaris: 0,
    is_active: 1
  },
  {
    id: 'safari-package',
    name: 'Safari Adventure Package',
    description: 'Wildlife experience with guided safaris',
    price_multiplier: 1.5,
    includes_safari: 1,
    max_safaris: 3,
    is_active: 1
  }
];

const safaris = [
  {
    id: 'morning-safari',
    name: 'Morning Safari',
    description: 'Early morning wildlife viewing',
    duration: '3.5 hours',
    price: 800,
    max_guests: 6,
    is_active: 1
  },
  {
    id: 'evening-safari',
    name: 'Evening Safari',
    description: 'Sunset wildlife experience',
    duration: '3 hours',
    price: 750,
    max_guests: 6,
    is_active: 1
  }
];

// CORS helper
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://village-machaan-booking-system.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

module.exports = async function handler(req, res) {
  // Initialize CORS
  await runMiddleware(req, res, cors(corsOptions));

  const { method, url } = req;
  const path = new URL(url, `http://${req.headers.host}`).pathname;

  console.log(`${method} ${path}`);

  try {
    // Root endpoint
    if (path === '/api' || path === '/api/') {
      return res.status(200).json({
        message: 'Village Machaan API is running!',
        timestamp: new Date().toISOString(),
        environment: 'production',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          cottages: '/api/cottages',
          packages: '/api/packages',
          safaris: '/api/safaris'
        }
      });
    }

    // Health check
    if (path === '/api/health') {
      return res.status(200).json({
        status: 'OK',
        message: 'Village Machaan Booking API is running',
        timestamp: new Date().toISOString(),
        database: 'Connected (In-Memory)',
        environment: 'production'
      });
    }

    // Cottages endpoints
    if (path === '/api/cottages') {
      if (method === 'GET') {
        return res.status(200).json({
          success: true,
          data: cottages
        });
      }
    }

    // Cottage availability
    if (path.includes('/api/cottages/') && path.includes('/availability')) {
      if (method === 'POST') {
        return res.status(200).json({
          success: true,
          available: true,
          pricing: {
            basePrice: 15000,
            totalPrice: 30000,
            breakdown: {
              accommodation: 30000,
              taxes: 0,
              total: 30000
            }
          }
        });
      }
    }

    // Packages endpoints
    if (path === '/api/packages') {
      if (method === 'GET') {
        return res.status(200).json({
          success: true,
          data: packages
        });
      }
    }

    // Safaris endpoints
    if (path === '/api/safaris') {
      if (method === 'GET') {
        return res.status(200).json({
          success: true,
          data: safaris
        });
      }
    }

    // Bookings endpoint (simple)
    if (path === '/api/bookings') {
      if (method === 'POST') {
        const bookingRef = `VM${Date.now()}`;
        return res.status(201).json({
          success: true,
          message: 'Booking created successfully',
          data: {
            booking: {
              booking_reference: bookingRef,
              ...req.body,
              status: 'confirmed',
              created_at: new Date().toISOString()
            }
          }
        });
      }
    }

    // Admin login (simple)
    if (path === '/api/auth/admin-login') {
      if (method === 'POST') {
        return res.status(200).json({
          success: true,
          token: 'demo-admin-token',
          user: {
            id: 1,
            name: 'Admin',
            email: 'admin@villagemachaan.com',
            role: 'admin'
          }
        });
      }
    }

    // Payment endpoints (mock)
    if (path === '/api/payments/create-order') {
      if (method === 'POST') {
        return res.status(200).json({
          success: true,
          data: {
            orderId: `order_${Date.now()}`,
            amount: req.body.amount,
            currency: 'INR',
            keyId: 'rzp_test_demo'
          }
        });
      }
    }

    // 404 for unmatched routes
    return res.status(404).json({
      error: 'Route not found',
      path: path,
      method: method,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
