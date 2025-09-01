const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test admin login endpoint
app.post('/test-admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Testing admin login for:', email);

    // Find admin user
    const user = await pool.query(
      'SELECT * FROM public.users WHERE email = $1 AND role IN ($2, $3) AND is_active = true',
      [email, 'admin', 'manager']
    );

    if (user.rows.length === 0) {
      console.log('User not found or insufficient privileges');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials or insufficient privileges'
      });
    }

    const foundUser = user.rows[0];
    console.log('User found:', foundUser.email, 'Role:', foundUser.role);

    // Check password
    const isPasswordValid = await bcrypt.compare(password, foundUser.password_hash);
    if (!isPasswordValid) {
      console.log('Invalid password');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials or insufficient privileges'
      });
    }

    console.log('Password valid, generating token...');

    // Generate JWT token
    const token = jwt.sign(
      { userId: foundUser.id, email: foundUser.email, role: foundUser.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('Token generated successfully');

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        name: `${foundUser.first_name} ${foundUser.last_name}`,
        role: foundUser.role,
        is_active: foundUser.is_active
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login: ' + error.message
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test admin login with:');
  console.log('POST http://localhost:5001/test-admin-login');
  console.log('Body: {"email": "admin@villagemachaan.com", "password": "admin123"}');
});



