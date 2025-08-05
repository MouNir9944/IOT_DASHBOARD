import express from 'express';
import Site from '../models/Site.js';
import Device from '../models/Device.js';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to reinitialize MQTT subscriptions
async function reinitializeMQTT() {
  try {
    console.log('🔄 Reinitializing MQTT subscriptions...');
    const response = await fetch('http://localhost:5001/api/mqtt/reinitialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ MQTT subscriptions reinitialized successfully');
      console.log('📊 MQTT Status:', result.status);
    } else {
      console.warn('⚠️ Failed to reinitialize MQTT subscriptions:', response.status);
    }
  } catch (error) {
    console.error('❌ Could not connect to MQTT Data Manager service:', error.message);
    console.log('💡 Make sure the MQTT Data Manager is running on port 5001');
  }
}

// GET /api/device - get all devices across all sites
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find({}).populate('siteId', 'name');
    
    const devicesWithSiteInfo = devices.map(device => ({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    }));
    
    res.json(devicesWithSiteInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/device/:deviceId - get a specific device by deviceId
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/device/site/:siteId - create a new device for a specific site
router.post('/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { deviceId, type, name, description, status, threshold, readingInterval, alertEnabled, maintenanceSchedule } = req.body;
    
    // Check if deviceId already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ error: 'Device ID already exists' });
    }
    
    // Find the target site
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Create new device in Device collection
    const newDevice = new Device({
      deviceId,
      type,
      name,
      description,
      status: status || 'active',
      siteId,
      threshold: threshold || 0,
      readingInterval: readingInterval || 5,
      alertEnabled: alertEnabled !== undefined ? alertEnabled : true,
      maintenanceSchedule: maintenanceSchedule || 'monthly',
      lastReading: {
        value: 0,
        unit: getDefaultUnit(type),
        timestamp: new Date()
      }
    });
    
    const savedDevice = await newDevice.save();
    
    // Add device ObjectId to site's devices array
    site.devices.push(savedDevice._id);
    await site.save();
    
    // Reinitialize MQTT subscriptions
    await reinitializeMQTT();
    
    res.status(201).json({
      ...savedDevice.toObject(),
      siteName: site.name,
      siteId: site._id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/device/:deviceId - update a device
router.put('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, name, description, status, lastReading, threshold, readingInterval, alertEnabled, maintenanceSchedule } = req.body;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Update device fields
    if (type) device.type = type;
    if (name) device.name = name;
    if (description !== undefined) device.description = description;
    if (status) device.status = status;
    if (threshold !== undefined) device.threshold = threshold;
    if (readingInterval !== undefined) device.readingInterval = readingInterval;
    if (alertEnabled !== undefined) device.alertEnabled = alertEnabled;
    if (maintenanceSchedule) device.maintenanceSchedule = maintenanceSchedule;
    if (lastReading) device.lastReading = lastReading;
    
    const updatedDevice = await device.save();
    
    // Reinitialize MQTT subscriptions if status changed (affects subscriptions)
    await reinitializeMQTT();
    
    res.json({
      ...updatedDevice.toObject(),
      siteName: updatedDevice.siteId.name,
      siteId: updatedDevice.siteId._id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/device/:deviceId - delete a device
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Remove device ObjectId from site's devices array
    await Site.findByIdAndUpdate(device.siteId, {
      $pull: { devices: device._id }
    });
    
    // Delete the device from Device collection
    await Device.findByIdAndDelete(device._id);
    
    // Reinitialize MQTT subscriptions
    await reinitializeMQTT();
    
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/device/site/:siteId - get all devices for a specific site
router.get('/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const devices = await Device.find({ siteId }).populate('siteId', 'name');
    
    const devicesWithSiteInfo = devices.map(device => ({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    }));
    
    res.json(devicesWithSiteInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/device/site/:siteId/:deviceId - update a specific device in a specific site
router.put('/site/:siteId/:deviceId', async (req, res) => {
  try {
    const { siteId, deviceId } = req.params;
    const { type, name, description, status, lastReading, threshold, readingInterval, alertEnabled, maintenanceSchedule } = req.body;
    
    // Find device that belongs to the specific site
    const device = await Device.findOne({ deviceId, siteId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found in this site' });
    }
    
    // Update device fields
    if (type) device.type = type;
    if (name) device.name = name;
    if (description !== undefined) device.description = description;
    if (status) device.status = status;
    if (threshold !== undefined) device.threshold = threshold;
    if (readingInterval !== undefined) device.readingInterval = readingInterval;
    if (alertEnabled !== undefined) device.alertEnabled = alertEnabled;
    if (maintenanceSchedule) device.maintenanceSchedule = maintenanceSchedule;
    if (lastReading) device.lastReading = lastReading;
    
    const updatedDevice = await device.save();
    
    // Reinitialize MQTT subscriptions if status changed (affects subscriptions)
    await reinitializeMQTT();
    
    res.json({
      ...updatedDevice.toObject(),
      siteName: updatedDevice.siteId.name,
      siteId: updatedDevice.siteId._id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/device/site/:siteId/:deviceId - delete a specific device from a specific site
router.delete('/site/:siteId/:deviceId', async (req, res) => {
  try {
    const { siteId, deviceId } = req.params;
    
    // Find device that belongs to the specific site
    const device = await Device.findOne({ deviceId, siteId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found in this site' });
    }
    
    // Remove device ObjectId from site's devices array
    await Site.findByIdAndUpdate(siteId, {
      $pull: { devices: device._id }
    });
    
    // Delete the device from Device collection
    await Device.findByIdAndDelete(device._id);
    
    // Reinitialize MQTT subscriptions
    await reinitializeMQTT();
    
    res.json({ 
      message: 'Device deleted successfully',
      siteId: device.siteId._id,
      siteName: device.siteId.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/device/site/:siteId/:deviceId - get a specific device from a specific site
router.get('/site/:siteId/:deviceId', async (req, res) => {
  try {
    const { siteId, deviceId } = req.params;
    
    // Find device that belongs to the specific site
    const device = await Device.findOne({ deviceId, siteId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found in this site' });
    }
    
    res.json({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/device/type/:type - get all devices of a specific type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    const devices = await Device.find({ type }).populate('siteId', 'name');
    
    const devicesWithSiteInfo = devices.map(device => ({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    }));
    
    res.json(devicesWithSiteInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/device/:deviceId/reading - update device reading (global search)
router.patch('/:deviceId/reading', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { value, unit, timestamp } = req.body;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    device.lastReading = {
      value: value !== undefined ? value : device.lastReading.value,
      unit: unit || device.lastReading.unit,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };
    
    const updatedDevice = await device.save();
    
    res.json({
      message: 'Device reading updated successfully',
      reading: updatedDevice.lastReading,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/device/site/:siteId/:deviceId/reading - update device reading for specific site
router.patch('/site/:siteId/:deviceId/reading', async (req, res) => {
  try {
    const { siteId, deviceId } = req.params;
    const { value, unit, timestamp } = req.body;
    
    // Find device that belongs to the specific site
    const device = await Device.findOne({ deviceId, siteId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found in this site' });
    }
    
    device.lastReading = {
      value: value !== undefined ? value : device.lastReading.value,
      unit: unit || device.lastReading.unit,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };
    
    const updatedDevice = await device.save();
    
    res.json({
      message: 'Device reading updated successfully',
      reading: updatedDevice.lastReading,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

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

export default router;