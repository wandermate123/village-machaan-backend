# Village Machaan Booking System - Backend

A robust Node.js/Express backend for the Village Machaan cottage booking system with PostgreSQL database.

## 🚀 Features

- **User Authentication**: JWT-based user registration and login
- **Cottage Management**: Real-time availability checking and cottage information
- **Package Management**: Dynamic pricing with package multipliers
- **Booking System**: Complete reservation management with conflict checking
- **Safari Management**: Safari slot booking and capacity management
- **Payment Processing**: Payment records and status management
- **Security**: Input validation, rate limiting, and CORS protection

## 🛠️ Tech Stack

- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens with bcrypt password hashing
- **Validation**: Express-validator for input sanitization
- **Security**: Helmet.js, rate limiting, CORS protection

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## 🗄️ Database Setup

### 1. Install PostgreSQL
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **macOS**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql postgresql-contrib`

### 2. Create Database
```sql
CREATE DATABASE village_machaan;
```

### 3. Run Schema
```bash
psql -d village_machaan -f database/schema.sql
```

## ⚙️ Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=village_machaan
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Payment Gateway Keys (Optional)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
```

### 3. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Cottages
- `GET /api/cottages` - List all cottages
- `GET /api/cottages/:id` - Get cottage details
- `POST /api/cottages/availability` - Check availability
- `GET /api/cottages/:id/availability` - Get availability for date range

### Packages
- `GET /api/packages` - List all packages
- `GET /api/packages/:id` - Get package details
- `POST /api/packages/calculate-price` - Calculate package pricing
- `GET /api/packages/type/:type` - Get packages by type
- `GET /api/packages/safari/available` - Get safari packages

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Safaris
- `GET /api/safaris/slots` - Get available safari slots
- `GET /api/safaris/slots/range` - Get slots for date range
- `POST /api/safaris/book` - Book safari slot
- `DELETE /api/safaris/book/:id` - Cancel safari booking
- `GET /api/safaris/my-bookings` - Get user's safari bookings

### Payments
- `POST /api/payments` - Create payment record
- `PUT /api/payments/:id/status` - Update payment status
- `GET /api/payments/:id` - Get payment details
- `GET /api/payments/booking/:bookingId` - Get payments for booking
- `GET /api/payments/history` - Get user's payment history
- `POST /api/payments/:id/process` - Process payment (simulated)

## 🔐 Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Database Schema

The system includes the following main tables:
- **users** - User accounts and profiles
- **cottages** - Cottage information and pricing
- **packages** - Package types and multipliers
- **safari_slots** - Available safari time slots
- **bookings** - Reservation records
- **safari_bookings** - Safari reservations
- **payments** - Payment records and status
- **cottage_availability** - Real-time availability tracking

## 🧪 Testing

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Test Database Connection
The server will automatically test the database connection on startup.

## 🚀 Production Deployment

### 1. Environment Variables
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production database credentials
- Set up SSL certificates

### 2. Database
- Use production PostgreSQL instance
- Set up automated backups
- Configure connection pooling

### 3. Security
- Enable HTTPS
- Set up firewall rules
- Use environment-specific CORS origins
- Implement proper logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review the database schema
- Check server logs for errors
- Ensure all environment variables are set correctly
