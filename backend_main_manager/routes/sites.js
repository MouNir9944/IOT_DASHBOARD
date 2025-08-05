import express from 'express';
import Site from '../models/Site.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import mongoose from 'mongoose';

const router = express.Router();

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
    console.log(`💡 Make sure the MQTT Data Manager is running at ${process.env.MQTT_DATA_MANAGER_URL || 'http://localhost:5001'}`);
  }
}

// Create a new site
router.post('/', async (req, res) => {
  try {
    let { name, location, address, description, devices, type, status, userId } = req.body;
    // Support location as string or object
    if (typeof location === 'string') {
      const [latitude, longitude] = location.split(',').map(Number);
      location = { latitude, longitude };
    }
    const site = new Site({ name, location, address, description, devices, type, status });
    await site.save();
    // If userId is provided, assign the site to the user
    if (userId) { 
      const user = await User.findById(userId);
      if (user) {
        user.sites = user.sites || [];
        user.sites.push(site._id);
        await user.save();
      }
    }
    res.status(201).json(site);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update an existing site
router.put('/:id', async (req, res) => {
  try {
    const siteId = req.params.id;
    let { name, location, address, description, devices, type, status } = req.body;

    // Ensure location is always an object
    if (typeof location === 'string') {
      const [latitude, longitude] = location.split(',').map(Number);
      location = { latitude, longitude };
    }
    if (!location || typeof location !== 'object') {
      location = { latitude: 0, longitude: 0 };
    }

    // Check if site exists
    const existingSite = await Site.findById(siteId);
    if (!existingSite) {
      return res.status(404).json({ error: 'Site not found' });
    }
    const oldName = existingSite.name;
    const nameChanged = name && name !== oldName;

    if (nameChanged) {
      // Check for uniqueness
      const duplicate = await Site.findOne({ name, _id: { $ne: siteId } });
      if (duplicate) {
        return res.status(400).json({ error: 'Site name already in use' });
      }

      // 1. Migrate DB before updating the site document
      const oldConn = await mongoose.createConnection("mongodb://localhost:27017", {
        dbName: oldName,
        serverSelectionTimeoutMS: 30000,
      }).asPromise();

      const newConn = await mongoose.createConnection("mongodb://localhost:27017", {
        dbName: name,
        serverSelectionTimeoutMS: 30000,
      }).asPromise();

      try {
        const collections = await oldConn.db.listCollections().toArray();

        for (const coll of collections) {
          const collName = coll.name;

          const OldModel = oldConn.model(collName, new mongoose.Schema({}, { strict: false }), collName);
          const NewModel = newConn.model(collName, new mongoose.Schema({}, { strict: false }), collName);

          const docs = await OldModel.find({}).lean();
          if (docs.length > 0) {
            await NewModel.insertMany(docs);
            console.log(`✅ Migrated ${docs.length} docs from ${oldName}.${collName} to ${name}.${collName}`);
          }
        }

        // Delete old database
        await oldConn.dropDatabase();
        console.log(`🗑️ Dropped old DB: ${oldName}`);
      } catch (err) {
        console.error(`❌ Migration error from ${oldName} to ${name}:`, err);
        return res.status(500).json({ error: 'Failed to migrate DB', details: err.message });
      } finally {
        await oldConn.close();
        await newConn.close();
      }
    }

    // 2. Now update the site document
    const site = await Site.findByIdAndUpdate(
      siteId,
      { name, location, address, description, devices, type, status },
      { new: true, runValidators: true }
    );

    // Ensure location is always present in the response
    if (!site.location) {
      site.location = { latitude: 0, longitude: 0 };
    }

    res.json(site);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a site
router.delete('/:id', async (req, res) => {
  try {
    const siteId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      return res.status(400).json({ error: 'Invalid site ID' });
    }

    // 1. Remove site references from all users
    const updateResult = await User.updateMany(
      { 'sites': siteId },
      { $pull: { sites: siteId } }
    );

    // 2. Delete the site
    const deletedSite = await Site.findByIdAndDelete(siteId);
    if (!deletedSite) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // 3. Reinitialize MQTT subscriptions to remove devices from deleted site
    await reinitializeMQTT();
    
    console.log('✅ Site deleted successfully');
    res.status(200).json({
      message: 'Site deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({
      error: 'Failed to delete site',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/*
router.delete('/deletesite/:id', async (req, res) => {
  try {
    const siteId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      return res.status(HTTP_BAD_REQUEST).json({ error: 'Invalid site ID' });
    }

    // 1. Remove site references from all users
    const updateResult = await User.updateMany(
      { 'sites.siteId': siteId },
      { $pull: { sites: { siteId } } }
    );



    // 3. Delete the site
    const deletedSite = await Site.findByIdAndDelete(siteId);
    if (!deletedSite) {
      return res.status(HTTP_NOT_FOUND).json({ error: 'Site not found' });
    }

    res.status(HTTP_OK).json({
      message: 'Site deleted successfully',
      details: {
        siteDeleted: true,
        modelDeletion,
        usersUpdated: updateResult.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(HTTP_SERVER_ERROR).json({ 
      error: 'Failed to delete site',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});*/
// Get all sites
router.get('/', async (req, res) => {
  try {
    const sites = await Site.find();
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sites/:id - get a single site by ID
router.get('/:id', async (req, res) => {
  try {
    const site = await Site.findById(req.params.id).populate('devices');
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sites/user/:userId - get sites assigned to a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // user.sites is an array of ObjectIds
    const sites = await Site.find({ _id: { $in: user.sites || [] } }).populate('devices');
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOTE: Device management routes have been moved to /api/device/*
// This maintains backwards compatibility but new implementations should use /api/device routes

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