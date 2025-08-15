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
import notificationRoutes from './routes/notifications.js';

// Load environment variables
dotenv.config();

const app = express();

// Create HTTP server and Socket.IO server
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Define allowed origins
      const allowedOrigins = [
        'http://localhost:8000',
        'http://localhost:8001',
        'http://162.19.25.155:8000',
        'http://162.19.25.155:8001',
        process.env.CORS_ORIGIN
      ].filter(Boolean); // Remove undefined values
      
      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`🚫 Socket.IO CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by Socket.IO CORS'));
      }
    },
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

// WebSocket connection handling with improved cleanup
io.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected:', socket.id);
  
  // Initialize client subscriptions tracking
  clientSubscriptions.set(socket.id, new Set());
  
  // Set a timeout for client inactivity
  const clientTimeout = setTimeout(() => {
    console.log(`⏰ Client ${socket.id} inactive for too long, disconnecting...`);
    socket.disconnect(true);
  }, 300000); // 5 minutes timeout
  
  // Handle device subscription with timeout protection
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
  
  // Handle device unsubscription with timeout protection
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
        // Use setTimeout to prevent blocking the event loop
        setTimeout(() => {
          unsubscribeFromDevice(deviceId);
        }, 100);
        console.log(`📡 No other clients subscribed to ${deviceId}, unsubscribing from MQTT topic`);
      }
    } catch (error) {
      console.error('❌ Error in unsubscribe-device:', error.message);
    }
  });
  
  // Handle client disconnect with improved cleanup
  socket.on('disconnect', (reason) => {
    console.log(`🔌 WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
    
    // Clear the client timeout
    clearTimeout(clientTimeout);
    
    try {
      // Get all devices this client was subscribed to
      const clientDevices = clientSubscriptions.get(socket.id);
      if (clientDevices) {
        console.log(`📡 Client ${socket.id} was subscribed to devices:`, Array.from(clientDevices));
        
        // Use setTimeout to prevent blocking the event loop during cleanup
        setTimeout(() => {
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
        }, 100);
      }
      
      // Clean up client subscriptions
      clientSubscriptions.delete(socket.id);
      console.log(`🧹 Cleaned up subscriptions for client ${socket.id}`);
    } catch (error) {
      console.error('❌ Error in socket disconnect cleanup:', error.message);
    }
  });
  
  // Handle client errors
  socket.on('error', (error) => {
    console.error(`❌ WebSocket client error for ${socket.id}:`, error.message);
  });
});

// Export io for use in other modules
export { io };

// Security middleware
app.use(helmet());

// CORS configuration for frontend
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:8000',
      'http://162.19.25.155:8000',

      process.env.CORS_ORIGIN
    ].filter(Boolean); // Remove undefined values
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - exclude SSE endpoints, frequently called notification endpoints, sites endpoint, devices endpoint, and data endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for SSE endpoints, frequently called notification endpoints, sites endpoint, devices endpoint, and data endpoints
    const shouldSkip = req.path.startsWith('/api/notifications/stream') || 
           req.path.startsWith('/api/notifications/sse') ||
           req.path === '/api/notifications/count' ||
           req.path === '/api/notifications/email-status' ||
           req.path.startsWith('/api/notifications/test-') ||
           req.path === '/api/sites' ||
           req.path.startsWith('/api/sites/') ||
           req.path === '/api/devices' ||
           req.path.startsWith('/api/data/site/');
    
    if (shouldSkip) {
      console.log(`🚫 Main limiter skipped for: ${req.path}`);
    }
    
    return shouldSkip;
  },
  handler: (req, res) => {
    console.log(`🚫 Main rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      path: req.path,
      ip: req.ip,
      retryAfter: Math.ceil(15 * 60 / 60) // minutes
    });
  }
});

// Apply the main rate limiter
app.use(limiter);

// Special rate limiter for notification endpoints with higher limits
// Note: This limiter is applied globally but skips sites, devices, and data endpoints
// to avoid interfering with the main limiter's exclusions
const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute for notification endpoints
  message: 'Too many notification requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for frequently called notification endpoints, sites, devices, and data endpoints
    const shouldSkip = req.path === '/api/notifications/count' ||
           req.path === '/api/notifications/email-status' ||
           req.path.startsWith('/api/notifications/test-') ||
           req.path.startsWith('/api/notifications/stream') ||
           req.path.startsWith('/api/notifications/sse') ||
           req.path === '/api/sites' ||
           req.path.startsWith('/api/sites/') ||
           req.path === '/api/devices' ||
           req.path.startsWith('/api/data/site/');
    
    if (shouldSkip) {
      console.log(`🚫 Notification rate limiting skipped for: ${req.path}`);
    }
    
    return shouldSkip;
  },
  handler: (req, res) => {
    console.log(`🚫 Notification rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many notification requests from this IP, please try again later.',
      path: req.path,
      ip: req.ip,
      retryAfter: Math.ceil(1) // 1 minute
    });
  }
});

// Apply notification rate limiter after the main limiter
app.use(notificationLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware to prevent hanging requests
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    console.warn(`⏰ Request timeout for ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  }, 30000); // 30 second timeout
  
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  next();
});

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
let mqttConnectionTimeout = null;
let mqttReconnectTimer = null;

// MQTT connection function with improved error handling
function connectMQTT(brokerUrl = process.env.MQTT_BROKER_URL) {
  console.log('🚀 Connecting to MQTT broker:', brokerUrl);
  
  // Clear any existing timers
  if (mqttConnectionTimeout) {
    clearTimeout(mqttConnectionTimeout);
    mqttConnectionTimeout = null;
  }
  if (mqttReconnectTimer) {
    clearTimeout(mqttReconnectTimer);
    mqttReconnectTimer = null;
  }
  
  // Clean up existing client if it exists
  if (mqttClient) {
    try {
      mqttClient.removeAllListeners();
      mqttClient.end(true, () => {
        console.log('🔌 Previous MQTT client cleaned up');
      });
    } catch (error) {
      console.log('⚠️ Error cleaning up previous MQTT client:', error.message);
    }
  }
  
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `iot_dashboard_main_${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 0, // Disable automatic reconnection, we'll handle it manually
    keepalive: 60,
    reschedulePings: true,
    rejectUnauthorized: false // Add this for better connection stability
  });

  // Set connection timeout
  mqttConnectionTimeout = setTimeout(() => {
    if (mqttClient && !mqttClient.connected) {
      console.log('⏰ MQTT connection timeout, retrying...');
      mqttClient.end(true);
      scheduleMQTTReconnect();
    }
  }, 35000); // 35 seconds (longer than connectTimeout)

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log('📡 MQTT client ready for dynamic subscriptions');
    mqttReconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Clear connection timeout
    if (mqttConnectionTimeout) {
      clearTimeout(mqttConnectionTimeout);
      mqttConnectionTimeout = null;
    }
    
    // Resubscribe to active topics after reconnection
    if (activeSubscriptions.size > 0) {
      console.log(`🔄 Resubscribing to ${activeSubscriptions.size} topics after reconnection...`);
      activeSubscriptions.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
          if (err) {
            console.error(`❌ Failed to resubscribe to "${topic}":`, err.message);
          } else {
            console.log(`📡 Resubscribed to topic: ${topic}`);
          }
        });
      });
    }
  });

  mqttClient.on('error', err => {
    console.error('❌ MQTT connection error:', err.message);
    mqttReconnectAttempts++;
    
    // Clear connection timeout on error
    if (mqttConnectionTimeout) {
      clearTimeout(mqttConnectionTimeout);
      mqttConnectionTimeout = null;
    }
    
    if (mqttReconnectAttempts >= MAX_MQTT_RECONNECT_ATTEMPTS) {
      console.error('❌ Max MQTT reconnection attempts reached, stopping reconnection');
      return;
    }
    
    // Schedule reconnection with exponential backoff
    scheduleMQTTReconnect();
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
    mqttReconnectAttempts++;
  });

  mqttClient.on('close', () => {
    console.log('🔌 MQTT connection closed');
    
    // Clear connection timeout
    if (mqttConnectionTimeout) {
      clearTimeout(mqttConnectionTimeout);
      mqttConnectionTimeout = null;
    }
    
    // Schedule reconnection if we haven't reached max attempts
    if (mqttReconnectAttempts < MAX_MQTT_RECONNECT_ATTEMPTS) {
      scheduleMQTTReconnect();
    }
  });

  mqttClient.on('offline', () => {
    console.log('📴 MQTT client went offline');
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

// Schedule MQTT reconnection with exponential backoff
function scheduleMQTTReconnect() {
  if (mqttReconnectTimer) {
    clearTimeout(mqttReconnectTimer);
  }
  
  const delay = Math.min(1000 * Math.pow(2, mqttReconnectAttempts), 30000); // Max 30 seconds
  
  console.log(`🔄 Scheduling MQTT reconnection in ${delay}ms (attempt ${mqttReconnectAttempts + 1})`);
  
  mqttReconnectTimer = setTimeout(() => {
    if (mqttReconnectAttempts < MAX_MQTT_RECONNECT_ATTEMPTS) {
      console.log('🔄 Attempting MQTT reconnection...');
      connectMQTT();
    }
  }, delay);
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

// Helper function to unsubscribe from a device topic with improved error handling
function unsubscribeFromDevice(deviceId) {
  try {
    if (!mqttClient) {
      console.log(`⚠️ MQTT client not available, cannot unsubscribe from device: ${deviceId}`);
      return false;
    }

    if (!mqttClient.connected) {
      console.log(`⚠️ MQTT client not connected, cannot unsubscribe from device: ${deviceId}`);
      // Remove from active subscriptions even if not connected
      const topic = `device/${deviceId}/data`;
      activeSubscriptions.delete(topic);
      return false;
    }

    const topic = `device/${deviceId}/data`;
    
    if (!activeSubscriptions.has(topic)) {
      console.log(`📡 Not subscribed to topic: ${topic}`);
      return true;
    }

    console.log(`🔄 Attempting to unsubscribe from MQTT topic: ${topic}`);
    
    // Set a timeout for the unsubscribe operation
    const unsubscribeTimeout = setTimeout(() => {
      console.warn(`⏰ Unsubscribe timeout for topic: ${topic}, forcing cleanup`);
      activeSubscriptions.delete(topic);
    }, 5000); // 5 second timeout
    
    mqttClient.unsubscribe(topic, (err) => {
      // Clear the timeout
      clearTimeout(unsubscribeTimeout);
      
      if (err) {
        console.error(`❌ Failed to unsubscribe from topic "${topic}":`, err.message);
        // Don't remove from activeSubscriptions on error to allow retry
        return false;
      } else {
        console.log(`📡 Successfully unsubscribed from MQTT topic: ${topic}`);
        activeSubscriptions.delete(topic);
        
        // Log MQTT connection status after unsubscribe
        console.log(`📊 MQTT status after unsubscribe: connected=${mqttClient.connected}, subscriptions=${activeSubscriptions.size}`);
        return true;
      }
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Exception during unsubscribe from device ${deviceId}:`, error.message);
    // Force cleanup on exception
    const topic = `device/${deviceId}/data`;
    activeSubscriptions.delete(topic);
    return false;
  }
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
app.use('/api/notifications', notificationRoutes);

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
app.get('/health', async (req, res) => {
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
  
  // Check email configuration
  try {
    const NotificationService = await import('./services/notificationService.js');
    const notificationService = new NotificationService.default();
    health.emailConfigured = !!notificationService.emailTransporter;
    
    if (notificationService.emailTransporter) {
      try {
        await notificationService.emailTransporter.verify();
        health.emailStatus = 'verified';
      } catch (error) {
        health.emailStatus = 'verification_failed';
        health.emailError = error.message;
      }
    } else {
      health.emailStatus = 'not_configured';
    }
  } catch (error) {
    health.emailStatus = 'error';
    health.emailError = error.message;
  }
  
  // Return 503 if MQTT is not connected
  if (!mqttClient || !mqttClient.connected) {
    health.status = 'degraded';
    health.mqttError = 'MQTT connection lost';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Rate limit status endpoint for debugging
app.get('/api/rate-limit-status', (req, res) => {
  res.json({
    message: 'Rate limit status endpoint',
    timestamp: new Date().toISOString(),
    rateLimitInfo: {
      mainLimiter: {
        windowMs: '15 minutes',
        max: 100,
        description: 'General API rate limit'
      },
      notificationLimiter: {
        windowMs: '1 minute',
        max: 300,
        description: 'Notification endpoints rate limit'
      },
      excludedEndpoints: [
        '/api/notifications/stream',
        '/api/notifications/sse',
        '/api/notifications/count',
        '/api/notifications/email-status',
        '/api/notifications/test-*'
      ]
    },
    currentRequest: {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    }
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
      notifications: '/api/notifications',
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
const PORT = process.env.PORT || 8001;
server.listen(PORT, '0.0.0.0', () => {
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
  
  // Check if MQTT connection is stable
  if (mqttClient) {
    const mqttConnected = mqttClient.connected;
    console.log(`📡 MQTT Connection Status: ${mqttConnected ? 'Connected' : 'Disconnected'}`);
    
    // If MQTT is disconnected, try to reconnect
    if (!mqttConnected && mqttReconnectAttempts < MAX_MQTT_RECONNECT_ATTEMPTS) {
      console.log('🔄 Attempting to reconnect MQTT...');
      connectMQTT();
    }
    
    // Log MQTT client state for debugging
    if (mqttClient.reconnecting) {
      console.log('🔄 MQTT client is currently reconnecting...');
    }
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
  

  
  // Test HTTP server responsiveness
  try {
    const testResponse = { status: 'ok', timestamp: Date.now() };
    console.log('✅ HTTP server is responsive');
  } catch (error) {
    console.error('❌ HTTP server responsiveness test failed:', error.message);
  }
  
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

// Quick health check interval (every 2 minutes)
const quickHealthCheckInterval = setInterval(() => {
  try {
    // Check if server is still responsive
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Log quick status
    console.log(`💓 Quick health check: MQTT=${mqttClient?.connected ? 'OK' : 'FAIL'}, Memory=${heapUsedMB}MB, Clients=${clientSubscriptions.size}`);
    
    // Alert if memory usage is too high
    if (heapUsedMB > 300) {
      console.log('🚨 CRITICAL: Memory usage too high, consider restarting server');
    }
    
    // Alert if MQTT is disconnected for too long
    if (mqttClient && !mqttClient.connected && mqttReconnectAttempts >= MAX_MQTT_RECONNECT_ATTEMPTS) {
      console.log('🚨 CRITICAL: MQTT connection lost and max reconnection attempts reached');
    }
    
  } catch (error) {
    console.error('❌ Quick health check failed:', error.message);
  }
}, 2 * 60 * 1000); // Every 2 minutes

// Graceful shutdown function with improved cleanup
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  // Clear all intervals
  clearInterval(internalPingInterval);
  clearInterval(memoryCleanupInterval);
  clearInterval(quickHealthCheckInterval);
  clearInterval(processHealthCheck);
  clearInterval(healthCheckInterval);
  
  // Clear MQTT timers
  if (mqttConnectionTimeout) {
    clearTimeout(mqttConnectionTimeout);
    mqttConnectionTimeout = null;
  }
  if (mqttReconnectTimer) {
    clearTimeout(mqttReconnectTimer);
    mqttReconnectTimer = null;
  }
  
  // Close all socket connections
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
  });
  
  // Disconnect MQTT client
  if (mqttClient) {
    try {
      mqttClient.removeAllListeners();
      mqttClient.end(true, () => {
        console.log('🔌 MQTT client disconnected');
      });
    } catch (error) {
      console.log('⚠️ Error during MQTT disconnect:', error.message);
    }
  }
  
  // Close database connection
  mongoose.connection.close()
    .then(() => {
      console.log('📡 Database connection closed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error closing database connection:', error.message);
      process.exit(1);
    });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Connection health monitoring
let lastRequestTime = Date.now();
let healthCheckInterval;

// Monitor server responsiveness
const startHealthMonitoring = () => {
  healthCheckInterval = setInterval(() => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    // If no requests for 2 minutes, log a warning
    if (timeSinceLastRequest > 120000) { // 2 minutes
      console.log('⚠️  No requests received for 2+ minutes, checking server health...');
      
      // Check if server is still responsive
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        console.log(`📊 Server health check: Memory=${heapUsedMB}MB, MQTT=${mqttClient?.connected ? 'OK' : 'FAIL'}`);
        
        // If memory usage is too high, log warning
        if (heapUsedMB > 500) {
          console.log('🚨 CRITICAL: Memory usage too high, consider restarting server');
        }
        
        // If MQTT is disconnected for too long, try reconnection
        if (mqttClient && !mqttClient.connected && mqttReconnectAttempts < MAX_MQTT_RECONNECT_ATTEMPTS) {
          console.log('🔄 Attempting MQTT reconnection due to health check...');
          connectMQTT();
        }
      } catch (error) {
        console.error('❌ Health monitoring check failed:', error.message);
      }
    }
  }, 60000); // Check every minute
};

// Update last request time on any request
app.use((req, res, next) => {
  lastRequestTime = Date.now();
  next();
});

// Start health monitoring
startHealthMonitoring();

// Process monitoring and recovery
let processHealthCheck = setInterval(() => {
  try {
    // Check if process is responsive
    const start = Date.now();
    
    // Simple operation to test responsiveness
    const test = Math.random() * 1000;
    
    const end = Date.now();
    const responseTime = end - start;
    
    // If response time is too high, log warning
    if (responseTime > 100) {
      console.warn(`⚠️  Slow process response time: ${responseTime}ms`);
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Log process health every 5 minutes
    if (Date.now() % 300000 < 60000) { // Every 5 minutes
      console.log(`💓 Process health: Memory=${heapUsedMB}MB, Uptime=${Math.round(process.uptime())}s`);
    }
    
  } catch (error) {
    console.error('❌ Process health check failed:', error.message);
  }
}, 60000); // Every minute

// Enhanced error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('❌ Stack trace:', error.stack);
  
  // Try to log additional system information
  try {
    const memUsage = process.memoryUsage();
    console.error('📊 Memory usage at crash:', memUsage);
    console.error('📊 Process uptime:', process.uptime());
  } catch (logError) {
    console.error('❌ Failed to log crash info:', logError.message);
  }
  
  gracefulShutdown('uncaughtException');
});

// Enhanced error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  
  // Try to log additional information
  try {
    if (reason instanceof Error) {
      console.error('❌ Rejection stack:', reason.stack);
    }
  } catch (logError) {
    console.error('❌ Failed to log rejection details:', logError.message);
  }
  
  gracefulShutdown('unhandledRejection');
});

// Handle shutdown signals with improved cleanup
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); 