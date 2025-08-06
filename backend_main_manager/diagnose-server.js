import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function diagnoseServer() {
  console.log('🔍 Diagnosing server health...');
  console.log(`📍 Target URL: ${SERVER_URL}`);
  
  const tests = [
    {
      name: 'Basic Health Check',
      endpoint: '/health',
      expectedStatus: 200
    },
    {
      name: 'Ping Endpoint',
      endpoint: '/ping',
      expectedStatus: 200
    },
    {
      name: 'API Health',
      endpoint: '/api/health',
      expectedStatus: 200
    },
    {
      name: 'Root Endpoint',
      endpoint: '/',
      expectedStatus: 200
    }
  ];
  
  let allTestsPassed = true;
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      
      const startTime = Date.now();
      const response = await fetch(`${SERVER_URL}${test.endpoint}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Server-Diagnostic/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(`✅ ${test.name}: PASS (${response.status}) - ${responseTime}ms`);
        
        // Log specific details for health endpoints
        if (test.endpoint === '/health') {
          console.log(`   📡 MQTT: ${data.mqttConnected ? 'Connected' : 'Disconnected'}`);
          console.log(`   📊 Devices: ${data.deviceCount || 0}`);
          console.log(`   🔌 Clients: ${data.connectedClients || 0}`);
          console.log(`   💾 Memory: ${data.memory ? Math.round(data.memory.heapUsed / 1024 / 1024) + 'MB' : 'N/A'}`);
          console.log(`   ⏰ Uptime: ${Math.round(data.uptime / 60)} minutes`);
        }
      } else {
        console.log(`❌ ${test.name}: FAIL (${response.status} ${response.statusText}) - ${responseTime}ms`);
        allTestsPassed = false;
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      allTestsPassed = false;
    }
  }
  
  console.log('\n📊 Diagnosis Summary:');
  if (allTestsPassed) {
    console.log('✅ All tests passed - Server is healthy');
  } else {
    console.log('⚠️  Some tests failed - Server may have issues');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if server is running: npm run start:prod');
    console.log('2. Check logs for errors');
    console.log('3. Restart server if needed');
    console.log('4. Check MQTT connection');
  }
  
  return allTestsPassed;
}

// Run diagnosis
diagnoseServer().then(isHealthy => {
  process.exit(isHealthy ? 0 : 1);
}); 