import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import mqttClient from './routes/mqttClient.js';
import { Site, Device } from './models/Site.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

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


const PORT = 5001; // Force port 5001 for data manager

mainDB.once('connected', () => {
  app.listen(PORT, () => {
    console.log(`🚀 Data Manager Server running on port ${PORT}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /ping - Health check endpoint`);
    console.log(`   GET  /api/mqtt/status - MQTT client status`);
    console.log(`   POST /api/mqtt/reinitialize - Reinitialize MQTT subscriptions`);
    console.log(`   POST /api/site/:siteId/:type/index - Get site-specific data index`);
    console.log(`   POST /api/global/:type/index - Get global data index`);
  });
});

// Self-ping mechanism to keep server running when deployed on Render
const pingInterval = setInterval(() => {
  const baseUrl = process.env.DEPLOYED_URL || `http://localhost:${PORT}`;
  const url = `${baseUrl}/ping`;
  
  console.log(`🔄 Self-pinging MQTT Data Manager server at ${url}...`);
  
  fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Render-Keep-Alive/1.0'
    },
    timeout: 10000
  })
    .then(response => {
      if (response.ok) {
        console.log('✅ Self-ping successful - MQTT Data Manager kept awake');
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
  console.log('🛑 Shutting down MQTT Data Manager server...');
  clearInterval(pingInterval);
  mqttClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down MQTT Data Manager server...');
  clearInterval(pingInterval);
  mqttClient.disconnect();
  process.exit(0);
});


