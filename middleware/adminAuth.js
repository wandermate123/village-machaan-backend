const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and has admin role
    const userQuery = 'SELECT id, email, role, is_active FROM users WHERE id = $1 AND role IN ($2, $3) AND is_active = true';
    const userResult = await pool.query(userQuery, [decoded.userId, 'admin', 'manager']);
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const requireSuperAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { adminAuth, requireSuperAdmin };



