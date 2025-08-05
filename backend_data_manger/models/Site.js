import mongoose from 'mongoose';

const SiteSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  devices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  address: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  type: {
    type: String,
    enum: ['manufacturing', 'farm', 'building', 'warehouse', 'office'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const DeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['energy', 'solar', 'water', 'gas', 'temperature', 'humidity', 'pressure'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  lastReading: {
    value: { type: Number, default: 0 },
    unit: { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  threshold: {
    type: Number,
    default: 0
  },
  readingInterval: {
    type: Number,
    default: 5 // minutes
  },
  alertEnabled: {
    type: Boolean,
    default: true
  },
  maintenanceSchedule: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  }
}, {
  timestamps: true
});

// Index for faster queries
DeviceSchema.index({ siteId: 1 });
DeviceSchema.index({ type: 1 });
DeviceSchema.index({ deviceId: 1 });
DeviceSchema.index({ status: 1 });

const Site = mongoose.model('Site', SiteSchema);
const Device = mongoose.model('Device', DeviceSchema);

export { Site, Device }; 