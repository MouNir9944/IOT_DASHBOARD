import express from 'express';
import Site from '../models/Site.js';
import Device from '../models/Device.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

// Logging middleware for all device routes
router.use((req, res, next) => {
  console.log(`📡 Device API - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Helper function to reinitialize MQTT subscriptions
async function reinitializeMQTT() {
  try {
    console.log('🔄 Reinitializing MQTT subscriptions...');
    const mqttDataManagerUrl = process.env.MQTT_DATA_MANAGER_URL ;
    const response = await fetch(`${mqttDataManagerUrl}/api/mqtt/reinitialize`, {
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
    console.log(`💡 Make sure the MQTT Data Manager is running at ${process.env.MQTT_DATA_MANAGER_URL }`);
  }
}
// GET /api/device - get all devices across all sites
router.get('/', async (req, res) => {
  try {
    console.log(`📊 GET /api/devices - IP: ${req.ip}`);
    
    const devices = await Device.find({}).populate('siteId', 'name');
    
    const devicesWithSiteInfo = devices.map(device => ({
      ...device.toObject(),
      siteName: device.siteId.name,
      siteId: device.siteId._id
    }));
    
    console.log(`✅ GET /api/devices - Returning ${devicesWithSiteInfo.length} devices`);
    res.json(devicesWithSiteInfo);
  } catch (error) {
    console.error(`❌ GET /api/devices - Error: ${error.message}`);
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

// Alert Management Routes

// POST /api/device/:deviceId/alerts - Add alert configuration to device
router.post('/:deviceId/alerts', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      title, 
      message, 
      type, 
      priority, 
      category, 
      parameter, 
      threshold, 
      condition, 
      createdBy, 
      emailEnabled, 
      periodicity, 
      assignedUsers: requestAssignedUsers,
      schedule
    } = req.body;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Generate unique alert ID
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle assigned users - prioritize request assignedUsers, then fallback to creator
    let assignedUsers = [];
    
    // If assignedUsers are provided in the request, use them
    if (requestAssignedUsers && Array.isArray(requestAssignedUsers) && requestAssignedUsers.length > 0) {
      assignedUsers = requestAssignedUsers;
      console.log(`📧 Using provided assignedUsers: ${assignedUsers.join(', ')} for alert: ${alertId}`);
    }
    // If createdBy is provided and no assignedUsers were provided, automatically assign them
    else if (createdBy) {
      // Find the user by email to get their email for assignment
      const user = await User.findOne({ email: createdBy });
      if (user) {
        assignedUsers = [createdBy]; // Use email for assignment
        console.log(`📧 Automatically assigned creator ${createdBy} to alert: ${alertId}`);
      }
    }

    // Process schedule data
    let processedSchedule = {
      enabled: false,
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      timeSlots: [{ startTime: '00:00', endTime: '23:59' }],
      timezone: 'UTC'
    };

    if (schedule && schedule.enabled) {
      processedSchedule = {
        enabled: schedule.enabled,
        daysOfWeek: schedule.daysOfWeek || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        timeSlots: schedule.timeSlots || [{ startTime: '00:00', endTime: '23:59' }],
        timezone: 'UTC'
      };
    }

    const newAlert = {
      id: alertId,
      title,
      message,
      type: type || 'warning',
      priority: priority || 'medium',
      category: category || 'device',
      parameter,
      threshold,
      condition: condition || 'above',
      isActive: true,
      createdAt: new Date(),
      createdBy: createdBy || null,
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      periodicity: periodicity || 'immediate',
      assignedUsers: assignedUsers,
      schedule: processedSchedule
    };
    
    device.alertConfigurations.push(newAlert);
    const updatedDevice = await device.save();
    
    res.status(201).json({
      message: 'Alert configuration added successfully',
      alert: newAlert,
      deviceId: updatedDevice.deviceId,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/device/:deviceId/alerts - Get all alert configurations for device
router.get('/:deviceId/alerts', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({
      deviceId: device.deviceId,
      deviceName: device.name,
      siteId: device.siteId._id,
      siteName: device.siteId.name,
      alertConfigurations: device.alertConfigurations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/device/:deviceId/alerts/:alertId/assign-users - Assign users to alert
router.post('/:deviceId/alerts/:alertId/assign-users', async (req, res) => {
  try {
    const { deviceId, alertId } = req.params;
    const { userIds } = req.body;
    
    console.log(`📧 Assigning users to alert: ${alertId} for device: ${deviceId}`);
    console.log(`📧 User IDs to assign:`, userIds);
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const alertIndex = device.alertConfigurations.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert configuration not found' });
    }
    
    // Filter out null/undefined user IDs and separate emails from ObjectIds
    const validUserIds = userIds.filter(id => id && id !== null && id !== undefined);
    console.log(`📧 Valid user IDs to assign:`, validUserIds);
    
    if (validUserIds.length === 0) {
      console.log(`⚠️ No valid user IDs provided for alert: ${alertId}`);
      return res.status(400).json({ error: 'No valid user IDs provided' });
    }
    
    // Separate emails from ObjectIds
    const emails = validUserIds.filter(id => typeof id === 'string' && id.includes('@'));
    const objectIds = validUserIds.filter(id => typeof id === 'string' && !id.includes('@') && !id.startsWith('creator_'));
    
    console.log(`📧 Emails found:`, emails);
    console.log(`📧 ObjectIds found:`, objectIds);
    
    // Find users by both emails and ObjectIds
    let users = [];
    
    if (emails.length > 0) {
      const usersByEmail = await User.find({ email: { $in: emails } }, 'email name');
      users.push(...usersByEmail);
    }
    
    if (objectIds.length > 0) {
      try {
        const usersById = await User.find({ _id: { $in: objectIds } }, 'email name');
        users.push(...usersById);
      } catch (error) {
        console.log(`⚠️ Error finding users by ObjectId:`, error.message);
      }
    }
    
    // Remove duplicates based on email
    const uniqueUsers = users.filter((user, index, self) => 
      index === self.findIndex(u => u.email === user.email)
    );
    
    const userEmails = uniqueUsers.map(user => user.email);
    console.log(`📧 User emails to assign:`, userEmails);
    
    if (userEmails.length === 0) {
      console.log(`⚠️ No valid users found for the provided user IDs`);
      return res.status(400).json({ error: 'No valid users found for the provided user IDs' });
    }
    
    // Update the alert with assigned users
    device.alertConfigurations[alertIndex].assignedUsers = userEmails;
    
    // If no users assigned, set createdBy to the first user (if available)
    if (userEmails.length > 0 && !device.alertConfigurations[alertIndex].createdBy) {
      device.alertConfigurations[alertIndex].createdBy = userEmails[0];
    }
    
    const updatedDevice = await device.save();
    
    console.log(`✅ Successfully assigned ${userEmails.length} users to alert: ${alertId}`);
    
    res.json({
      message: 'Users assigned to alert successfully',
      alert: updatedDevice.alertConfigurations[alertIndex],
      deviceId: updatedDevice.deviceId,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name,
      assignedUsers: userEmails
    });
  } catch (error) {
    console.error('❌ Error assigning users to alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/device/:deviceId/alerts/:alertId - Update specific alert
router.put('/:deviceId/alerts/:alertId', async (req, res) => {
  try {
    const { deviceId, alertId } = req.params;
    const { title, message, type, priority, category, parameter, threshold, condition, isActive, schedule } = req.body;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const alertIndex = device.alertConfigurations.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert configuration not found' });
    }
    
    // Update alert fields
    if (title !== undefined) device.alertConfigurations[alertIndex].title = title;
    if (message !== undefined) device.alertConfigurations[alertIndex].message = message;
    if (type !== undefined) device.alertConfigurations[alertIndex].type = type;
    if (priority !== undefined) device.alertConfigurations[alertIndex].priority = priority;
    if (category !== undefined) device.alertConfigurations[alertIndex].category = category;
    if (parameter !== undefined) device.alertConfigurations[alertIndex].parameter = parameter;
    if (threshold !== undefined) device.alertConfigurations[alertIndex].threshold = threshold;
    if (condition !== undefined) device.alertConfigurations[alertIndex].condition = condition;
    if (isActive !== undefined) device.alertConfigurations[alertIndex].isActive = isActive;
    
    // Update schedule if provided
    if (schedule !== undefined) {
      if (schedule.enabled) {
        // Validate schedule data
        if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
          return res.status(400).json({ error: 'Schedule must include at least one day of the week' });
        }
        if (!schedule.timeSlots || schedule.timeSlots.length === 0) {
          return res.status(400).json({ error: 'Schedule must include at least one time slot' });
        }
        
        device.alertConfigurations[alertIndex].schedule = {
          enabled: schedule.enabled,
          daysOfWeek: schedule.daysOfWeek,
          timeSlots: schedule.timeSlots,
          timezone: 'UTC'
        };
      } else {
        device.alertConfigurations[alertIndex].schedule = {
          enabled: false,
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          timeSlots: [{ startTime: '00:00', endTime: '23:59' }],
          timezone: 'UTC'
        };
      }
    }
    
    const updatedDevice = await device.save();
    
    res.json({
      message: 'Alert configuration updated successfully',
      alert: updatedDevice.alertConfigurations[alertIndex],
      deviceId: updatedDevice.deviceId,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/device/:deviceId/alerts/:alertId - Delete specific alert
router.delete('/:deviceId/alerts/:alertId', async (req, res) => {
  try {
    const { deviceId, alertId } = req.params;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const alertIndex = device.alertConfigurations.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert configuration not found' });
    }
    
    // Remove the alert configuration
    device.alertConfigurations.splice(alertIndex, 1);
    const updatedDevice = await device.save();
    
    res.json({
      message: 'Alert configuration deleted successfully',
      deviceId: updatedDevice.deviceId,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/device/:deviceId/alerts/:alertId/toggle - Toggle alert active status
router.patch('/:deviceId/alerts/:alertId/toggle', async (req, res) => {
  try {
    const { deviceId, alertId } = req.params;
    
    const device = await Device.findOne({ deviceId }).populate('siteId', 'name');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const alertIndex = device.alertConfigurations.findIndex(alert => alert.id === alertId);
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert configuration not found' });
    }
    
    // Toggle the isActive status
    device.alertConfigurations[alertIndex].isActive = !device.alertConfigurations[alertIndex].isActive;
    const updatedDevice = await device.save();
    
    res.json({
      message: `Alert configuration ${updatedDevice.alertConfigurations[alertIndex].isActive ? 'activated' : 'deactivated'} successfully`,
      alert: updatedDevice.alertConfigurations[alertIndex],
      deviceId: updatedDevice.deviceId,
      siteId: updatedDevice.siteId._id,
      siteName: updatedDevice.siteId.name
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;