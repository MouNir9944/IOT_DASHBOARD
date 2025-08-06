// mqttClient.js

import mqtt from 'mqtt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Site, Device } from '../models/Site.js';

dotenv.config(); // Load environment variables from .env file

let client;
let topics = [];
let deviceMap = {}; // Maps deviceId -> { siteDbName, siteName, siteId, type, deviceName }
let siteConnections = {}; // Cache DB connections

function connectMQTT(brokerUrl = process.env.MQTT_BROKER_URL ) {
  // Ensure URL has protocol
  if (brokerUrl && !brokerUrl.startsWith('mqtt://') && !brokerUrl.startsWith('mqtts://')) {
    brokerUrl = 'mqtt://' + brokerUrl;
  }
  
  console.log(`🔌 Connecting to MQTT broker: ${brokerUrl}`);
  client = mqtt.connect(brokerUrl);

  client.on('connect', () => {
    console.log('🔌 MQTT Connected');
    if (topics.length) {
      topics.forEach(topic => client.subscribe(topic));
      console.log(`📡 Subscribed to topics: ${topics.join(', ')}`);
    }
  });

  client.on('error', err => {
    console.error('❌ MQTT Error:', err.message);
  });

  client.on('message', async (topic, messageBuffer) => {
    try {
      const messageString = messageBuffer.toString();
      console.log('📥 Raw MQTT message string:', messageString);
      
      const data = JSON.parse(messageString);
      console.log('📥 Parsed MQTT message:', JSON.stringify(data, null, 2));
      
      // Handle both old and new message formats
      const { deviceId, timestamp } = data;
      
      // Extract value - check new format first, then old format
      let value = data.value; // New format
      if (value === undefined) {
        // Try old format fields
        value = data.consumption || data.production || 0;
      }
      
      // Extract unit - use provided unit or default for device type
      let unit = data.unit;
      if (!unit) {
        const meta = deviceMap[deviceId];
        unit = meta ? getDefaultUnit(meta.type) : 'unit';
      }
      
      console.log('📋 Extracted fields:', { deviceId, timestamp, value, unit, format: data.value !== undefined ? 'new' : 'old' });

      const meta = deviceMap[deviceId];
      if (!meta) {
        console.warn(`⚠️ Unknown deviceId "${deviceId}" from topic "${topic}"`);
        return;
      }

      const { siteDbName, siteName, siteId, type, deviceName } = meta;

      // Create or get site DB connection
      if (!siteConnections[siteDbName]) {
        siteConnections[siteDbName] = mongoose.createConnection(process.env.MONGO_URI, {
          dbName: siteDbName,
          serverSelectionTimeoutMS: 30000,
        });

        siteConnections[siteDbName].on('error', err => {
          console.error(`❌ DB error for site DB "${siteDbName}":`, err.message);
        });

        siteConnections[siteDbName].on('connected', () => {
          console.log(`✅ Connected to site DB: ${siteDbName}`);
        });
      }

      const siteDB = siteConnections[siteDbName];

      // Define the collection model (collection name is device type)
      const collectionName = type;
      const DeviceDataModel = siteDB.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);

      // Save the message data
      const dataToSave = {
        deviceId,
        deviceName,
        siteId,
        siteName,
        type,
        value: value || 0,
        unit: unit || getDefaultUnit(type),
        timestamp: timestamp ? (typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)) : new Date(),
        _id: new mongoose.Types.ObjectId(),
        ...data // Include any additional fields from the message
      };

      await DeviceDataModel.create(dataToSave);

      console.log(`✅ Data saved: Site="${siteName}", DB="${siteDbName}", Collection="${collectionName}", Device="${deviceId}", Value=${value}`);

      // Also update the last reading in the main Device collection
      await updateDeviceLastReading(deviceId, value, unit, timestamp);

    } catch (err) {
      console.error('❌ Failed to process MQTT message:', err.message);
    }
  });
}

// Helper function to update device last reading in main DB
async function updateDeviceLastReading(deviceId, value, unit, timestamp) {
  try {
    const mainDB = mongoose.createConnection(process.env.MONGO_URI || 'mongodb://localhost:27017', {
      dbName: 'iot_dashboard',
      serverSelectionTimeoutMS: 30000
    });

    const Device = mainDB.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');
    
    await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          'lastReading.value': value,
          'lastReading.unit': unit,
          'lastReading.timestamp': timestamp ? new Date(timestamp) : new Date()
        }
      }
    );

    console.log(`🔄 Updated last reading for device ${deviceId}: ${value} ${unit}`);
    await mainDB.close();
  } catch (error) {
    console.error(`❌ Failed to update last reading for device ${deviceId}:`, error.message);
  }
}

// Helper function to get default unit for device type
function getDefaultUnit(type) {
  const units = {
    energy: 'kWh',
    solar: 'kWh',
    water: 'm³',
    gas: 'm³',
    temperature: '°C',
    humidity: '%',
    pressure: 'Pa'
  };
  return units[type] || 'unit';
}

export default {
  async connect(mainDB) {
    // Unsubscribe from all old topics if client exists
    if (client && topics.length) {
      for (const topic of topics) {
        client.unsubscribe(topic);
      }
      topics = [];
      deviceMap = {};
    }

    // Build device map and topics from Device collection
    const Device = mainDB.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');
    const Site = mainDB.model('Site', new mongoose.Schema({}, { strict: false }), 'sites');
    
    // Get all devices with their site information
    const devices = await Device.find({ status: 'active' }).lean();
    const sites = await Site.find({}).lean();
    
    // Create a site map for quick lookup
    const siteMap = {};
    sites.forEach(site => {
      siteMap[site._id.toString()] = site;
    });

    const newDeviceTopics = [];

    console.log('🔨 Building device map from Device collection...');
    
    for (const device of devices) {
      if (!device.deviceId || !device.siteId) continue;
      
      const site = siteMap[device.siteId.toString()];
      if (!site) {
        console.warn(`⚠️ Site not found for device ${device.deviceId}`);
        continue;
      }

      const siteDbName = site.name.replace(/\s+/g, '_').toLowerCase();
      
      deviceMap[device.deviceId] = {
        siteDbName,
        siteName: site.name,
        siteId: device.siteId.toString(),
        type: device.type,
        deviceName: device.name
      };
      
      // MQTT topic format: device/{deviceId}/data
      newDeviceTopics.push(`device/${device.deviceId}/data`);
      console.log(`  📱 Found device: ${device.name} (${device.deviceId}) -> Site: ${site.name}`);
    }
    
    console.log(`📊 Device map loaded: ${Object.keys(deviceMap).length} devices from ${sites.length} sites`);

    topics = newDeviceTopics;

    // (Re)connect MQTT client
    if (client) {
      // End old client and create a new one
      client.end(true, () => {
        connectMQTT();
      });
    } else {
      connectMQTT();
    }
  },

  updateSubscriptions(newTopics) {
    if (!client) return;

    const oldTopics = new Set(topics);
    const newSet = new Set(newTopics);

    // Subscribe to new topics
    for (const topic of newSet) {
      if (!oldTopics.has(topic)) {
        client.subscribe(topic);
        console.log(`➕ Subscribed to new topic: ${topic}`);
      }
    }

    // Unsubscribe from removed topics
    for (const topic of oldTopics) {
      if (!newSet.has(topic)) {
        client.unsubscribe(topic);
        console.log(`➖ Unsubscribed from topic: ${topic}`);
      }
    }

    topics = newTopics;
  },

  // Method to reinitialize subscriptions when devices are added/removed
  async reinitialize(mainDB) {
    console.log('🔄 Reinitializing MQTT subscriptions...');
    await this.connect(mainDB);
  },

  // Get current status
  getStatus() {
    return {
      connected: client ? client.connected : false,
      deviceCount: Object.keys(deviceMap).length,
      topicCount: topics.length,
      devices: deviceMap
    };
  },

  // Disconnect client
  disconnect() {
    if (client) {
      client.end();
      console.log('🔌 MQTT client disconnected');
    }
  }
};

console.log('📊 MQTT Client initialized');


