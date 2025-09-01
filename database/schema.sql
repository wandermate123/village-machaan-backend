-- Village Machaan Booking System Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cottages table
CREATE TABLE cottages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- hornbill, kingfisher, glass
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    max_guests INTEGER NOT NULL,
    amenities JSONB,
    images TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packages table
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- honeymoon, elderly, family, safari
    description TEXT,
    price_multiplier DECIMAL(3,2) NOT NULL,
    includes_safari BOOLEAN DEFAULT false,
    max_safaris INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safari slots table
CREATE TABLE safari_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    max_capacity INTEGER NOT NULL,
    current_bookings INTEGER DEFAULT 0,
    guide_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, time_slot)
);

-- Bookings table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cottage_id UUID REFERENCES cottages(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    adults INTEGER NOT NULL,
    children INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled, completed
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safari bookings table
CREATE TABLE safari_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    safari_slot_id UUID REFERENCES safari_slots(id) ON DELETE CASCADE,
    participants INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL, -- credit_card, bank_transfer, upi
    payment_gateway VARCHAR(50), -- stripe, razorpay
    transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, successful, failed
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Availability table for real-time tracking
CREATE TABLE cottage_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cottage_id UUID REFERENCES cottages(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT true,
    price_modifier DECIMAL(3,2) DEFAULT 1.0, -- for seasonal pricing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cottage_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_safari_bookings_booking_id ON safari_bookings(booking_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_cottage_availability_date ON cottage_availability(date);
CREATE INDEX idx_safari_slots_date ON safari_slots(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO cottages (name, type, description, base_price, max_guests, amenities) VALUES
('Hornbill Cottage', 'hornbill', 'Cozy cottage with garden view', 150.00, 2, '["WiFi", "AC", "Garden", "Kitchen"]'),
('Kingfisher Suite', 'kingfisher', 'Luxury suite with river view', 250.00, 4, '["WiFi", "AC", "River View", "Balcony", "Kitchen"]'),
('Glass Cottage', 'glass', 'Modern glass house with panoramic views', 350.00, 6, '["WiFi", "AC", "Panoramic View", "Glass Walls", "Kitchen", "Fireplace"]');

INSERT INTO packages (name, type, description, price_multiplier, includes_safari, max_safaris) VALUES
('Honeymoon Package', 'honeymoon', 'Romantic getaway with special amenities', 1.30, false, 0),
('Elderly Package', 'elderly', 'Comfortable stay with accessibility features', 1.10, false, 0),
('Family Fun Package', 'family', 'Family-friendly activities and amenities', 1.20, false, 0),
('Safari Adventure Package', 'safari', 'Wildlife experience with guided safaris', 1.50, true, 3);
