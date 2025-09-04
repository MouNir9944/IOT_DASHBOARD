import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'critical'],
    default: 'info'
  },
  category: {
    type: String,
    enum: ['device', 'site', 'system', 'maintenance', 'security'],
    default: 'device'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['new', 'read', 'acknowledged', 'resolved'],
    default: 'new'
  },
  // Related entities
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: false
  },
  deviceId: {
    type: String,
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Notification delivery preferences
  deliveryPreferences: {
    email: {
      enabled: { type: Boolean, default: true }, // Changed from false to true
      frequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly'],
        default: 'immediate'
      },
      lastSent: { type: Date, default: null }
    },
    // SMS and push removed per requirement
  },
  // Priority-based delivery settings
  priorityDelivery: {
    low: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' }
    },
    medium: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      frequency: { type: String, enum: ['immediate', 'hourly', 'daily'], default: 'hourly' }
    },
    high: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      frequency: { type: String, enum: ['immediate', 'hourly'], default: 'immediate' }
    },
    critical: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      frequency: { type: String, enum: ['immediate'], default: 'immediate' }
    }
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  readAt: {
    type: Date,
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ siteId: 1, status: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1 });
notificationSchema.index({ 'deliveryPreferences.email.enabled': 1 });

// Static method to create device alerts
notificationSchema.statics.createDeviceAlert = async function(deviceId, siteId, alertData) {
  const { title, message, type = 'warning', priority = 'medium', metadata = {}, deliveryPreferences = {} } = alertData;
  
  return await this.create({
    title,
    message,
    type,
    priority,
    category: 'device',
    deviceId,
    siteId,
    metadata,
    deliveryPreferences
  });
};

// Static method to create system alerts
notificationSchema.statics.createSystemAlert = async function(alertData) {
  const { title, message, type = 'info', priority = 'medium', metadata = {}, deliveryPreferences = {} } = alertData;
  
  return await this.create({
    title,
    message,
    type,
    priority,
    category: 'system',
    metadata,
    deliveryPreferences
  });
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.status = 'read';
  this.readAt = new Date();
  return await this.save();
};

// Instance method to acknowledge
notificationSchema.methods.acknowledge = async function() {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  return await this.save();
};

// Instance method to resolve
notificationSchema.methods.resolve = async function() {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  return await this.save();
};

// Instance method to update delivery preferences
notificationSchema.methods.updateDeliveryPreferences = async function(preferences) {
  this.deliveryPreferences = { ...this.deliveryPreferences, ...preferences };
  return await this.save();
};

// Instance method to check if notification should be sent based on frequency
notificationSchema.methods.shouldSendNotification = function(channel) {
  const delivery = this.deliveryPreferences[channel];
  
  console.log(`🔍 Checking if should send ${channel} notification:`, {
    channel,
    deliveryExists: !!delivery,
    enabled: delivery?.enabled,
    frequency: delivery?.frequency,
    lastSent: delivery?.lastSent
  });
  
  if (!delivery || !delivery.enabled) {
    console.log(`❌ ${channel} delivery not enabled or not configured`);
    return false;
  }
  
  if (delivery.frequency === 'immediate') {
    console.log(`✅ ${channel} frequency is immediate - allowing send`);
    return true;
  }
  
  if (!delivery.lastSent) {
    console.log(`✅ ${channel} never sent before - allowing first send`);
    return true;
  }
  
  const now = new Date();
  const lastSent = new Date(delivery.lastSent);
  const diffInMs = now.getTime() - lastSent.getTime();
  
  console.log(`⏱️ ${channel} frequency check:`, {
    frequency: delivery.frequency,
    lastSent: lastSent.toISOString(),
    currentTime: now.toISOString(),
    diffInMs: diffInMs,
    diffInMinutes: Math.round(diffInMs / 60000),
    diffInHours: Math.round(diffInMs / 3600000)
  });
  
  let minIntervalMs = 0;
  let shouldSend = false;
  
  switch (delivery.frequency) {
    case 'hourly':
      minIntervalMs = 60 * 60 * 1000; // 1 hour
      shouldSend = diffInMs >= minIntervalMs;
      break;
    case 'daily':
      minIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
      shouldSend = diffInMs >= minIntervalMs;
      break;
    case 'weekly':
      minIntervalMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      shouldSend = diffInMs >= minIntervalMs;
      break;
    default:
      shouldSend = true;
      break;
  }
  
  if (shouldSend) {
    console.log(`✅ ${channel} frequency check passed - can send`);
  } else {
    const remainingMs = minIntervalMs - diffInMs;
    const remainingMinutes = Math.round(remainingMs / 60000);
    const remainingHours = Math.round(remainingMs / 3600000);
    console.log(`⏱️ ${channel} frequency check failed - next allowed in ${remainingMinutes}m (${remainingHours}h)`);
  }
  
  return shouldSend;
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 