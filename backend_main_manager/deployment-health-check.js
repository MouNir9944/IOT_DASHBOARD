import fetch from 'node-fetch';

const DEPLOYED_URL = process.env.DEPLOYED_URL || 'https://iot-dashboard-qa2y.onrender.com';

async function checkDeploymentHealth() {
  console.log('🔍 Checking deployment health...');
  console.log(`📍 Target URL: ${DEPLOYED_URL}`);
  
  const endpoints = [
    { name: 'Ping', path: '/ping' },
    { name: 'Health', path: '/health' },
    { name: 'API Health', path: '/api/health' },
    { name: 'Root', path: '/' }
  ];
  
  let allHealthy = true;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testing ${endpoint.name} endpoint...`);
      
      const response = await fetch(`${DEPLOYED_URL}${endpoint.path}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Deployment-Health-Check/1.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000
      });
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(`✅ ${endpoint.name}: OK (${response.status})`);
        
        // Log specific data for health endpoints
        if (endpoint.path === '/health' && data.mqttConnected !== undefined) {
          console.log(`   📡 MQTT: ${data.mqttConnected ? 'Connected' : 'Disconnected'}`);
          console.log(`   📊 Devices: ${data.deviceCount || 0}`);
          console.log(`   🔌 Clients: ${data.connectedClients || 0}`);
          console.log(`   💾 Memory: ${data.memory ? Math.round(data.memory.heapUsed / 1024 / 1024) + 'MB' : 'N/A'}`);
        }
      } else {
        console.log(`❌ ${endpoint.name}: Failed (${response.status} ${response.statusText})`);
        allHealthy = false;
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Error - ${error.message}`);
      allHealthy = false;
    }
  }
  
  console.log('\n📊 Summary:');
  if (allHealthy) {
    console.log('✅ All endpoints are healthy');
  } else {
    console.log('⚠️  Some endpoints are unhealthy');
  }
  
  return allHealthy;
}

// Run health check
checkDeploymentHealth().then(isHealthy => {
  process.exit(isHealthy ? 0 : 1);
}); 