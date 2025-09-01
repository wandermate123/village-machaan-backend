// Simple test script for Village Machaan Backend API
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testAPI() {
  console.log('🧪 Testing Village Machaan Backend API...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    
    if (healthResponse.ok) {
      console.log('✅ Health Check:', healthData.message);
    } else {
      console.log('❌ Health Check Failed:', healthData.error);
    }

    // Test 2: Get Cottages
    console.log('\n2️⃣ Testing Cottages API...');
    const cottagesResponse = await fetch(`${BASE_URL}/cottages`);
    const cottagesData = await cottagesResponse.json();
    
    if (cottagesResponse.ok) {
      console.log('✅ Cottages Retrieved:', cottagesData.data.length, 'cottages found');
      cottagesData.data.forEach(cottage => {
        console.log(`   - ${cottage.name} (${cottage.type}): ₹${cottage.base_price}/night`);
      });
    } else {
      console.log('❌ Cottages API Failed:', cottagesData.error);
    }

    // Test 3: Get Packages
    console.log('\n3️⃣ Testing Packages API...');
    const packagesResponse = await fetch(`${BASE_URL}/packages`);
    const packagesData = await packagesResponse.json();
    
    if (packagesResponse.ok) {
      console.log('✅ Packages Retrieved:', packagesData.data.length, 'packages found');
      packagesData.data.forEach(pkg => {
        console.log(`   - ${pkg.name} (${pkg.type}): ${pkg.price_multiplier}x multiplier`);
      });
    } else {
      console.log('❌ Packages API Failed:', packagesData.error);
    }

    // Test 4: Test Availability Check
    console.log('\n4️⃣ Testing Availability Check...');
    const availabilityData = {
      cottageId: cottagesData.data[0]?.id,
      checkIn: '2024-04-01',
      checkOut: '2024-04-03',
      guests: 2
    };

    if (availabilityData.cottageId) {
      const availabilityResponse = await fetch(`${BASE_URL}/cottages/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(availabilityData),
      });
      
      const availabilityResult = await availabilityResponse.json();
      
      if (availabilityResponse.ok) {
        console.log('✅ Availability Check:', availabilityResult.data.available ? 'Available' : 'Not Available');
        console.log(`   - Total Price: ₹${availabilityResult.data.totalPrice}`);
        console.log(`   - Nights: ${availabilityResult.data.dates.nights}`);
      } else {
        console.log('❌ Availability Check Failed:', availabilityResult.error);
      }
    } else {
      console.log('⚠️ Skipping availability test - no cottages found');
    }

    console.log('\n🎉 API Testing Completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Test user registration: POST /api/auth/register');
    console.log('   2. Test user login: POST /api/auth/login');
    console.log('   3. Test authenticated endpoints with JWT token');
    console.log('   4. Test booking creation and management');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Backend server is running (npm run dev)');
    console.log('   2. Database is connected');
    console.log('   3. All environment variables are set');
  }
}

// Run tests
testAPI();
