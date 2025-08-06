import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function checkServerHealth() {
  try {
    console.log('🔍 Checking server health...');
    
    // Check basic health endpoint
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    
    console.log('📊 Server Health Status:');
    console.log(`   Status: ${healthData.status}`);
    console.log(`   Uptime: ${Math.round(healthData.uptime / 60)} minutes`);
    console.log(`   MQTT Connected: ${healthData.mqttConnected}`);
    console.log(`   Device Count: ${healthData.deviceCount}`);
    console.log(`   Active Subscriptions: ${healthData.activeSubscriptions}`);
    console.log(`   Connected Clients: ${healthData.connectedClients}`);
    
    if (healthData.memory) {
      console.log(`   Memory Usage: ${Math.round(healthData.memory.heapUsed / 1024 / 1024)}MB`);
    }
    
    // Check ping endpoint
    const pingResponse = await fetch(`${SERVER_URL}/ping`);
    const pingData = await pingResponse.json();
    
    console.log('🏓 Ping Status:', pingData.status);
    
    // Determine if server needs attention
    if (healthData.status !== 'healthy') {
      console.log('⚠️  WARNING: Server status is not healthy!');
      return false;
    }
    
    if (!healthData.mqttConnected) {
      console.log('⚠️  WARNING: MQTT is not connected!');
      return false;
    }
    
    console.log('✅ Server is healthy');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to check server health:', error.message);
    return false;
  }
}

// Run health check
checkServerHealth().then(isHealthy => {
  process.exit(isHealthy ? 0 : 1);
}); 