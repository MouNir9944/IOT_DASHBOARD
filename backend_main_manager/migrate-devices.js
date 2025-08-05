import mongoose from 'mongoose';
import Site from './models/Site.js';
import Device from './models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = 'mongodb://localhost:27017';

async function migrateDevices() {
  try {
    console.log('🔄 Starting device migration...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      dbName: 'iot_dashboard'
    });
    console.log('✅ Connected to MongoDB');

    // Find all sites with embedded devices
    const sitesWithEmbeddedDevices = await mongoose.connection.db.collection('sites').find({
      devices: { $exists: true, $type: "array", $ne: [] }
    }).toArray();

    console.log(`📊 Found ${sitesWithEmbeddedDevices.length} sites with embedded devices`);

    let totalDevicesMigrated = 0;
    let totalSitesUpdated = 0;

    for (const siteDoc of sitesWithEmbeddedDevices) {
      console.log(`\n🏢 Processing site: ${siteDoc.name} (${siteDoc._id})`);
      
      const embeddedDevices = siteDoc.devices || [];
      const newDeviceIds = [];

      for (const embeddedDevice of embeddedDevices) {
        // Skip if this device was already migrated (it's an ObjectId, not an object)
        if (typeof embeddedDevice === 'string' || mongoose.Types.ObjectId.isValid(embeddedDevice)) {
          console.log(`⏭️  Device ${embeddedDevice} already migrated, skipping...`);
          newDeviceIds.push(embeddedDevice);
          continue;
        }

        try {
          // Check if device already exists in Device collection
          const existingDevice = await Device.findOne({ deviceId: embeddedDevice.deviceId });
          
          if (existingDevice) {
            console.log(`⚠️  Device ${embeddedDevice.deviceId} already exists in Device collection`);
            newDeviceIds.push(existingDevice._id);
            continue;
          }

          // Create new device in Device collection
          const newDevice = new Device({
            deviceId: embeddedDevice.deviceId,
            type: embeddedDevice.type,
            name: embeddedDevice.name,
            description: embeddedDevice.description || '',
            status: embeddedDevice.status || 'active',
            siteId: siteDoc._id,
            threshold: embeddedDevice.threshold || 0,
            readingInterval: embeddedDevice.readingInterval || 5,
            alertEnabled: embeddedDevice.alertEnabled !== undefined ? embeddedDevice.alertEnabled : true,
            maintenanceSchedule: embeddedDevice.maintenanceSchedule || 'monthly',
            lastReading: {
              value: embeddedDevice.lastReading?.value || 0,
              unit: embeddedDevice.lastReading?.unit || getDefaultUnit(embeddedDevice.type),
              timestamp: embeddedDevice.lastReading?.timestamp || new Date()
            },
            createdAt: embeddedDevice.createdAt || new Date(),
            updatedAt: embeddedDevice.updatedAt || new Date()
          });

          const savedDevice = await newDevice.save();
          newDeviceIds.push(savedDevice._id);
          
          console.log(`✅ Migrated device: ${embeddedDevice.name} (${embeddedDevice.deviceId})`);
          totalDevicesMigrated++;

        } catch (deviceError) {
          console.error(`❌ Error migrating device ${embeddedDevice.deviceId}:`, deviceError.message);
        }
      }

      // Update site to use ObjectId references
      try {
        await mongoose.connection.db.collection('sites').updateOne(
          { _id: siteDoc._id },
          { $set: { devices: newDeviceIds } }
        );
        
        console.log(`✅ Updated site ${siteDoc.name} with ${newDeviceIds.length} device references`);
        totalSitesUpdated++;
        
      } catch (siteError) {
        console.error(`❌ Error updating site ${siteDoc.name}:`, siteError.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   📱 Total devices migrated: ${totalDevicesMigrated}`);
    console.log(`   🏢 Total sites updated: ${totalSitesUpdated}`);
    console.log('✅ Migration completed successfully!');

    // Verify migration
    const totalDevicesInCollection = await Device.countDocuments();
    const totalSitesWithDeviceRefs = await Site.countDocuments({ devices: { $ne: [] } });
    
    console.log('\n🔍 Verification:');
    console.log(`   📱 Total devices in Device collection: ${totalDevicesInCollection}`);
    console.log(`   🏢 Total sites with device references: ${totalSitesWithDeviceRefs}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Helper function to get default unit for device type
function getDefaultUnit(type) {
  const units = {
    energy: 'kWh',
    solar: 'kWh',
    water: 'L',
    gas: 'm³',
    temperature: '°C',
    humidity: '%',
    pressure: 'Pa'
  };
  return units[type] || 'unit';
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDevices();
}

export default migrateDevices;