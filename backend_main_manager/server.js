import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mqtt from 'mqtt';

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
    origin: "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected:', socket.id);
  
  // Handle device subscription
  socket.on('subscribe-device', (deviceId) => {
    console.log(`📡 Client ${socket.id} subscribing to device: ${deviceId}`);
    socket.join(`device:${deviceId}`);
    socket.emit('subscription-confirmed', { deviceId });
  });
  
  // Handle device unsubscription
  socket.on('unsubscribe-device', (deviceId) => {
    console.log(`📡 Client ${socket.id} unsubscribing from device: ${deviceId}`);
    socket.leave(`device:${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket client disconnected:', socket.id);
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
let topics = [];

// MQTT connection function
function connectMQTT(brokerUrl = process.env.MQTT_BROKER_URL ) {
  console.log('🚀 Connecting to MQTT broker:', brokerUrl);
  
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `iot_dashboard_main_${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    
    // Subscribe to all device topics
    if (topics.length > 0) {
      topics.forEach(topic => {
        mqttClient.subscribe(topic, err => {
          if (err) {
            console.error(`❌ Failed to subscribe to topic "${topic}":`, err.message);
          } else {
            console.log(`📡 Subscribed to MQTT topic: ${topic}`);
          }
        });
      });
    }
  });

  mqttClient.on('error', err => {
    console.error('❌ MQTT connection error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
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

// Function to build device map and subscribe to topics
async function initializeMQTTSubscriptions() {
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

    const newDeviceTopics = [];
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
      
      // MQTT topic format: device/{deviceId}/data
      newDeviceTopics.push(`device/${device.deviceId}/data`);
      console.log(`  📱 Found device: ${device.name} (${device.deviceId}) -> Site: ${site.name}`);
    }
    
    console.log(`📊 Device map loaded: ${Object.keys(newDeviceMap).length} devices from ${sites.length} sites`);

    // Update global variables
    deviceMap = newDeviceMap;
    topics = newDeviceTopics;

    // Connect to MQTT broker
    connectMQTT();

  } catch (error) {
    console.error('❌ Failed to initialize MQTT subscriptions:', error.message);
  }
}

// Function to refresh MQTT subscriptions (call when devices are added/updated)
async function refreshMQTTSubscriptions() {
  console.log('🔄 Refreshing MQTT subscriptions...');
  
  // Unsubscribe from old topics
  if (mqttClient && topics.length > 0) {
    topics.forEach(topic => {
      mqttClient.unsubscribe(topic);
    });
  }
  
  // Reinitialize subscriptions
  await initializeMQTTSubscriptions();
}

// Export refresh function for use in routes
export { refreshMQTTSubscriptions };

// Initialize MQTT subscriptions after database connection
mongoose.connection.once('open', () => {
  console.log('📡 Database connected, initializing MQTT subscriptions...');
  setTimeout(initializeMQTTSubscriptions, 2000); // Small delay to ensure models are loaded
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
    deviceCount: Object.keys(deviceMap).length
  });
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
  console.log(`   GET  /api/health - Detailed health check`);
  console.log(`   GET  /api/auth - Authentication routes`);
  console.log(`   GET  /api/sites - Site management routes`);
  console.log(`   GET  /api/users - User management routes`);
  console.log(`   GET  /api/data - Data management routes`);
  console.log(`   GET  /api/device - Device management routes`);
});

// Self-ping mechanism to keep server running when deployed on Render
const pingInterval = setInterval(() => {
  const baseUrl = process.env.DEPLOYED_URL ;
  const url = `${baseUrl}/ping`;
  
  console.log(`🔄 Self-pinging Main Server at ${url}...`);
  
  fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Render-Keep-Alive/1.0'
    },
    timeout: 10000
  })
    .then(response => {
      if (response.ok) {
        console.log('✅ Self-ping successful - Main Server kept awake');
      } else {
        console.log('⚠️ Self-ping failed - Response not OK:', response.status);
      }
    })
    .catch(error => {
      console.log('❌ Self-ping failed:', error.message);
    });
}, 5 * 60 * 1000); // Ping every 5 minutes

// Cleanup on process exit
process.on('SIGINT', () => {
  console.log('🛑 Shutting down Main Server...');
  clearInterval(pingInterval);
  if (mqttClient) {
    mqttClient.end();
    console.log('🔌 MQTT client disconnected');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down Main Server...');
  clearInterval(pingInterval);
  if (mqttClient) {
    mqttClient.end();
    console.log('🔌 MQTT client disconnected');
  }
  process.exit(0);
}); 