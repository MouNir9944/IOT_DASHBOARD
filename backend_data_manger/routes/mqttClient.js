// mqttClient.js

import mqtt from 'mqtt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Site, Device } from '../models/Site.js';

dotenv.config(); // Load environment variables from .env file

// Ensure MONGO_URI_site1 is available
const MONGO_URI = process.env.MONGO_URI ;
const MONGO_URI_site1 = process.env.MONGO_URI_site1 ;

let client;
let topics = [];
let deviceMap = {}; // Maps deviceId -> { siteDbName, siteName, siteId, type, deviceName }
let siteConnections = {}; // Cache DB connections
let healthCheckInterval; // Connection health check interval

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
      
      // Extract values - handle multiple parameters for water devices
      let values = {};
      let unit = data.unit;
      
      // Check for specific water parameters
      if (data.flowRate !== undefined) values.flowRate = data.flowRate;
      if (data.pressure !== undefined) values.pressure = data.pressure;
      if (data.temperature !== undefined) values.temperature = data.temperature;
      if (data.level !== undefined) values.level = data.level;
      if (data.quality !== undefined) values.quality = data.quality;
      if (data.consumption !== undefined) values.consumption = data.consumption;
      
      // Fallback to generic value field
      if (data.value !== undefined) {
        values.value = data.value;
      } else if (Object.keys(values).length === 0) {
        // No specific parameters found, use old format
        values.value = data.consumption || data.production || 0;
      }
      
      // Extract unit - use provided unit or default for device type
      if (!unit) {
        const meta = deviceMap[deviceId];
        unit = meta ? getDefaultUnit(meta.type) : 'unit';
      }
      
      // Define units for specific parameters
      const parameterUnits = {
        flowRate: 'L/min',
        pressure: 'bar',
        temperature: '°C',
        level: '%',
        quality: 'pH',
        consumption: 'm³'
      };
      
      console.log('📋 Extracted fields:', { deviceId, timestamp, values, unit });

      const meta = deviceMap[deviceId];
      if (!meta) {
        console.warn(`⚠️ Unknown deviceId "${deviceId}" from topic "${topic}"`);
        return;
      }

      const { siteDbName, siteName, siteId, type, deviceName } = meta;

      // Create or get site DB connection with better error handling
      let siteDB = siteConnections[siteDbName];
      
      if (!siteDB || siteDB.readyState !== 1) {
        // Close existing connection if it's in a bad state
        if (siteDB) {
          try {
            await siteDB.close();
          } catch (e) {
            console.log(`⚠️ Error closing bad connection to ${siteDbName}:`, e.message);
          }
        }
        
        // Create new connection with better timeout settings
        siteConnections[siteDbName] = mongoose.createConnection(MONGO_URI_site1, {
          dbName: siteDbName,
          serverSelectionTimeoutMS: 15000, // Reduced from 30s
          socketTimeoutMS: 20000, // 20 second socket timeout
          connectTimeoutMS: 15000, // 15 second connection timeout
          authSource: 'site1',
          retryWrites: true,
          w: 'majority',
          maxPoolSize: 5, // Limit connection pool
          minPoolSize: 1,
          maxIdleTimeMS: 30000, // Close idle connections after 30s
          heartbeatFrequencyMS: 10000 // Heartbeat every 10s
        });

        siteConnections[siteDbName].on('error', err => {
          console.error(`❌ DB error for site DB "${siteDbName}":`, err.message);
          // Mark connection as bad so it gets recreated
          siteConnections[siteDbName].readyState = 0;
        });

        siteConnections[siteDbName].on('connected', () => {
          console.log(`✅ Connected to site DB: ${siteDbName}`);
        });

        siteConnections[siteDbName].on('disconnected', () => {
          console.log(`⚠️ Disconnected from site DB: ${siteDbName}`);
          siteConnections[siteDbName].readyState = 0;
        });

        siteDB = siteConnections[siteDbName];
      }

      // Define the collection model (collection name is device type)
      const collectionName = type;
      const DeviceDataModel = siteDB.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);

      // Save the message data with all parameters
      const dataToSave = {
        deviceId,
        deviceName,
        siteId,
        siteName,
        type,
        timestamp: timestamp ? (typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)) : new Date(),
        _id: new mongoose.Types.ObjectId(),
        ...data, // Include any additional fields from the message
        ...values // Include all extracted values
      };

      // Retry logic for database operations
      let retryCount = 0;
      const maxRetries = 3;
      let saved = false;
      
      while (!saved && retryCount < maxRetries) {
        try {
          await DeviceDataModel.create(dataToSave);
          saved = true;
          console.log(`✅ Data saved successfully on attempt ${retryCount + 1}`);
        } catch (error) {
          retryCount++;
          console.warn(`⚠️ Database save attempt ${retryCount} failed for device ${deviceId}:`, error.message);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to save data after ${maxRetries} attempts: ${error.message}`);
          }
          
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`🔄 Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Check if connection is still good, recreate if needed
          if (siteDB.readyState !== 1) {
            console.log(`🔄 Recreating database connection for ${siteDbName}...`);
            delete siteConnections[siteDbName];
            siteDB = null;
            break; // Break out of retry loop to recreate connection
          }
        }
      }
      
      if (!saved) {
        throw new Error(`Failed to save data after ${maxRetries} attempts`);
      }

      console.log(`✅ Data saved: Site="${siteName}", DB="${siteDbName}", Collection="${collectionName}", Device="${deviceId}", Values=${JSON.stringify(values)}`);

      // Update the last reading in the main Device collection (use primary value)
      const primaryValue = values.value || values.flowRate || values.consumption || Object.values(values)[0] || 0;
      await updateDeviceLastReading(deviceId, primaryValue, unit, timestamp);

      // Check for alert conditions for each parameter
      for (const [parameter, value] of Object.entries(values)) {
        const parameterUnit = parameterUnits[parameter] || unit;
        await checkAlertConditions(deviceId, value, parameterUnit, type, siteId, siteName, deviceName, parameter);
      }

    } catch (err) {
      console.error('❌ Failed to process MQTT message:', err.message);
    }
  });
}

// Helper function to check if alert should be triggered based on schedule
function isAlertScheduled(alertConfig) {
  // If schedule is not enabled, always allow the alert
  if (!alertConfig.schedule || !alertConfig.schedule.enabled) {
    return true;
  }

  try {
    // Always use UTC time
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    // Check if current day is in allowed days
    if (!alertConfig.schedule.daysOfWeek.includes(currentDay)) {
      console.log(`📅 Alert ${alertConfig.title} skipped - not scheduled for ${currentDay}`);
      return false;
    }
    
    // Check if current time is within any time slot
    const isWithinTimeSlot = alertConfig.schedule.timeSlots.some(slot => {
      const startTime = slot.startTime;
      const endTime = slot.endTime;
      
      // Handle time slots that span midnight
      if (startTime <= endTime) {
        return currentTime >= startTime && currentTime <= endTime;
      } else {
        // Time slot spans midnight (e.g., 22:00 to 06:00)
        return currentTime >= startTime || currentTime <= endTime;
      }
    });
    
    if (!isWithinTimeSlot) {
      console.log(`⏰ Alert ${alertConfig.title} skipped - current time ${currentTime} not within scheduled time slots`);
      return false;
    }
    
    console.log(`✅ Alert ${alertConfig.title} is scheduled for ${currentDay} at ${currentTime} (UTC)`);
    return true;
  } catch (error) {
    console.error(`❌ Error checking schedule for alert ${alertConfig.title}:`, error);
    // If there's an error with schedule checking, default to allowing the alert
    return true;
  }
}



async function checkAlertConditions(deviceId, value, unit, type, siteId, siteName, deviceName, parameter = null) {
  try {
    console.log(`🔍 Checking alert conditions for device ${deviceId} with value ${value} ${unit} (parameter: ${parameter})`);
    
    // Connect to main database to get device alert configurations
    const mainDB = mongoose.createConnection(process.env.MONGO_URI, {
      dbName: 'iot_dashboard',
      serverSelectionTimeoutMS: 30000,
      authSource: 'iot_dashboard',
      retryWrites: true,
      w: 'majority'
    });

    const Device = mainDB.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');
    const Notification = mainDB.model('Notification', new mongoose.Schema({}, { strict: false }), 'notifications');
    
    // Get device with alert configurations
    const device = await Device.findOne({ deviceId }).lean();
    if (!device || !device.alertConfigurations || device.alertConfigurations.length === 0) {
      console.log(`📊 No alert configurations found for device ${deviceId}`);
      await mainDB.close();
      return;
    }

    console.log(`📊 Found ${device.alertConfigurations.length} alert configurations for device ${deviceId}`);

    // Check each alert configuration
    for (const alertConfig of device.alertConfigurations) {
      // Skip inactive alerts
      if (!alertConfig.isActive) {
        console.log(`⏸️ Skipping inactive alert: ${alertConfig.title}`);
        continue;
      }

      // Check if the alert is scheduled
      if (!isAlertScheduled(alertConfig)) {
        continue;
      }

      // For water devices, we need to be more flexible about parameter matching
      // since the same device can report different parameters (flowRate, pressure, etc.)
      let shouldCheckThisAlert = false;
      
      if (type === 'water') {
        // For water devices, only check alerts that match the current parameter being processed
        if (parameter && alertConfig.parameter === parameter) {
          shouldCheckThisAlert = true;
        }
      } else {
        // For other device types, use the original logic
        const currentParameter = getParameterFromValue(value, type);
        shouldCheckThisAlert = (alertConfig.parameter === currentParameter);
        console.log(`📊 Alert parameter ${alertConfig.parameter} vs current parameter ${currentParameter}: ${shouldCheckThisAlert}`);
      }
      
      if (!shouldCheckThisAlert) {
        console.log(`📊 Skipping alert ${alertConfig.title} - parameter mismatch`);
        continue;
      }

      // Determine comparison value based on parameter type
      let comparisonValue = value;
      let dailyConsumption = null;
      
      console.log(`🔍 Checking alert config: parameter=${alertConfig.parameter}, deviceType=${type}, value=${value}`);
      
      if (alertConfig.parameter === 'consumption' && (type === 'energy' || type === 'water' || type === 'gas')) {
        console.log(`📊 Attempting to get daily consumption for device ${deviceId} (${type})`);
        // Get daily consumption for comparison
        dailyConsumption = await getDailyConsumption(deviceId, type, siteId);
        if (dailyConsumption !== null) {
          comparisonValue = dailyConsumption;
          console.log(`📊 Using daily consumption for comparison: ${dailyConsumption} ${unit} (current: ${value} ${unit})`);
        } else {
          console.log(`📊 Daily consumption calculation failed, using current value: ${value} ${unit}`);
        }
      } else if (type === 'water' && ['flowRate', 'pressure', 'temperature', 'level', 'quality'].includes(alertConfig.parameter)) {
        // For other water parameters, use the current value directly
        comparisonValue = value;
        console.log(`📊 Using current value for ${alertConfig.parameter}: ${value} ${unit}`);
      } else {
        console.log(`📊 Using current value for comparison: ${value} ${unit}`);
      }

      // Check threshold condition
      console.log(`🔍 Comparing: ${comparisonValue} ${unit} ${alertConfig.condition} ${alertConfig.threshold} ${unit}`);
      const shouldTrigger = checkThresholdCondition(comparisonValue, alertConfig.threshold, alertConfig.condition);
      
      if (shouldTrigger) {
        console.log(`🚨 ALERT TRIGGERED: ${alertConfig.title} - Value: ${comparisonValue} ${unit}, Threshold: ${alertConfig.threshold} ${unit}, Condition: ${alertConfig.condition}`);
        
        // Create notifications for assigned users and groups
        const usersToNotify = [];
        const groupUsersToNotify = [];
        
        // Add alert creator
        if (alertConfig.createdBy) {
          usersToNotify.push(alertConfig.createdBy);
        }
        
        // Add assigned users
        if (alertConfig.assignedUsers && alertConfig.assignedUsers.length > 0) {
          usersToNotify.push(...alertConfig.assignedUsers);
        }
        
        // Add device creator if not already included
        if (device.createdBy && !usersToNotify.includes(device.createdBy)) {
          usersToNotify.push(device.createdBy);
        }
        
        // Handle assigned groups
        if (alertConfig.assignedGroups && alertConfig.assignedGroups.length > 0) {
          console.log(`📧 Processing ${alertConfig.assignedGroups.length} assigned groups for alert: ${alertConfig.title}`);
          
          try {
            const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
            
            // Fetch group members for each assigned group
            for (const groupId of alertConfig.assignedGroups) {
              try {
                const groupResponse = await fetch(`${mainManagerUrl}/api/groups/${groupId}/members`, {
                  method: 'GET',
                  headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'DataManager/1.0'
                  },
                  timeout: 5000
                });
                
                if (groupResponse.ok) {
                  const groupMembers = await groupResponse.json();
                  if (groupMembers && groupMembers.length > 0) {
                    groupUsersToNotify.push(...groupMembers.map(member => member.email || member._id));
                    console.log(`📧 Added ${groupMembers.length} users from group ${groupId}`);
                  }
                } else {
                  console.log(`⚠️ Could not fetch members for group ${groupId}: ${groupResponse.status}`);
                }
              } catch (error) {
                console.log(`⚠️ Error fetching group ${groupId} members: ${error.message}`);
              }
            }
          } catch (error) {
            console.log(`⚠️ Error processing assigned groups: ${error.message}`);
          }
        }
        
        // Combine all users to notify (remove duplicates)
        const allUsersToNotify = [...new Set([...usersToNotify, ...groupUsersToNotify])];
        console.log(`📧 Total users to notify: ${allUsersToNotify.length} (${usersToNotify.length} direct + ${groupUsersToNotify.length} from groups)`);

        // Resolve emails/ObjectIds to actual User ObjectIds in main DB to ensure backend can populate userId
        const User = mainDB.model('User', new mongoose.Schema({}, { strict: false }), 'users');
        const resolvedUserIds = [];
        for (const identifier of allUsersToNotify) {
          try {
            if (typeof identifier === 'string' && identifier.includes('@')) {
              const user = await User.findOne({ email: identifier }).select('_id').lean();
              if (user && user._id) {
                resolvedUserIds.push(user._id);
              } else {
                console.log(`⚠️ No user found for email ${identifier} in main DB`);
              }
            } else if (typeof identifier === 'string' && mongoose.Types.ObjectId.isValid(identifier)) {
              const user = await User.findById(identifier).select('_id').lean();
              if (user && user._id) {
                resolvedUserIds.push(user._id);
              } else {
                console.log(`⚠️ No user found for ObjectId ${identifier} in main DB`);
              }
            }
          } catch (e) {
            console.log(`⚠️ Error resolving user identifier ${identifier}: ${e.message}`);
          }
        }
        
        const uniqueResolvedUserIds = [...new Set(resolvedUserIds.map(id => id.toString()))];
        console.log(`📧 Resolved users to notify: ${uniqueResolvedUserIds.length}`);
        
        // If no users assigned, try to find a default user (admin or superadmin)
        if (allUsersToNotify.length === 0) {
          console.log(`⚠️ No users assigned to alert "${alertConfig.title}". Attempting to find default user...`);
          
          try {
            // Try to find an admin or superadmin user as fallback
            const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
            const usersResponse = await fetch(`${mainManagerUrl}/api/users?role=admin&limit=1`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              timeout: 5000
            });
            
            if (usersResponse.ok) {
              const users = await usersResponse.json();
              if (users && users.length > 0) {
                const defaultUser = users[0];
                usersToNotify.push(defaultUser.email);
                console.log(`📧 Found default user: ${defaultUser.email} for alert: ${alertConfig.title}`);
              } else {
                console.log(`⚠️ No admin users found. Creating notification without email delivery.`);
              }
            } else {
              console.log(`⚠️ Could not fetch users for fallback. Creating notification without email delivery.`);
            }
          } catch (error) {
            console.log(`⚠️ Error finding default user: ${error.message}. Creating notification without email delivery.`);
          }
        }
        
        // If still no users assigned/resolved, create notification and skip email
        if (uniqueResolvedUserIds.length === 0) {
          console.log(`⚠️ No users assigned to alert "${alertConfig.title}". Creating notification without email.`);

          const notification = {
            title: alertConfig.title,
            message: alertConfig.message,
            type: alertConfig.type,
            priority: alertConfig.priority,
            category: alertConfig.category,
            siteId: siteId,
            deviceId: deviceId,
            userId: null,
            metadata: {
              parameter: alertConfig.parameter,
              threshold: alertConfig.threshold,
              condition: alertConfig.condition,
              currentValue: value,
              dailyConsumption: dailyConsumption,
              comparisonValue: comparisonValue,
              unit: unit,
              deviceType: type,
              deviceName: deviceName,
              siteName: siteName,
              alertId: alertConfig.id,
              periodicity: alertConfig.periodicity,
              emailEnabled: false // Email disabled
            },
            status: 'new',
            createdAt: new Date(),
            deliveryPreferences: {
              email: {
                enabled: false,
                frequency: 'immediate',
                lastSent: null
              }
            }
          };
          
          const savedNotification = await Notification.create(notification);
          console.log(`📢 Notification created (email disabled): ${alertConfig.title}`);
          
          // Send SSE message for UI updates
          try {
            const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
            const sseMessage = {
              type: 'notification_created',
              notification: {
                _id: savedNotification._id,
                title: savedNotification.title,
                message: savedNotification.message,
                type: savedNotification.type,
                status: savedNotification.status,
                createdAt: savedNotification.createdAt
              }
            };
            
            const response = await fetch(`${mainManagerUrl}/api/notifications/sse`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(sseMessage),
              timeout: 10000
            });
            
            if (response.ok) {
              console.log(`✅ SSE message sent for notification (email disabled)`);
            }
          } catch (error) {
            console.error('❌ Error sending SSE message:', error.message);
          }
          
          return; // Skip the rest of the email delivery process
        }
        
        // Email disabled: do not send emails, continue to create notifications in UI only
        
        // Create notifications in main manager database for UI display for resolved user ObjectIds
        for (const userId of uniqueResolvedUserIds) {
          const notification = {
            title: alertConfig.title,
            message: alertConfig.message,
            type: alertConfig.type,
            priority: alertConfig.priority,
            category: alertConfig.category,
            siteId: siteId,
            deviceId: deviceId,
            userId: userId,
            metadata: {
              parameter: alertConfig.parameter,
              threshold: alertConfig.threshold,
              condition: alertConfig.condition,
              currentValue: value,
              dailyConsumption: dailyConsumption,
              comparisonValue: comparisonValue,
              unit: unit,
              deviceType: type,
              deviceName: deviceName,
              siteName: siteName,
              alertId: alertConfig.id,
              periodicity: alertConfig.periodicity,
              emailEnabled: alertConfig.emailEnabled
            },
            status: 'new',
            createdAt: new Date()
          };

          // Enforce frequency at creation time and carry forward lastSent
          let previousLastSent = null;
          let shouldCreateNotification = true;
          try {
            const previousNotification = await Notification.findOne({
              userId: userId,
              'metadata.alertId': alertConfig.id
            })
              .sort({ createdAt: -1 })
              .select('deliveryPreferences createdAt')
              .lean();

            if (previousNotification) {
              const frequency = (alertConfig.periodicity || 'immediate').toLowerCase();
              const emailPrefs = previousNotification.deliveryPreferences?.email || {};
              const referenceTime = emailPrefs.lastSent ? new Date(emailPrefs.lastSent) : new Date(previousNotification.createdAt);

              const now = new Date();
              const diffInMs = now.getTime() - referenceTime.getTime();
              let minIntervalMs = 0;
              if (frequency === 'hourly') minIntervalMs = 60 * 60 * 1000;
              else if (frequency === 'daily') minIntervalMs = 24 * 60 * 60 * 1000;
              else if (frequency === 'weekly') minIntervalMs = 7 * 24 * 60 * 60 * 1000;

              if (minIntervalMs > 0 && diffInMs < minIntervalMs) {
                shouldCreateNotification = false;
                console.log(`⏱️ Skipping notification for user ${userId} alert ${alertConfig.id} due to frequency gating (${frequency}). Next allowed in ${(minIntervalMs - diffInMs) / 1000}s`);
              }

              if (emailPrefs.lastSent) {
                previousLastSent = emailPrefs.lastSent;
              }
            }
          } catch (e) {
            console.log(`⚠️ Error fetching previous notification for throttling: ${e.message}`);
          }

          if (!shouldCreateNotification) {
            continue; // Skip creating this notification within the frequency window
          }

          const deliveryPreferences = {
            email: {
              enabled: !!alertConfig.emailEnabled,
              frequency: alertConfig.periodicity || 'immediate',
              lastSent: previousLastSent
            }
          };

          const notificationWithPreferences = {
            ...notification,
            priority: alertConfig.priority,
            deliveryPreferences
          };
          
          const savedNotification = await Notification.create(notificationWithPreferences);
          console.log(`📢 Notification created for user ${userId}: ${alertConfig.title}`);
          
          // Send SSE message to all connected clients with retry logic
          const sendSSEMessageWithRetry = async (retryCount = 0) => {
            try {
              const mainManagerUrl = process.env.MAIN_MANAGER_URL || 'http://localhost:5000';
              console.log(`📡 Attempting to send SSE message to: ${mainManagerUrl}/api/notifications/sse`);
              
              const sseMessage = {
                type: 'notification_created',
                notification: {
                  _id: savedNotification._id,
                  title: savedNotification.title,
                  message: savedNotification.message,
                  type: savedNotification.type,
                  status: savedNotification.status,
                  createdAt: savedNotification.createdAt
                }
              };
              
              console.log(`📤 Sending SSE message:`, JSON.stringify(sseMessage, null, 2));
              
              // Send to main manager's SSE endpoint
              const response = await fetch(`${mainManagerUrl}/api/notifications/sse`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(sseMessage),
                timeout: 10000 // 10 second timeout
              });
              
              if (!response.ok) {
                const errorText = await response.text().catch(() => 'No error details available');
                console.error(`❌ SSE message failed with status: ${response.status} ${response.statusText}`);
                console.error(`❌ Error response: ${errorText}`);
                
                // Retry on 429 (rate limit) or 5xx errors, but not on 4xx client errors
                if ((response.status === 429 || response.status >= 500) && retryCount < 3) {
                  const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
                  console.log(`🔄 Retrying SSE message in ${delay}ms (attempt ${retryCount + 1}/3)...`);
                  setTimeout(() => sendSSEMessageWithRetry(retryCount + 1), delay);
                  return;
                }
              } else {
                const responseData = await response.json().catch(() => ({}));
                console.log(`✅ SSE message sent successfully to main manager`);
                console.log(`📥 Response:`, responseData);
              }
            } catch (error) {
              console.error('❌ Error sending SSE message:', error.message);
              console.error('❌ Error type:', error.constructor.name);
              
              // Retry on network errors
              if (retryCount < 3 && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
                console.log(`🔄 Retrying SSE message in ${delay}ms due to network error (attempt ${retryCount + 1}/3)...`);
                setTimeout(() => sendSSEMessageWithRetry(retryCount + 1), delay);
                return;
              }
              
              // Check if it's a network error
              if (error.code === 'ECONNREFUSED') {
                console.error('❌ Connection refused - Main manager may not be running on port 5000');
              } else if (error.code === 'ENOTFOUND') {
                console.error('❌ Host not found - Check MAIN_MANAGER_URL environment variable');
              } else if (error.code === 'ETIMEDOUT') {
                console.error('❌ Request timeout - Main manager may be slow to respond');
              }
            }
          };
          
          // Start the SSE message sending process
          sendSSEMessageWithRetry();
        }
        
        // Here you could also:
        // - Send email notifications
        // - Send SMS alerts
        // - Push notifications to mobile apps
        
      } else {
        console.log(`✅ No alert triggered: ${comparisonValue} ${unit} ${alertConfig.condition} ${alertConfig.threshold} ${unit}`);
      }
    }

    await mainDB.close();
  } catch (error) {
    console.error(`❌ Error checking alert conditions for device ${deviceId}:`, error.message);
  }
}

// Helper function to determine parameter from value and device type
function getParameterFromValue(value, deviceType) {
  // For water devices, determine parameter based on the value context
  // This is a simplified example - you might need more sophisticated logic
  if (deviceType === 'water') {
    // Check if the data contains specific parameter indicators
    // For now, we'll use a more flexible approach that can handle different parameters
    return 'flowRate'; // Default to flowRate for water devices, but this should be enhanced
  }
  
  // For other device types, return appropriate parameter
  const parameterMap = {
    energy: 'consumption',
    solar: 'production',
    gas: 'consumption',
    temperature: 'temperature',
    humidity: 'humidity',
    pressure: 'pressure'
  };
  
  return parameterMap[deviceType] || 'value';
}

// Helper function to get daily consumption for a device
async function getDailyConsumption(deviceId, deviceType, siteId) {
  try {
    console.log(`\n🔍 ===== DAILY CONSUMPTION CALCULATION START =====`);
    console.log(`🔍 Device: ${deviceId}`);
    console.log(`🔍 Type: ${deviceType}`);
    console.log(`🔍 Site ID: ${siteId}`);
    
    // Get the site database name
    const mainDB = mongoose.createConnection(process.env.MONGO_URI, {
      dbName: 'iot_dashboard',
      serverSelectionTimeoutMS: 30000,
      authSource: 'iot_dashboard',
      retryWrites: true,
      w: 'majority'
    });

    const Site = mainDB.model('Site', new mongoose.Schema({}, { strict: false }), 'sites');
    const site = await Site.findById(siteId).lean();
    await mainDB.close();

    if (!site) {
      console.log(`⚠️ Site not found for device ${deviceId}, siteId: ${siteId}`);
      return null;
    }

    const siteDbName = site.name.replace(/\s+/g, '_').toLowerCase();
    console.log(`📊 Site Name: ${site.name}`);
    console.log(`📊 Site Database: ${siteDbName}`);
    
    // Connect to site database
    const siteDB = mongoose.createConnection(MONGO_URI_site1, {
      dbName: siteDbName,
      serverSelectionTimeoutMS: 30000,
      authSource: 'site1',
      retryWrites: true,
      w: 'majority'
    });

    // Get the collection model for the device type
    const collectionName = deviceType;
    console.log(`📊 Collection: ${collectionName}`);
    const DeviceDataModel = siteDB.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);

    // Calculate daily consumption (today from 00:00 to 23:59) using UTC
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0); // 00:00:00 today UTC
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999); // 23:59:59 today UTC
    
    console.log(`\n📅 TIME PERIOD CALCULATION:`);
    console.log(`📅 Current Time: ${now.toISOString()}`);
    console.log(`📅 Today Start: ${todayStart.toISOString()} (${todayStart.toLocaleString()})`);
    console.log(`📅 Today End: ${todayEnd.toISOString()} (${todayEnd.toLocaleString()})`);
    console.log(`📅 Query Range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Get all readings for this device for today only
    // Handle different timestamp formats (Date objects, timestamps, strings)
    console.log(`\n🔍 QUERYING TODAY'S DATA...`);
    const readings = await DeviceDataModel.find({
      deviceId: deviceId,
      $or: [
        { timestamp: { $gte: todayStart, $lte: todayEnd } },
        { timestamp: { $gte: todayStart.getTime(), $lte: todayEnd.getTime() } },
        { timestamp: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() } }
      ]
    }).sort({ timestamp: 1 }).lean();

    // Also try a simple query to see if we can find any data at all
    console.log(`\n🔍 CHECKING ALL DEVICE READINGS...`);
    const allDeviceReadings = await DeviceDataModel.find({ deviceId: deviceId }).limit(5).lean();
    console.log(`📊 Total readings for device ${deviceId} in collection: ${allDeviceReadings.length}`);
    if (allDeviceReadings.length > 0) {
      console.log(`📊 Sample device reading:`, JSON.stringify(allDeviceReadings[0], null, 2));
    }

    console.log(`\n📊 TODAY'S READINGS SUMMARY:`);
    console.log(`📊 Found ${readings.length} readings for device ${deviceId} today`);
    
    // Declare totalConsumption at function level
    let totalConsumption = 0;
    
    if (readings.length === 0) {
      console.log(`\n⚠️ NO READINGS TODAY - TRYING YESTERDAY...`);
      
      // Try yesterday's data as fallback
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      
      console.log(`📅 Yesterday Start: ${yesterdayStart.toISOString()} (${yesterdayStart.toLocaleString()})`);
      console.log(`📅 Yesterday End: ${yesterdayEnd.toISOString()} (${yesterdayEnd.toLocaleString()})`);
      
      const yesterdayReadings = await DeviceDataModel.find({
        deviceId: deviceId,
        $or: [
          { timestamp: { $gte: yesterdayStart, $lte: yesterdayEnd } },
          { timestamp: { $gte: yesterdayStart.getTime(), $lte: yesterdayEnd.getTime() } },
          { timestamp: { $gte: yesterdayStart.toISOString(), $lte: yesterdayEnd.toISOString() } }
        ]
      }).sort({ timestamp: 1 }).lean();
      
      if (yesterdayReadings.length === 0) {
        console.log(`📊 No readings found for device ${deviceId} yesterday either`);
        await siteDB.close();
        return null;
      }
      
      console.log(`📊 Found ${yesterdayReadings.length} readings from yesterday, using those for daily calculation`);
      
      // Use yesterday's data as today's consumption estimate
      if (deviceType === 'energy' || deviceType === 'water' || deviceType === 'gas') {
        if (yesterdayReadings.length >= 2) {
          // Get first and last readings from yesterday
          const firstReading = yesterdayReadings[0];
          const lastReading = yesterdayReadings[yesterdayReadings.length - 1];
          
          const firstValue = firstReading.value || firstReading.consumption || firstReading.production || 0;
          const lastValue = lastReading.value || lastReading.consumption || lastReading.production || 0;
          
          // Calculate consumption as the difference (same as chart)
          totalConsumption = lastValue - firstValue;
          
          console.log(`\n📊 YESTERDAY'S CONSUMPTION CALCULATION:`);
          console.log(`📊 First Reading: ${firstValue} at ${firstReading.timestamp} (${new Date(firstReading.timestamp).toLocaleString()})`);
          console.log(`📊 Last Reading: ${lastValue} at ${lastReading.timestamp} (${new Date(lastReading.timestamp).toLocaleString()})`);
          console.log(`📊 Consumption = Last - First = ${lastValue} - ${firstValue} = ${totalConsumption}`);
          console.log(`📊 Using yesterday's consumption as estimate: ${totalConsumption}`);
        } else if (yesterdayReadings.length === 1) {
          // Only one reading from yesterday
          const readingValue = yesterdayReadings[0].value || yesterdayReadings[0].consumption || yesterdayReadings[0].production || 0;
          totalConsumption = readingValue;
          console.log(`\n📊 YESTERDAY'S SINGLE READING:`);
          console.log(`📊 Reading: ${readingValue} at ${yesterdayReadings[0].timestamp} (${new Date(yesterdayReadings[0].timestamp).toLocaleString()})`);
          console.log(`📊 Using yesterday's single reading as estimate: ${totalConsumption}`);
        }
      }
    } else {
      // Log detailed readings for debugging
      console.log(`\n📊 TODAY'S READINGS DETAILS:`);
      if (readings.length > 0) {
        console.log(`📊 Total readings today: ${readings.length}`);
        console.log(`📊 First 3 readings:`);
        readings.slice(0, 3).forEach((r, index) => {
          const timestamp = new Date(r.timestamp);
          console.log(`  ${index + 1}. Time: ${timestamp.toISOString()} (${timestamp.toLocaleString()})`);
          console.log(`     Value: ${r.value || r.consumption || r.production || 'N/A'}`);
          console.log(`     Device ID: ${r.deviceId}`);
          console.log(`     Raw timestamp: ${r.timestamp}`);
        });
        
        if (readings.length > 3) {
          console.log(`  ... and ${readings.length - 3} more readings`);
        }
      }

      // Calculate total consumption for the day
      // For consumption devices, calculate the difference between first and last reading
      // This matches the chart calculation method for cumulative meters
      if (deviceType === 'energy' || deviceType === 'water' || deviceType === 'gas') {
        if (readings.length >= 2) {
          // Get first and last readings for the day
          const firstReading = readings[0];
          const lastReading = readings[readings.length - 1];
          
          const firstValue = firstReading.value || firstReading.consumption || firstReading.production || 0;
          const lastValue = lastReading.value || lastReading.consumption || lastReading.production || 0;
          
          // Calculate consumption as the difference (same as chart)
          totalConsumption = lastValue - firstValue;
          
          console.log(`\n📊 TODAY'S CONSUMPTION CALCULATION:`);
          console.log(`📊 First Reading: ${firstValue} at ${firstReading.timestamp} (${new Date(firstReading.timestamp).toLocaleString()})`);
          console.log(`📊 Last Reading: ${lastValue} at ${lastReading.timestamp} (${new Date(lastReading.timestamp).toLocaleString()})`);
          console.log(`📊 Consumption = Last - First = ${lastValue} - ${firstValue} = ${totalConsumption}`);
          console.log(`📊 Calculation method: Difference between first and last reading (matches chart calculation)`);
        } else if (readings.length === 1) {
          // Only one reading, use it as the consumption
          const readingValue = readings[0].value || readings[0].consumption || readings[0].production || 0;
          totalConsumption = readingValue;
          console.log(`\n📊 TODAY'S SINGLE READING:`);
          console.log(`📊 Reading: ${readingValue} at ${readings[0].timestamp} (${new Date(readings[0].timestamp).toLocaleString()})`);
          console.log(`📊 Using single reading as consumption: ${totalConsumption}`);
        }
      }
    }

    console.log(`\n📊 FINAL RESULT:`);
    console.log(`📊 Daily consumption for device ${deviceId}: ${totalConsumption}`);
    console.log(`📊 Readings used: ${readings.length}`);
    console.log(`📊 Device type: ${deviceType}`);
    console.log(`🔍 ===== DAILY CONSUMPTION CALCULATION END =====\n`);
    
    await siteDB.close();
    
    return totalConsumption;
  } catch (error) {
    console.error(`\n❌ ===== ERROR IN DAILY CONSUMPTION CALCULATION =====`);
    console.error(`❌ Device: ${deviceId}`);
    console.error(`❌ Error message: ${error.message}`);
    console.error(`❌ Error stack:`, error.stack);
    console.error(`❌ ===== ERROR END =====\n`);
    return null;
  }
}

// Helper function to check threshold condition
function checkThresholdCondition(value, threshold, condition) {
  switch (condition) {
    case 'above':
      return value > threshold;
    case 'below':
      return value < threshold;
    case 'equals':
      return value === threshold;
    default:
      return false;
  }
}

// Helper function to update device last reading in main DB
async function updateDeviceLastReading(deviceId, value, unit, timestamp) {
  try {
    const mainDB = mongoose.createConnection(process.env.MONGO_URI, {
      dbName: 'iot_dashboard',
      serverSelectionTimeoutMS: 30000,
      authSource: 'iot_dashboard',
      retryWrites: true,
      w: 'majority'
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

// Helper function to check database connection health
function isConnectionHealthy(connection) {
  return connection && connection.readyState === 1;
}

// Helper function to close and cleanup a database connection
async function closeConnection(connection, siteName) {
  if (connection && connection.readyState !== 0) {
    try {
      await connection.close();
      console.log(`🔌 Closed connection to ${siteName}`);
    } catch (error) {
      console.warn(`⚠️ Error closing connection to ${siteName}:`, error.message);
    }
  }
}

// Helper function to cleanup all site connections
async function cleanupConnections() {
  const cleanupPromises = Object.entries(siteConnections).map(async ([siteName, connection]) => {
    await closeConnection(connection, siteName);
  });
  
  await Promise.allSettled(cleanupPromises);
  siteConnections = {};
  console.log('🧹 Cleaned up all site connections');
}

// Test function to verify daily consumption calculation
export async function testDailyConsumption(deviceId, deviceType, siteId) {
  console.log(`🧪 Testing daily consumption for device ${deviceId}`);
  const result = await getDailyConsumption(deviceId, deviceType, siteId);
  console.log(`🧪 Test result: ${result}`);
  return result;
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
  async disconnect() {
    if (client) {
      client.end();
      console.log('🔌 MQTT client disconnected');
    }
    
    // Cleanup all database connections
    await cleanupConnections();
  }
};

console.log('📊 MQTT Client initialized');


