import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mqtt from 'mqtt';
import fetch from 'node-fetch';

// Import routes
import authRoutes from './routes/auth.js';
import sitesRoutes from './routes/sites.js';
import usersRoutes from './routes/users.js';
import dataRoutes from './routes/data.js';
import deviceRoutes from './routes/device.js';

// Load environment variables
dotenv.config();

const app = express();

// Create HTTP server and Socket.IO server
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*", // Frontend URL with fallback
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],
  // Add connection limits to prevent memory leaks
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected:', socket.id);
  
  // Initialize client subscriptions tracking
  clientSubscriptions.set(socket.id, new Set());
  
  // Handle device subscription
  socket.on('subscribe-device', (deviceId) => {
    try {
      console.log(`📡 Client ${socket.id} subscribing to device: ${deviceId}`);
      
      // Check if device exists in our map
      if (!deviceMap[deviceId]) {
        console.warn(`⚠️ Unknown device ${deviceId} requested by client ${socket.id}`);
        socket.emit('subscription-error', { deviceId, error: 'Device not found' });
        return;
      }
      
      // Join the device room
      socket.join(`device:${deviceId}`);
      
      // Track this subscription
      const clientDevices = clientSubscriptions.get(socket.id);
      clientDevices.add(deviceId);
      
      // Subscribe to MQTT topic if not already subscribed
      subscribeToDevice(deviceId);
      
      socket.emit('subscription-confirmed', { deviceId });
      console.log(`✅ Client ${socket.id} successfully subscribed to device: ${deviceId}`);
    } catch (error) {
      console.error('❌ Error in subscribe-device:', error.message);
      socket.emit('subscription-error', { deviceId, error: 'Internal server error' });
    }
  });
  
  // Handle device unsubscription
  socket.on('unsubscribe-device', (deviceId) => {
    try {
      console.log(`📡 Client ${socket.id} unsubscribing from device: ${deviceId}`);
      
      // Leave the device room
      socket.leave(`device:${deviceId}`);
      
      // Remove from tracking
      const clientDevices = clientSubscriptions.get(socket.id);
      if (clientDevices) {
        clientDevices.delete(deviceId);
      }
      
      // Check if any other clients are still subscribed to this device
      let otherClientsSubscribed = false;
      for (const [clientId, devices] of clientSubscriptions.entries()) {
        if (clientId !== socket.id && devices.has(deviceId)) {
          otherClientsSubscribed = true;
          break;
        }
      }
      
      // If no other clients are subscribed, unsubscribe from MQTT topic
      if (!otherClientsSubscribed) {
        unsubscribeFromDevice(deviceId);
        console.log(`📡 No other clients subscribed to ${deviceId}, unsubscribing from MQTT topic`);
      }
    } catch (error) {
      console.error('❌ Error in unsubscribe-device:', error.message);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket client disconnected:', socket.id);
    
    try {
      // Get all devices this client was subscribed to
      const clientDevices = clientSubscriptions.get(socket.id);
      if (clientDevices) {
        console.log(`📡 Client ${socket.id} was subscribed to devices:`, Array.from(clientDevices));
        
        // Check each device to see if we should unsubscribe from MQTT
        clientDevices.forEach(deviceId => {
          let otherClientsSubscribed = false;
          for (const [clientId, devices] of clientSubscriptions.entries()) {
            if (clientId !== socket.id && devices.has(deviceId)) {
              otherClientsSubscribed = true;
              break;
            }
          }
          
          // If no other clients are subscribed, unsubscribe from MQTT topic
          if (!otherClientsSubscribed) {
            unsubscribeFromDevice(deviceId);
            console.log(`📡 No other clients subscribed to ${deviceId}, unsubscribing from MQTT topic`);
          }
        });
      }
      
      // Clean up client subscriptions
      clientSubscriptions.delete(socket.id);
      console.log(`🧹 Cleaned up subscriptions for client ${socket.id}`);
    } catch (error) {
      console.error('❌ Error in socket disconnect cleanup:', error.message);
    }
  });
});

// Export io for use in other modules
export { io };

// Security middleware
app.use(helmet());

// CORS configuration for frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI ;
    await mongoose.connect(mongoUri, {
      dbName: 'iot_dashboard',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected Successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.log('💡 To fix this issue:');
    console.log('   1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/');
    console.log('   2. Or use MongoDB Atlas: https://www.mongodb.com/atlas');
    console.log('   3. Set MONGO_URI environment variable');
    console.log('');
    console.log('⚠️  Server will start without database connection. Some features may not work.');
    return false;
  }
};

// Connect to database
let dbConnected = false;
connectDB().then(connected => {
  dbConnected = connected;
});

// MQTT Client Setup
let mqttClient = null;
let deviceMap = {};
let activeSubscriptions = new Set(); // Track active MQTT subscriptions
let clientSubscriptions = new Map(); // Track which clients are subscribed to which devices
let mqttReconnectAttempts = 0;
const MAX_MQTT_RECONNECT_ATTEMPTS = 10;

// MQTT connection function
function connectMQTT(brokerUrl = process.env.MQTT_BROKER_URL ) {
  console.log('🚀 Connecting to MQTT broker:', brokerUrl);
  
  // Clean up existing client if it exists
  if (mqttClient) {
    mqttClient.removeAllListeners();
    mqttClient.end(true);
  }
  
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `iot_dashboard_main_${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
    keepalive: 60,
    reschedulePings: true
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log('📡 MQTT client ready for dynamic subscriptions');
    mqttReconnectAttempts = 0; // Reset reconnect attempts on successful connection
  });

  mqttClient.on('error', err => {
    console.error('❌ MQTT connection error:', err.message);
    mqttReconnectAttempts++;
    
    if (mqttReconnectAttempts >= MAX_MQTT_RECONNECT_ATTEMPTS) {
      console.error('❌ Max MQTT reconnection attempts reached, stopping reconnection');
      return;
    }
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
    mqttReconnectAttempts++;
  });

  mqttClient.on('close', () => {
    console.log('🔌 MQTT connection closed');
  });

  mqttClient.on('message', async (topic, messageBuffer) => {
    try {
      const messageString = messageBuffer.toString();
      console.log('📥 Raw MQTT message:', messageString);
      
      const data = JSON.parse(messageString);
      console.log('📥 Parsed MQTT message:', JSON.stringify(data, null, 2));
      
      const { deviceId } = data;
      
      if (!deviceId) {
        console.warn('⚠️ No deviceId in MQTT message');
        return;
      }

      // Get device metadata
      const meta = deviceMap[deviceId];
      if (!meta) {
        console.warn(`⚠️ Unknown deviceId "${deviceId}" from topic "${topic}"`);
        return;
      }

      console.log(`📡 Processing data for device ${deviceId} (${meta.deviceName})`);

      // Broadcast real-time data to WebSocket clients
      const realtimeData = {
        ...data,
        timestamp: data.timestamp || Date.now()
      };

      // Emit to clients subscribed to this device
      io.to(`device:${deviceId}`).emit('device-data', realtimeData);
      
      console.log(`🔌 Real-time data broadcasted for device ${deviceId}:`, realtimeData);

    } catch (err) {
      console.error('❌ Failed to process MQTT message:', err.message);
    }
  });
}

// Function to build device map (no automatic subscriptions)
async function initializeDeviceMap() {
  try {
    // Import device and site models
    const Device = mongoose.model('Device');
    const Site = mongoose.model('Site');
    
    // Get all active devices with their site information
    const devices = await Device.find({ status: 'active' }).lean();
    const sites = await Site.find({}).lean();
    
    // Create a site map for quick lookup
    const siteMap = {};
    sites.forEach(site => {
      siteMap[site._id.toString()] = site;
    });

    const newDeviceMap = {};

    console.log('🔨 Building device map from database...');
    
    for (const device of devices) {
      if (!device.deviceId || !device.siteId) continue;
      
      const site = siteMap[device.siteId.toString()];
      if (!site) {
        console.warn(`⚠️ Site not found for device ${device.deviceId}`);
        continue;
      }

      newDeviceMap[device.deviceId] = {
        siteName: site.name,
        siteId: device.siteId.toString(),
        type: device.type,
        deviceName: device.name
      };
      
      console.log(`  📱 Found device: ${device.name} (${device.deviceId}) -> Site: ${site.name}`);
    }
    
    console.log(`📊 Device map loaded: ${Object.keys(newDeviceMap).length} devices from ${sites.length} sites`);

    // Update global variables
    deviceMap = newDeviceMap;

    // Connect to MQTT broker
    connectMQTT();

  } catch (error) {
    console.error('❌ Failed to initialize device map:', error.message);
  }
}

// Helper function to subscribe to a device topic
function subscribeToDevice(deviceId) {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('⚠️ MQTT client not connected, cannot subscribe to device:', deviceId);
    return false;
  }

  const topic = `device/${deviceId}/data`;
  
  if (activeSubscriptions.has(topic)) {
    console.log(`📡 Already subscribed to topic: ${topic}`);
    return true;
  }

  mqttClient.subscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to topic "${topic}":`, err.message);
      return false;
    } else {
      console.log(`📡 Subscribed to MQTT topic: ${topic}`);
      activeSubscriptions.add(topic);
      return true;
    }
  });
  
  return true;
}

// Helper function to unsubscribe from a device topic
function unsubscribeFromDevice(deviceId) {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('⚠️ MQTT client not connected, cannot unsubscribe from device:', deviceId);
    return false;
  }

  const topic = `device/${deviceId}/data`;
  
  if (!activeSubscriptions.has(topic)) {
    console.log(`📡 Not subscribed to topic: ${topic}`);
    return true;
  }

  mqttClient.unsubscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Failed to unsubscribe from topic "${topic}":`, err.message);
      return false;
    } else {
      console.log(`📡 Unsubscribed from MQTT topic: ${topic}`);
      activeSubscriptions.delete(topic);
      return true;
    }
  });
  
  return true;
}

// Function to refresh device map (call when devices are added/updated)
async function refreshDeviceMap() {
  console.log('🔄 Refreshing device map...');
  
  // Clear current device map
  deviceMap = {};
  
  // Reinitialize device map
  await initializeDeviceMap();
}

// Export refresh function for use in routes
export { refreshDeviceMap };

// Initialize device map after database connection
mongoose.connection.once('open', () => {
  console.log('📡 Database connected, initializing device map...');
  setTimeout(initializeDeviceMap, 2000); // Small delay to ensure models are loaded
});

// Handle database connection errors gracefully
mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB connection error:', error.message);
  dbConnected = false;
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/device', deviceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
      status: dbConnected ? 'connected' : 'disconnected'
    }
  });
});

// Ping endpoint for keep-alive
app.get('/ping', (req, res) => {
  res.json({ 
    message: 'Main Server is alive',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    mqttConnected: mqttClient ? mqttClient.connected : false,
    deviceCount: Object.keys(deviceMap).length,
    activeSubscriptions: activeSubscriptions.size,
    connectedClients: clientSubscriptions.size
  });
});

// Health check endpoint for monitoring services
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mqttConnected: mqttClient ? mqttClient.connected : false,
    deviceCount: Object.keys(deviceMap).length,
    activeSubscriptions: activeSubscriptions.size,
    connectedClients: clientSubscriptions.size
  };
  
  // Return 503 if MQTT is not connected
  if (!mqttClient || !mqttClient.connected) {
    health.status = 'degraded';
    health.mqttError = 'MQTT connection lost';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'IoT Dashboard Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      sites: '/api/sites',
      users: '/api/users',
      data: '/api/data',
      device: '/api/device',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.message
    });
  }
  
  if (error.name === 'MongoError' && error.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate field error',
      details: 'This record already exists'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV }`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server ready for connections`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /ping - Health check endpoint`);
  console.log(`   GET  /health - Detailed health check`);
  console.log(`   GET  /api/health - Detailed health check`);
  console.log(`   GET  /api/auth - Authentication routes`);
  console.log(`   GET  /api/sites - Site management routes`);
  console.log(`   GET  /api/users - User management routes`);
  console.log(`   GET  /api/data - Data management routes`);
  console.log(`   GET  /api/device - Device management routes`);
});

// Self-ping mechanism to keep server running when deployed on Render
const pingInterval = setInterval(async () => {
  const baseUrl = process.env.DEPLOYED_URL;
  
  // Check if DEPLOYED_URL is set
  if (!baseUrl) {
    console.log('⚠️ DEPLOYED_URL not set, skipping self-ping');
    return;
  }
  
  const url = `${baseUrl}/ping`;
  
  console.log(`🔄 Self-pinging Main Server at ${url}...`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Render-Keep-Alive/1.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000 // Increased timeout
    });
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log('✅ Self-ping successful - Main Server kept awake');
      console.log(`📊 Ping response: ${data.message || 'OK'}`);
    } else {
      console.log(`⚠️ Self-ping failed - Response not OK: ${response.status} ${response.statusText}`);
      
      // Try alternative health endpoint if ping fails
      try {
        const healthResponse = await fetch(`${baseUrl}/health`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Render-Keep-Alive/1.0',
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        if (healthResponse.ok) {
          console.log('✅ Alternative health check successful');
        } else {
          console.log(`⚠️ Alternative health check also failed: ${healthResponse.status}`);
        }
      } catch (healthError) {
        console.log('❌ Alternative health check failed:', healthError.message);
      }
    }
  } catch (error) {
    console.log('❌ Self-ping failed:', error.message);
    
    // Log additional error details for debugging
    if (error.code) {
      console.log(`🔍 Error code: ${error.code}`);
    }
    if (error.syscall) {
      console.log(`🔍 System call: ${error.syscall}`);
    }
  }
}, 5 * 60 * 1000); // Ping every 5 minutes

// Alternative keep-alive mechanism using internal ping
const internalPingInterval = setInterval(() => {
  console.log('🔄 Internal keep-alive ping - Server is running');
  
  // Get detailed memory usage
  const memUsage = process.memoryUsage();
  
  // Log server status
  console.log(`📊 Server Status:`);
  console.log(`   - MQTT Connected: ${mqttClient ? mqttClient.connected : false}`);
  console.log(`   - Device Count: ${Object.keys(deviceMap).length}`);
  console.log(`   - Active Subscriptions: ${activeSubscriptions.size}`);
  console.log(`   - Connected Clients: ${clientSubscriptions.size}`);
  console.log(`   - Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   - Memory Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`   - External Memory: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
  console.log(`   - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  
  // Check for potential issues
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  if (heapUsedMB > 200) {
    console.log('⚠️  WARNING: High memory usage detected!');
  }
  
  if (clientSubscriptions.size > 50) {
    console.log('⚠️  WARNING: High number of client subscriptions!');
  }
  
  // Try to reconnect MQTT if disconnected
  if (mqttClient && !mqttClient.connected && mqttReconnectAttempts < MAX_MQTT_RECONNECT_ATTEMPTS) {
    console.log('🔄 Attempting to reconnect MQTT...');
    connectMQTT();
  }
  
  // Clean up stale client subscriptions (clients that disconnected without proper cleanup)
  let cleanedCount = 0;
  for (const [clientId, devices] of clientSubscriptions.entries()) {
    const socket = io.sockets.sockets.get(clientId);
    if (!socket || !socket.connected) {
      console.log(`🧹 Cleaning up stale client subscription: ${clientId}`);
      clientSubscriptions.delete(clientId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} stale client subscriptions`);
  }
  
  // Log uptime
  const uptimeHours = Math.round(process.uptime() / 3600);
  console.log(`⏰ Server uptime: ${uptimeHours} hours`);
  
}, 10 * 60 * 1000); // Internal ping every 10 minutes

// Memory cleanup interval
const memoryCleanupInterval = setInterval(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('🧹 Memory cleanup performed');
  }
  
  // Log memory usage
  const memUsage = process.memoryUsage();
  console.log(`📊 Memory Usage:`, {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
  });
}, 30 * 60 * 1000); // Memory cleanup every 30 minutes

// Graceful shutdown function
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  // Clear all intervals
  clearInterval(pingInterval);
  clearInterval(internalPingInterval);
  clearInterval(memoryCleanupInterval);
  
  // Close all socket connections
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
  });
  
  // Disconnect MQTT client
  if (mqttClient) {
    mqttClient.end(true, () => {
      console.log('🔌 MQTT client disconnected');
    });
  }
  
  // Close database connection
  mongoose.connection.close(() => {
    console.log('📡 Database connection closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); 