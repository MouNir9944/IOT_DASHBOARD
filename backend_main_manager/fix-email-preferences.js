import mongoose from 'dotenv/config';
import Notification from './models/Notification.js';

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/iot_dashboard';
await mongoose.connect(mongoUri);
console.log('✅ Connected to MongoDB');

try {
  // Find notifications without email delivery enabled
  const notificationsToUpdate = await Notification.find({
    $or: [
      { 'deliveryPreferences.email.enabled': { $ne: true } },
      { 'deliveryPreferences.email.enabled': { $exists: false } }
    ]
  });

  console.log(`📧 Found ${notificationsToUpdate.length} notifications without email delivery enabled`);

  if (notificationsToUpdate.length > 0) {
    // Update all notifications to enable email delivery
    const updateResult = await Notification.updateMany(
      {
        $or: [
          { 'deliveryPreferences.email.enabled': { $ne: true } },
          { 'deliveryPreferences.email.enabled': { $exists: false } }
        ]
      },
      {
        $set: {
          'deliveryPreferences.email.enabled': true,
          'deliveryPreferences.email.frequency': 'immediate'
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} notifications to enable email delivery`);
  }

  // Check final count
  const enabledCount = await Notification.countDocuments({ 'deliveryPreferences.email.enabled': true });
  const totalCount = await Notification.countDocuments();
  
  console.log(`📊 Final status: ${enabledCount}/${totalCount} notifications have email delivery enabled`);

} catch (error) {
  console.error('❌ Error updating notifications:', error);
} finally {
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

