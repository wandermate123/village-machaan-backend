// Email Service for Village Machaan Booking System
// Clean, working implementation from scratch

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_USER_ID = process.env.EMAILJS_USER_ID;

class EmailService {
  constructor() {
    this.isConfigured = this.checkConfiguration();
    if (this.isConfigured) {
      console.log('✅ EmailJS service configured and ready');
    } else {
      console.log('⚠️ EmailJS service not configured - emails will be skipped');
    }
  }

  checkConfiguration() {
    const hasServiceId = EMAILJS_SERVICE_ID && EMAILJS_SERVICE_ID.trim() !== '';
    const hasTemplateId = EMAILJS_TEMPLATE_ID && EMAILJS_TEMPLATE_ID.trim() !== '';
    const hasUserId = EMAILJS_USER_ID && EMAILJS_USER_ID.trim() !== '';

    console.log('🔍 EmailJS Configuration Check:');
    console.log('  Service ID:', hasServiceId ? '✅ Set' : '❌ Missing');
    console.log('  Template ID:', hasTemplateId ? '✅ Set' : '❌ Missing');
    console.log('  User ID:', hasUserId ? '✅ Set' : '❌ Missing');

    return hasServiceId && hasTemplateId && hasUserId;
  }

  async sendBookingConfirmation(bookingData) {
    if (!this.isConfigured) {
      console.log('⚠️ EmailJS not configured, skipping email sending');
      return {
        success: false,
        error: 'EmailJS not configured',
        skipped: true
      };
    }

    try {
      console.log('📧 Starting email sending process...');
      console.log('📧 Recipient:', bookingData.guest_email);
      console.log('📧 Booking Reference:', bookingData.booking_reference);

      // Prepare email template data
      const templateParams = {
        to_email: bookingData.guest_email,
        to_name: bookingData.guest_name || 'Guest',
        booking_reference: bookingData.booking_reference,
        cottage_name: bookingData.cottage_name,
        check_in_date: this.formatDate(bookingData.check_in_date),
        check_out_date: this.formatDate(bookingData.check_out_date),
        total_amount: this.formatCurrency(bookingData.total_amount),
        adults: bookingData.adults,
        children: bookingData.children,
        package_name: bookingData.package_name || 'Standard Package',
        special_requests: bookingData.special_requests || 'None',
        resort_name: 'Village Machaan Resort',
        resort_phone: '+91-7462-252052',
        resort_email: 'villagemachaan@gmail.com'
      };

      console.log('📧 Template parameters prepared:', templateParams);

      // Send email via EmailJS
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_USER_ID,
          template_params: templateParams
        })
      });

      console.log('📧 EmailJS API Response Status:', response.status);

      const result = await response.json();
      console.log('📧 EmailJS API Response:', result);

      if (response.ok && result.status === 200) {
        console.log('✅ Booking confirmation email sent successfully!');
        return {
          success: true,
          message: 'Email sent successfully',
          emailId: result.email_id || 'unknown'
        };
      } else {
        console.error('❌ EmailJS API error:', result);
        return {
          success: false,
          error: result.text || result.error || 'EmailJS API error',
          details: result
        };
      }

    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  }

  formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `₹${amount}`;
    }
  }

  // Test email sending
  async testEmail() {
    console.log('🧪 Testing email service...');
    
    const testData = {
      guest_email: 'test@example.com',
      guest_name: 'Test User',
      booking_reference: 'TEST-123456',
      cottage_name: 'Test Cottage',
      check_in_date: '2024-01-01',
      check_out_date: '2024-01-02',
      total_amount: 10000,
      adults: 2,
      children: 0,
      package_name: 'Test Package',
      special_requests: 'Test booking'
    };

    return await this.sendBookingConfirmation(testData);
  }
}

// Create and export singleton instance
const emailService = new EmailService();
module.exports = emailService;
