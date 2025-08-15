import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import mqttClient from './routes/mqttClient.js';
import { Site, Device } from './models/Site.js';

dotenv.config();

const app = express();

// CORS configuration for Ubuntu server deployment
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://162.19.25.155:3000',
      'http://162.19.25.155:5000',
      'http://162.19.25.155:5001',
      'http://162.19.25.155:5002',
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

app.use(express.json());


const MONGO_URI = process.env.MONGO_URI ;

const mainDB = mongoose.createConnection(MONGO_URI, {
  dbName: 'iot_dashboard',
  serverSelectionTimeoutMS: 30000
});

// Register schemas on mainDB
mainDB.model('Site', Site.schema, 'sites');
mainDB.model('Device', Device.schema, 'devices');

mainDB.on('connected', () => console.log('✅ Main DB Connected'));
mainDB.on('error', (err) => console.error('❌ Main DB Error:', err));

/**************************************/
// Ping endpoint for keep-alive
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    message: 'MQTT Data Manager is alive',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

/**************************************/
// Index routes for data fetching
app.post('/api/site/:siteId/:type/index', async (req, res) => {
  try {
    const { siteId, type } = req.params;
    
    // Get site info to use proper database name (same as global endpoint)
    const SiteModel = mainDB.model('Site');
    const site = await SiteModel.findById(siteId).lean();
    if (!site) {
      return res.status(404).json({ error: 'Site not found', totalIndex: 0 });
    }
    
    const dbName = site.name.replace(/\s+/g, '_'); // Use site name, same as global endpoint
    
    // Get site-specific database connection
    const siteDB = mongoose.createConnection(MONGO_URI, {
      dbName,
      serverSelectionTimeoutMS: 30000
    });
    
    // Create model for the specific type
    const DataSchema = new mongoose.Schema({}, { strict: false });
    const DataModel = siteDB.model(type, DataSchema, type);
    
    // Get the latest reading for each device and sum them (same logic as main manager)
    // Use aggregation to handle both string and Date timestamps
    const result = await DataModel.aggregate([
      { $match: { value: { $exists: true }, deviceId: { $exists: true } } },
      { 
        $addFields: { 
          timestamp: { 
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: "$timestamp" }, "string"] },
                  then: { $dateFromString: { dateString: "$timestamp" } }
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "double"] },
                  then: { $toDate: "$timestamp" }
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "long"] },
                  then: { $toDate: "$timestamp" }
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "int"] },
                  then: { $toDate: "$timestamp" }
                },
                {
                  case: { $eq: [{ $type: "$timestamp" }, "date"] },
                  then: "$timestamp"
                }
              ],
              default: new Date()
            }
          }
        }
      },
      { $sort: { deviceId: 1, timestamp: -1 } },
      { $group: { _id: "$deviceId", lastReading: { $first: "$value" } } },
      { $group: { _id: null, totalIndex: { $sum: "$lastReading" } } }
    ]);
    
    let totalIndex = 0;
    if (result.length > 0) {
      totalIndex = result[0].totalIndex || 0;
    }
    
    await siteDB.close();
    
    res.json({ totalIndex });
  } catch (error) {
    console.error('Error fetching site index:', error);
    res.status(500).json({ error: 'Failed to fetch site index', totalIndex: 0 });
  }
});

// Global index routes for all sites
app.post('/api/global/:type/index', async (req, res) => {
  try {
    const { type } = req.params;
    const { siteIds } = req.body;
    
    let totalIndex = 0;
    
    for (const siteId of siteIds) {
      try {
        // Get site info to use proper database name (same as main manager)
        const SiteModel = mainDB.model('Site');
        const site = await SiteModel.findById(siteId).lean();
        if (!site) continue;
        
        const dbName = site.name.replace(/\s+/g, '_'); // Use site name, same as main manager
        
        const siteDB = mongoose.createConnection(MONGO_URI, {
          dbName,
          serverSelectionTimeoutMS: 30000
        });
        
        const DataSchema = new mongoose.Schema({}, { strict: false });
        const DataModel = siteDB.model(type, DataSchema, type);
        
        // Use aggregation to handle both string and Date timestamps (same logic as main manager)
        const result = await DataModel.aggregate([
          { $match: { value: { $exists: true }, deviceId: { $exists: true } } },
          { 
            $addFields: { 
              timestamp: { 
                $cond: {
                  if: { $type: "$timestamp" },
                  then: {
                    $cond: {
                      if: { $eq: [{ $type: "$timestamp" }, "string"] },
                      then: { $dateFromString: { dateString: "$timestamp" } },
                      else: "$timestamp"
                    }
                  },
                  else: new Date()
                }
              }
            }
          },
          { $sort: { deviceId: 1, timestamp: -1 } },
          { $group: { _id: "$deviceId", lastReading: { $first: "$value" } } },
          { $group: { _id: null, totalIndex: { $sum: "$lastReading" } } }
        ]);
        
        if (result.length > 0) {
          totalIndex += result[0].totalIndex || 0;
        }
        
        await siteDB.close();
      } catch (siteError) {
        console.error(`Error fetching data for site ${siteId}:`, siteError);
      }
    }
    
    res.json({ totalIndex });
  } catch (error) {
    console.error('Error fetching global index:', error);
    res.status(500).json({ error: 'Failed to fetch global index', totalIndex: 0 });
  }
});

/**************************************/
// MQTT Management Routes

// Get MQTT status
app.get('/api/mqtt/status', (req, res) => {
  try {
    const status = mqttClient.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get MQTT status:', error);
    res.status(500).json({ error: 'Failed to get MQTT status', details: error.message });
  }
});

// Email endpoints removed: email sending has been disabled in data manager backend.

// Test connection to main manager
app.get('/api/test-main-manager', async (req, res) => {
  try {
    const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
    console.log(`🔍 Testing connection to main manager at: ${mainManagerUrl}`);
    
    const response = await fetch(`${mainManagerUrl}/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log('✅ Main manager connection test successful');
      res.json({
        success: true,
        message: 'Main manager is reachable',
        mainManagerUrl,
        response: data
      });
    } else {
      console.error(`❌ Main manager connection test failed: ${response.status} ${response.statusText}`);
      res.status(500).json({
        success: false,
        message: `Main manager connection failed: ${response.status} ${response.statusText}`,
        mainManagerUrl
      });
    }
  } catch (error) {
    console.error('❌ Main manager connection test error:', error.message);
    res.status(500).json({
      success: false,
      message: `Main manager connection error: ${error.message}`,
      mainManagerUrl: process.env.MAIN_MANAGER_URL || 'http://localhost:5000'
    });
  }
});

// Assign users to device alerts
app.post('/api/devices/:deviceId/alerts/:alertId/assign-users', async (req, res) => {
  try {
    const { deviceId, alertId } = req.params;
    const { userIds, groupIds, action } = req.body; // action: 'add' or 'remove'
    
    console.log(`🔧 Assigning users to alert: deviceId=${deviceId}, alertId=${alertId}, action=${action}`);
    
    // Connect to main database
    const mainDB = mongoose.createConnection(process.env.MONGO_URI, {
      dbName: 'iot_dashboard',
      serverSelectionTimeoutMS: 30000
    });

    const Device = mainDB.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');
    
    // Find the device
    const device = await Device.findOne({ deviceId }).lean();
    if (!device) {
      await mainDB.close();
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Find the alert configuration
    const alertConfig = device.alertConfigurations?.find(alert => alert.id === alertId);
    if (!alertConfig) {
      await mainDB.close();
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }
    
    // Initialize assignedUsers array if it doesn't exist
    if (!alertConfig.assignedUsers) {
      alertConfig.assignedUsers = [];
    }
    
    // Initialize assignedGroups array if it doesn't exist
    if (!alertConfig.assignedGroups) {
      alertConfig.assignedGroups = [];
    }
    
    if (action === 'add') {
      // Add users
      if (userIds && userIds.length > 0) {
        for (const userId of userIds) {
          if (!alertConfig.assignedUsers.includes(userId)) {
            alertConfig.assignedUsers.push(userId);
          }
        }
      }
      
      // Add groups
      if (groupIds && groupIds.length > 0) {
        for (const groupId of groupIds) {
          if (!alertConfig.assignedGroups.includes(groupId)) {
            alertConfig.assignedGroups.push(groupId);
          }
        }
      }
    } else if (action === 'remove') {
      // Remove users
      if (userIds && userIds.length > 0) {
        alertConfig.assignedUsers = alertConfig.assignedUsers.filter(id => !userIds.includes(id));
      }
      
      // Remove groups
      if (groupIds && groupIds.length > 0) {
        alertConfig.assignedGroups = alertConfig.assignedGroups.filter(id => !groupIds.includes(id));
      }
    }
    
    // Update the device
    await Device.findOneAndUpdate(
      { deviceId },
      { $set: { alertConfigurations: device.alertConfigurations } }
    );
    
    await mainDB.close();
    
    console.log(`✅ Successfully ${action}ed users/groups to alert ${alertId}`);
    
    res.json({
      success: true,
      message: `Successfully ${action}ed users/groups to alert`,
      alertConfig: {
        id: alertConfig.id,
        title: alertConfig.title,
        assignedUsers: alertConfig.assignedUsers,
        assignedGroups: alertConfig.assignedGroups
      }
    });
    
  } catch (error) {
    console.error('❌ Error assigning users to alert:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to assign users to alert',
      error: error.message
    });
  }
});

// Get users and groups for assignment
app.get('/api/users-groups', async (req, res) => {
  try {
    const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
    
    // Fetch users
    const usersResponse = await fetch(`${mainManagerUrl}/api/users`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'DataManager/1.0'
      },
      timeout: 10000
    });
    
    let users = [];
    if (usersResponse.ok) {
      users = await usersResponse.json();
    }
    
    // Fetch groups (if groups API exists)
    let groups = [];
    try {
      const groupsResponse = await fetch(`${mainManagerUrl}/api/groups`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'DataManager/1.0'
        },
        timeout: 10000
      });
      
      if (groupsResponse.ok) {
        groups = await groupsResponse.json();
      }
    } catch (error) {
      console.log('⚠️ Groups API not available, using empty groups array');
    }
    
    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      })),
      groups: groups.map(group => ({
        id: group._id,
        name: group.name,
        description: group.description
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching users and groups:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users and groups',
      error: error.message
    });
  }
});

// Reinitialize MQTT client (called when devices are added/removed)
app.post('/api/mqtt/reinitialize', async (req, res) => {
  try {
    console.log('🔄 MQTT reinitialize request received');
    await mqttClient.reinitialize(mainDB);
    const status = mqttClient.getStatus();
    res.status(200).json({ 
      message: 'MQTT client reinitialized successfully',
      status
    });
  } catch (error) {
    console.error('Failed to reinitialize MQTT client:', error);
    res.status(500).json({ error: 'Failed to reinitialize MQTT client', details: error.message });
  }
});

mainDB.once('connected', () => {
  mqttClient.connect( mainDB);
});


const PORT_SERVER = process.env.PORT_SERVER || 5001; // Use environment variable or default to 5001

mainDB.once('connected', () => {
  app.listen(PORT_SERVER, '0.0.0.0', () => {
    console.log(`🚀 Data Manager Server running on port ${PORT_SERVER}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /ping - Health check endpoint`);
    console.log(`   GET  /api/mqtt/status - MQTT client status`);
    console.log(`   POST /api/mqtt/reinitialize - Reinitialize MQTT subscriptions`);
    console.log(`   POST /api/site/:siteId/:type/index - Get site-specific data index`);
    console.log(`   POST /api/global/:type/index - Get global data index`);
    console.log(`   GET  /api/users-groups - Get users and groups for assignment`);
    console.log(`   POST /api/devices/:deviceId/alerts/:alertId/assign-users - Assign users/groups to alerts`);
  });
});




