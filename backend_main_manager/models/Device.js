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
  },
  // Alert configurations for the device
  alertConfigurations: [{
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error', 'critical'],
      default: 'warning'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    category: {
      type: String,
      enum: ['device', 'site', 'system', 'maintenance', 'security'],
      default: 'device'
    },
    parameter: {
      type: String,
      required: true
    },
    threshold: {
      type: Number,
      required: true
    },
    condition: {
      type: String,
      enum: ['above', 'below', 'equals'],
      default: 'above'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      default: null
    },
    assignedUsers: {
      type: [String],
      default: []
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    periodicity: {
      type: String,
      enum: ['immediate', 'hourly', 'daily', 'weekly'],
      default: 'immediate'
    },
    // Schedule configuration for when alerts should be active
    schedule: {
      enabled: {
        type: Boolean,
        default: false
      },
      daysOfWeek: {
        type: [String],
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      timeSlots: [{
        startTime: {
          type: String,
          default: '00:00',
          validate: {
            validator: function(v) {
              return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Start time must be in HH:MM format'
          }
        },
        endTime: {
          type: String,
          default: '23:59',
          validate: {
            validator: function(v) {
              return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'End time must be in HH:MM format'
          }
        }
      }],
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  }]
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