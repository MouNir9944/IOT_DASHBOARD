import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
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
  // Additional device configuration fields
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
deviceSchema.index({ siteId: 1 });
deviceSchema.index({ type: 1 });
// deviceId field already has unique: true which creates an index automatically
deviceSchema.index({ status: 1 });

const Device = mongoose.model('Device', deviceSchema);
export default Device;