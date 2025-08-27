import express from 'express';
import Notification from '../models/Notification.js';
import Site from '../models/Site.js';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';

const router = express.Router();

// Logging middleware for notifications router
router.use((req, res, next) => {
  console.log(`📢 Notification request: ${req.method} ${req.path} from IP: ${req.ip}`);
  next();
});

// Store connected SSE clients
const sseClients = new Set();

// Helper function to send SSE message to all connected clients
const sendSSEMessage = (data) => {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    if (client.res && !client.res.destroyed) {
      client.res.write(message);
    }
  });
};

// GET /api/notifications/stream - Server-Sent Events endpoint for real-time notifications
router.get('/stream', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  // Add client to connected clients
  const client = { res, id: Date.now() };
  sseClients.add(client);

  console.log(`🔌 SSE client connected. Total clients: ${sseClients.size}`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(client);
    console.log(`🔌 SSE client disconnected. Total clients: ${sseClients.size}`);
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // Send heartbeat every 30 seconds
});

// POST /api/notifications/sse - Receive SSE messages from data manager
router.post('/sse', async (req, res) => {
  try {
    const { type, notification } = req.body;
    
    console.log(`📢 Received SSE message from data manager: ${type}`);
    
    if (type === 'notification_created' && notification) {
      // Broadcast to all connected SSE clients
      sendSSEMessage({
        type: 'notification_created',
        notification: notification
      });
      
      // Process notification delivery (email/SMS) if delivery preferences are set
      try {
        const notificationService = await import('../services/notificationService.js');
        await notificationService.default.processNotificationDelivery(notification._id);
      } catch (deliveryError) {
        console.error('Error processing notification delivery:', deliveryError.message);
      }
      
      // Calculate actual notification count from database
      try {
        const newCount = await Notification.countDocuments({ status: 'new' });
        
        // Send count update
        sendSSEMessage({
          type: 'notification_count_update',
          count: newCount
        });
        
        console.log(`📢 Broadcasted notification to ${sseClients.size} connected clients. New count: ${newCount}`);
      } catch (countError) {
        console.error('Error calculating notification count:', countError);
        // Fallback to incrementing count
        sendSSEMessage({
          type: 'notification_count_update',
          count: 1 // Increment by 1 as fallback
        });
      }
    }
    
    res.json({ success: true, message: 'SSE message processed' });
  } catch (error) {
    console.error('Error processing SSE message:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications - Get all notifications for a user
router.get('/', async (req, res) => {
  try {
    const { userId, status, type, category, priority, limit = 50, page = 1 } = req.query;
    
    // Build query
    const query = {};
    
    if (userId) {
      // Support both email and ObjectId for userId
      // First try to find user by email
      try {
        const user = await User.findOne({ email: userId });
        if (user) {
          query.userId = user._id;
        } else {
          // If not found by email, try as ObjectId
          if (mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = userId;
          } else {
            // If neither email nor valid ObjectId, return empty results
            return res.json({
              notifications: [],
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0,
                pages: 0
              }
            });
          }
        }
      } catch (userError) {
        console.error('Error finding user:', userError);
        // If user lookup fails, return empty results
        return res.json({
          notifications: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }
    
    if (status) {
      query.status = status;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.find(query)
      .populate('siteId', 'name')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Notification.countDocuments(query);
    
    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/count - Get notification counts
router.get('/count', async (req, res) => {
  try {
    console.log(`📊 Notification count request from IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
    
    const { userId } = req.query;
    
    const query = {};
    if (userId) {
      // Support both email and ObjectId for userId
      try {
        const user = await User.findOne({ email: userId });
        if (user) {
          query.userId = user._id;
        } else {
          // If not found by email, try as ObjectId
          if (mongoose.Types.ObjectId.isValid(userId)) {
            query.userId = userId;
          } else {
            // If neither email nor valid ObjectId, return zero counts
            return res.json({
              new: 0,
              read: 0,
              acknowledged: 0,
              resolved: 0,
              total: 0
            });
          }
        }
      } catch (userError) {
        console.error('Error finding user for count:', userError);
        // If user lookup fails, return zero counts
        return res.json({
          new: 0,
          read: 0,
          acknowledged: 0,
          resolved: 0,
          total: 0
        });
      }
    }
    
    const counts = await Notification.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      new: 0,
      read: 0,
      acknowledged: 0,
      resolved: 0,
      total: 0
    };
    
    counts.forEach(item => {
      result[item._id] = item.count;
      result.total += item.count;
    });
    
    console.log(`📊 Notification count response for user ${userId}: ${JSON.stringify(result)}`);
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching notification counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/email-status - Check email configuration status
router.get('/email-status', async (req, res) => {
  try {
    console.log('🔍 Checking email configuration status...');
    
    // Import notification service
    const notificationService = await import('../services/notificationService.js');
    
    const status = {
      smtpConfigured: !!notificationService.default.emailTransporter,
      smtpUser: process.env.SMTP_USER ? 'Set' : 'Not set',
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: process.env.SMTP_PORT || 587,
      smtpFrom: process.env.SMTP_FROM || 'Not set'
    };
    
    if (notificationService.emailTransporter) {
      try {
        await notificationService.emailTransporter.verify();
        status.connectionTest = 'success';
        status.message = 'Email transporter is configured and verified';
      } catch (error) {
        status.connectionTest = 'failed';
        status.message = `Email transporter verification failed: ${error.message}`;
      }
    } else {
      status.connectionTest = 'not_configured';
      status.message = 'Email transporter not configured - SMTP credentials missing';
    }
    
    res.json({
      success: true,
      status: status
    });
    
  } catch (error) {
    console.error('❌ Email status check failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Email status check failed',
      error: error.message
    });
  }
});

// POST /api/notifications/test-email - Test email functionality
router.post('/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing email functionality...');
    
    // Import notification service
    const notificationService = await import('../services/notificationService.js');
    
    // Check if email transporter is configured
    if (!notificationService.default.emailTransporter) {
      return res.status(500).json({
        success: false,
        message: 'Email transporter not configured',
        error: 'SMTP credentials missing or invalid'
      });
    }
    
    // Find a user to send test email to
    const User = await import('../models/User.js');
    const user = await User.default.findOne({}, 'email name');
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No users found in database',
        instructions: 'Please create a user first to test email functionality'
      });
    }
    
    // Create a test notification
    const testNotification = {
      title: '🧪 Email Test Notification',
      message: 'This is a test email to verify SMTP configuration',
      type: 'test',
      priority: 'medium',
      category: 'system',
      deliveryPreferences: {
        email: {
          enabled: true,
          lastSent: null
        }
      }
    };
    
    console.log(`📧 Sending test email to: ${user.email}`);
    
    // Send test email
    const emailResult = await notificationService.sendEmail(testNotification, user);
    
    if (emailResult) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: user.email,
        notification: testNotification
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        recipient: user.email
      });
    }
    
  } catch (error) {
    console.error('❌ Test email failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
});

// Test OVH SMTP configuration specifically
router.get('/test-ovh-smtp', async (req, res) => {
  try {
    console.log('🧪 Testing OVH SMTP configuration specifically...');
    
    // OVH email configuration (exactly like your Python example)
    const ovhConfig = {
      host: "ssl0.ovh.net",
      port: 465,  // SSL port
      secure: true, // SSL
      auth: {
        user: "water-alert@servtelpro.com.tn",
        pass: "Water1234"
      },
      tls: {
        rejectUnauthorized: false
      }
    };

    console.log('📧 OVH SMTP Configuration:');
    console.log(`   Host: ${ovhConfig.host}`);
    console.log(`   Port: ${ovhConfig.port}`);
    console.log(`   Secure: ${ovhConfig.secure}`);
    console.log(`   User: ${ovhConfig.auth.user}`);
    console.log(`   From: ${ovhConfig.auth.user}`);
    console.log(`   To: vdbmvdbm3@gmail.com`);

    try {
      const transporter = nodemailer.createTransport(ovhConfig);
      
      console.log('📧 Verifying OVH connection...');
      await transporter.verify();
      console.log('✅ OVH SMTP connection verified successfully!');
      
      // Test sending email (exactly like your Python example)
      const mailOptions = {
        from: ovhConfig.auth.user, // water-alert@servtelpro.com.tn
        to: "vdbmvdbm3@gmail.com", // Your test email
        subject: "🧪 OVH SMTP Test - DigiSmart Manager",
        text: "Hello, this is a test email from OVH SMTP!", // Plain text like Python
        html: `
          <h2>OVH SMTP Test Successful! 🎉</h2>
          <p>Hello, this is a test email from OVH SMTP!</p>
          <p><strong>Configuration:</strong></p>
          <ul>
            <li>Host: ${ovhConfig.host}</li>
            <li>Port: ${ovhConfig.port} (SSL)</li>
            <li>User: ${ovhConfig.auth.user}</li>
            <li>From: ${ovhConfig.auth.user}</li>
            <li>To: vdbmvdbm3@gmail.com</li>
          </ul>
          <p>Your notification system is now ready to send emails via OVH!</p>
          <hr>
          <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
        `
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ OVH test email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      
      res.json({
        success: true,
        message: 'OVH SMTP test completed successfully (matching Python example)',
        details: {
          connectionVerified: true,
          testEmailSent: true,
          messageId: result.messageId,
          configuration: {
            host: ovhConfig.host,
            port: ovhConfig.port,
            secure: ovhConfig.secure,
            user: ovhConfig.auth.user,
            from: ovhConfig.auth.user,
            to: "vdbmvdbm3@gmail.com"
          },
          pythonEquivalent: {
            smtp_server: ovhConfig.host,
            port: ovhConfig.port,
            login: ovhConfig.auth.user,
            password: "***hidden***",
            sender_email: ovhConfig.auth.user,
            receiver_email: "vdbmvdbm3@gmail.com"
          }
        }
      });
      
    } catch (error) {
      console.error('❌ OVH SMTP test failed:', error.message);
      res.status(500).json({
        success: false,
        message: 'OVH SMTP test failed',
        error: error.message,
        details: {
          code: error.code,
          command: error.command,
          response: error.response
        },
        configuration: ovhConfig
      });
    }
    
  } catch (error) {
    console.error('❌ OVH SMTP test setup failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'OVH SMTP test setup failed',
      error: error.message
    });
  }
});

// Test SMTP configuration directly (using OVH configuration like Python example)
router.get('/test-smtp-direct', async (req, res) => {
  try {
    console.log('🧪 Testing OVH SMTP configuration directly...');
    
    // OVH email configuration (matching your Python example)
    const ovhConfig = {
      host: "ssl0.ovh.net",
      port: 465,  // SSL port
      secure: true, // SSL
      auth: {
        user: "water-alert@servtelpro.com.tn",
        pass: "Water1234"
      },
      tls: {
        rejectUnauthorized: false
      }
    };

    console.log('📧 OVH SMTP Configuration:');
    console.log(`   Host: ${ovhConfig.host}`);
    console.log(`   Port: ${ovhConfig.port}`);
    console.log(`   Secure: ${ovhConfig.secure}`);
    console.log(`   User: ${ovhConfig.auth.user}`);
    console.log(`   From: ${ovhConfig.auth.user}`);
    console.log(`   To: vdbmvdbm3@gmail.com`);

    try {
      console.log('📧 Creating OVH transporter...');
      const transporter = nodemailer.createTransport(ovhConfig);
      
      console.log('📧 Verifying OVH connection...');
      await transporter.verify();
      console.log('✅ OVH SMTP connection verified successfully!');
      
      // Test sending a simple email (matching your Python example)
      console.log('📧 Sending test email...');
      const mailOptions = {
        from: ovhConfig.auth.user, // water-alert@servtelpro.com.tn
        to: "vdbmvdbm3@gmail.com", // Your test email
        subject: "🧪 OVH SMTP Test - DigiSmart Manager",
        html: `
          <h2>OVH SMTP Test Successful! 🎉</h2>
          <p>This is a test email from your DigiSmart Manager system using OVH SMTP.</p>
          <p><strong>Configuration:</strong></p>
          <ul>
            <li>Host: ${ovhConfig.host}</li>
            <li>Port: ${ovhConfig.port} (SSL)</li>
            <li>User: ${ovhConfig.auth.user}</li>
            <li>From: ${ovhConfig.auth.user}</li>
            <li>To: vdbmvdbm3@gmail.com</li>
          </ul>
          <p>Your notification system is now ready to send emails via OVH!</p>
          <hr>
          <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
        `
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ OVH test email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      
      res.json({
        success: true,
        message: 'OVH SMTP test completed successfully',
        details: {
          connectionVerified: true,
          testEmailSent: true,
          messageId: result.messageId,
          configuration: {
            host: ovhConfig.host,
            port: ovhConfig.port,
            secure: ovhConfig.secure,
            user: ovhConfig.auth.user,
            from: ovhConfig.auth.user,
            to: "vdbmvdbm3@gmail.com"
          }
        }
      });
      
    } catch (error) {
      console.error('❌ OVH SMTP test failed:', error.message);
      console.error('❌ Error details:', {
        code: error.code,
        command: error.command,
        response: error.response
      });
      
      res.status(500).json({
        success: false,
        message: 'OVH SMTP test failed',
        error: error.message,
        details: {
          code: error.code,
          command: error.command,
          response: error.response
        },
        configuration: ovhConfig
      });
    }
    
  } catch (error) {
    console.error('❌ OVH SMTP test setup failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'OVH SMTP test setup failed',
      error: error.message
    });
  }
});

// Test SMTP with custom configuration
router.post('/test-smtp-custom', async (req, res) => {
  try {
    console.log('🧪 Testing SMTP with custom configuration...');
    
    const { host, port, secure, user, pass, from, to } = req.body;
    
    // Validate required fields
    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        message: 'User and password are required',
        required: ['user', 'pass'],
        optional: ['host', 'port', 'secure', 'from', 'to']
      });
    }
    
    // Use provided values or defaults
    const smtpConfig = {
      host: host || "ssl0.ovh.net",
      port: parseInt(port) || 465,
      secure: secure === 'true' || true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    };

    console.log('📧 Custom SMTP Configuration:');
    console.log(`   Host: ${smtpConfig.host}`);
    console.log(`   Port: ${smtpConfig.port}`);
           console.log(`   Secure: ${smtpConfig.secure}`);
    console.log(`   User: ${smtpConfig.auth.user}`);

    try {
      const transporter = nodemailer.createTransport(smtpConfig);
      
      console.log('📧 Verifying connection...');
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully!');
      
      // Test sending email
      const mailOptions = {
        from: from || user,
        to: to || "vdbmvdbm3@gmail.com",
        subject: "🧪 Custom SMTP Test - DigiSmart Manager",
        html: `
          <h2>Custom SMTP Test Successful! 🎉</h2>
          <p>This is a test email using custom SMTP configuration.</p>
          <p><strong>Configuration:</strong></p>
          <ul>
            <li>Host: ${smtpConfig.host}</li>
            <li>Port: ${smtpConfig.port} (${smtpConfig.secure ? 'SSL' : 'TLS'})</li>
            <li>User: ${smtpConfig.auth.user}</li>
            <li>From: ${from || user}</li>
          </ul>
          <p>Custom SMTP configuration is working!</p>
          <hr>
          <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
        `
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Custom SMTP test email sent successfully!');
      
      res.json({
        success: true,
        message: 'Custom SMTP test completed successfully',
        details: {
          connectionVerified: true,
          testEmailSent: true,
          messageId: result.messageId,
          configuration: smtpConfig
        }
      });
      
    } catch (error) {
      console.error('❌ Custom SMTP test failed:', error.message);
      res.status(500).json({
        success: false,
        message: 'Custom SMTP test failed',
        error: error.message,
        details: {
          code: error.code,
          command: error.command,
          response: error.response
        },
        configuration: smtpConfig
      });
    }
    
  } catch (error) {
    console.error('❌ Custom SMTP test setup failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Custom SMTP test setup failed',
      error: error.message
    });
  }
});

// Get comprehensive SMTP status and configuration
router.get('/smtp-status-comprehensive', async (req, res) => {
  try {
    console.log('🔍 Getting comprehensive SMTP status...');
    
    const status = {
      environment: {
        smtpUser: process.env.SMTP_USER ? 'Set' : 'Not set',
        smtpPass: process.env.SMTP_PASS ? 'Set' : 'Not set',
        smtpHost: process.env.SMTP_HOST || 'ssl0.ovh.net',
        smtpPort: process.env.SMTP_PORT || 465,
        smtpSecure: process.env.SMTP_SECURE === 'true' || true,
        smtpFrom: process.env.SMTP_FROM || 'Not set'
      },
      notificationService: {
        emailTransporterConfigured: false,
        connectionTest: 'not_tested'
      },
      directSmtp: {
        canCreateTransporter: false,
        connectionTest: 'not_tested'
      }
    };
    
    // Test notification service
    try {
      const notificationService = await import('../services/notificationService.js');
      status.notificationService.emailTransporterConfigured = !!notificationService.default.emailTransporter;
      
      if (notificationService.default.emailTransporter) {
        try {
          await notificationService.default.emailTransporter.verify();
          status.notificationService.connectionTest = 'success';
        } catch (error) {
          status.notificationService.connectionTest = 'failed';
          status.notificationService.error = error.message;
        }
      }
    } catch (error) {
      status.notificationService.error = error.message;
    }
    
    // Test direct SMTP creation
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const smtpConfig = {
          host: process.env.SMTP_HOST || "ssl0.ovh.net",
          port: parseInt(process.env.SMTP_PORT) || 465,
          secure: process.env.SMTP_SECURE === 'true' || true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          tls: { rejectUnauthorized: false }
        };
        
        const transporter = nodemailer.createTransport(smtpConfig);
        status.directSmtp.canCreateTransporter = true;
        
        try {
          await transporter.verify();
          status.directSmtp.connectionTest = 'success';
        } catch (error) {
          status.directSmtp.connectionTest = 'failed';
          status.directSmtp.error = error.message;
        }
      } catch (error) {
        status.directSmtp.error = error.message;
      }
    }
    
    res.json({
      success: true,
      status: status,
      summary: {
        environmentReady: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
        notificationServiceWorking: status.notificationService.connectionTest === 'success',
        directSmtpWorking: status.directSmtp.connectionTest === 'success'
      }
    });
    
  } catch (error) {
    console.error('❌ Comprehensive SMTP status check failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Comprehensive SMTP status check failed',
      error: error.message
    });
    }
});

// GET /api/notifications/:id - Get a specific notification
router.get('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('siteId', 'name')
      .populate('userId', 'name email');
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications - Create a new notification
router.post('/', async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'info',
      category = 'device',
      priority = 'medium',
      siteId,
      deviceId,
      userId,
      metadata = {},
      deliveryPreferences = {}
    } = req.body;
    
    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    const notification = new Notification({
      title,
      message,
      type,
      category,
      priority,
      siteId,
      deviceId,
      userId,
      metadata,
      deliveryPreferences
    });
    
    const savedNotification = await notification.save();
    
    // Populate references
    await savedNotification.populate('siteId', 'name');
    await savedNotification.populate('userId', 'name email');
    
    res.status(201).json(savedNotification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { status: 'new' },
      { 
        status: 'read',
        readAt: new Date()
      }
    );
    
    res.json({
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.markAsRead();
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/:id/acknowledge - Acknowledge notification
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.acknowledge();
    
    res.json(notification);
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notifications/:id/resolve - Resolve notification
router.put('/:id/resolve', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.resolve();
    
    res.json(notification);
  } catch (error) {
    console.error('Error resolving notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/:id/deliver - Process notification delivery (email/SMS)
router.post('/:id/deliver', async (req, res) => {
  try {
    console.log(`📧 Processing delivery for notification: ${req.params.id}`);
    
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      console.log(`❌ Notification not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.log(`📧 Notification found:`, {
      id: notification._id,
      title: notification.title,
      deliveryPreferences: notification.deliveryPreferences,
      userId: notification.userId
    });

    // Process notification delivery (email/SMS)
    const notificationService = await import('../services/notificationService.js');
    await notificationService.default.processNotificationDelivery(notification._id);
    
    console.log(`✅ Notification delivery processed successfully for: ${req.params.id}`);
    res.json({ message: 'Notification delivery processed successfully' });
  } catch (error) {
    console.error('❌ Error processing notification delivery:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/notifications/:id/delivery-preferences - Update delivery preferences
router.put('/:id/delivery-preferences', async (req, res) => {
  try {
    const { email, sms, push } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const preferences = {};
    if (email !== undefined) preferences.email = email;
    if (sms !== undefined) preferences.sms = sms;
    if (push !== undefined) preferences.push = push;
    
    await notification.updateDeliveryPreferences(preferences);
    
    res.json(notification);
  } catch (error) {
    console.error('Error updating delivery preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/:id/delivery-preferences - Get delivery preferences
router.get('/:id/delivery-preferences', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(notification.deliveryPreferences);
  } catch (error) {
    console.error('Error fetching delivery preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/:id/send-test - Send test notification
router.post('/:id/send-test', async (req, res) => {
  try {
    const { channel } = req.body; // 'email', 'sms', or 'push'
    
    const notification = await Notification.findById(req.params.id).populate('userId');
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notificationService = await import('../services/notificationService.js');
    
    let result = false;
  switch (channel) {
      case 'email':
        result = await notificationService.default.sendEmail(notification, notification.userId);
        break;
    // sms and push removed
      default:
        return res.status(400).json({ error: 'Invalid channel' });
    }
    
    res.json({ success: result, message: `Test ${channel} notification sent` });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/delivery-stats - Get delivery statistics
router.get('/delivery-stats', async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          emailEnabled: {
            $sum: { $cond: ['$deliveryPreferences.email.enabled', 1, 0] }
          },
          
        }
      }
    ]);
    
    res.json(stats[0] || { totalNotifications: 0, emailEnabled: 0 });
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test notification service
router.get('/test-service', async (req, res) => {
  try {
    console.log('🧪 Testing notification service...');
    
    // Test if notification service can be imported
    const notificationService = await import('../services/notificationService.js');
    console.log('✅ Notification service imported successfully');
    
    // Test SMTP configuration
    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    console.log(`📧 SMTP configured: ${smtpConfigured}`);
    
    // Test creating a test notification
    const testNotification = new Notification({
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      priority: 'medium',
      category: 'system',
      status: 'new',
      deliveryPreferences: {
        email: { enabled: false, frequency: 'immediate', lastSent: null },
        sms: { enabled: false, frequency: 'immediate', lastSent: null },
        push: { enabled: true, frequency: 'immediate', lastSent: null }
      }
    });
    
    const savedNotification = await testNotification.save();
    console.log('✅ Test notification created successfully');
    
    // Test notification service methods
    const shouldSend = savedNotification.shouldSendNotification('push');
    console.log('✅ Notification service methods working');
    
    // Clean up test notification
    await savedNotification.deleteOne();
    console.log('✅ Test notification cleaned up');
    
    res.json({
      success: true,
      message: 'Notification service is working properly',
      testResults: {
        serviceImported: true,
        notificationCreated: true,
        methodsWorking: true,
        cleanupSuccessful: true,
        smtpConfigured: smtpConfigured,
        smtpUser: process.env.SMTP_USER ? 'configured' : 'not configured',
        smtpPass: process.env.SMTP_PASS ? 'configured' : 'not configured',
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: process.env.SMTP_PORT || 587,
        smtpFrom: process.env.SMTP_FROM || 'noreply@iotdashboard.com'
      }
    });
  } catch (error) {
    console.error('❌ Notification service test failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Notification service test failed',
      error: error.message
    });
  }
});

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing email configuration...');
    
    // Check SMTP configuration
    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (!smtpConfigured) {
      return res.json({
        success: false,
        message: 'SMTP not configured',
        details: {
          smtpUser: process.env.SMTP_USER ? 'configured' : 'missing',
          smtpPass: process.env.SMTP_PASS ? 'configured' : 'missing',
          smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
          smtpPort: process.env.SMTP_PORT || 587,
          smtpFrom: process.env.SMTP_FROM || 'noreply@iotdashboard.com'
        },
        instructions: 'Please set SMTP_USER and SMTP_PASS environment variables to enable email notifications'
      });
    }
    
    // Test notification service import
    const notificationService = await import('../services/notificationService.js');
    console.log('✅ Notification service imported successfully');
    
    res.json({
      success: true,
      message: 'Email configuration is ready',
      details: {
        smtpConfigured: true,
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: process.env.SMTP_PORT || 587,
        smtpUser: 'configured',
        smtpFrom: process.env.SMTP_FROM || 'noreply@iotdashboard.com'
      }
    });
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Email configuration test failed',
      error: error.message
    });
  }
});

// Test notification with user assignment
router.get('/test-notification-with-user', async (req, res) => {
  try {
    console.log('🧪 Testing notification with user assignment...');
    
    // Find a user to assign to the notification
    const User = await import('../models/User.js');
    const user = await User.default.findOne({}, 'email name');
    
    if (!user) {
      return res.json({
        success: false,
        message: 'No users found in database',
        instructions: 'Please create a user first to test notification delivery'
      });
    }
    
    console.log(`📧 Found user for test: ${user.email}`);
    
    // Create a test notification with user assigned
    const testNotification = new Notification({
      title: 'Test Notification with User',
      message: 'This is a test notification with a user assigned for email delivery testing',
      type: 'info',
      priority: 'medium',
      category: 'system',
      status: 'new',
      userId: user._id,
      deliveryPreferences: {
        email: { enabled: true, frequency: 'immediate', lastSent: null },
        sms: { enabled: false, frequency: 'immediate', lastSent: null },
        push: { enabled: true, frequency: 'immediate', lastSent: null }
      }
    });
    
    const savedNotification = await testNotification.save();
    console.log('✅ Test notification created successfully with user assigned');
    
    // Test notification delivery
    const notificationService = await import('../services/notificationService.js');
    await notificationService.default.processNotificationDelivery(savedNotification._id);
    console.log('✅ Test notification delivery processed');
    
    // Clean up test notification
    await savedNotification.deleteOne();
    console.log('✅ Test notification cleaned up');
    
    res.json({
      success: true,
      message: 'Test notification with user assignment completed successfully',
      testResults: {
        userFound: true,
        userEmail: user.email,
        notificationCreated: true,
        deliveryProcessed: true,
        cleanupSuccessful: true
      }
    });
  } catch (error) {
    console.error('❌ Test notification with user failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Test notification with user failed',
      error: error.message
    });
  }
});

// PUT /api/notifications/:id - Update notification
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      category,
      priority,
      status,
      metadata
    } = req.body;
    
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Update fields
    if (title) notification.title = title;
    if (message) notification.message = message;
    if (type) notification.type = type;
    if (category) notification.category = category;
    if (priority) notification.priority = priority;
    if (status) notification.status = status;
    if (metadata) notification.metadata = metadata;
    
    const updatedNotification = await notification.save();
    
    // Populate references
    await updatedNotification.populate('siteId', 'name');
    await updatedNotification.populate('userId', 'name email');
    
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    await notification.deleteOne();
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/bulk/read - Mark multiple notifications as read
router.post('/bulk/read', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }
    
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { 
        status: 'read',
        readAt: new Date()
      }
    );
    
    res.json({
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/bulk/acknowledge - Acknowledge multiple notifications
router.post('/bulk/acknowledge', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }
    
    const result = await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { 
        status: 'acknowledged',
        acknowledgedAt: new Date()
      }
    );
    
    res.json({
      message: `${result.modifiedCount} notifications acknowledged`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error acknowledging notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test alert creation endpoint
router.post('/test-alert', async (req, res) => {
  try {
    console.log('🧪 Creating test alert...');
    
    // Find a user to assign to the alert
    const User = await import('../models/User.js');
    const user = await User.default.findOne({}, 'email name');
    
    if (!user) {
      return res.json({
        success: false,
        message: 'No users found in database',
        instructions: 'Please create a user first to test alert creation'
      });
    }
    
    console.log(`📧 Found user for test alert: ${user.email}`);
    
    // Create a test alert configuration
    const testAlert = {
      title: 'Test Alert',
      message: 'This is a test alert to verify notification delivery',
      type: 'warning',
      priority: 'medium',
      category: 'device',
      parameter: 'flowRate',
      threshold: 100,
      condition: 'above',
      createdBy: user.email,
      emailEnabled: true,
      periodicity: 'immediate',
      assignedUsers: [user.email]
    };
    
    res.json({
      success: true,
      message: 'Test alert configuration created',
      alert: testAlert,
      user: {
        email: user.email,
        name: user.name
      },
      instructions: 'Use this alert configuration to test notification delivery'
    });
  } catch (error) {
    console.error('❌ Test alert creation failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Test alert creation failed',
      error: error.message
    });
  }
});

// Test notification creation with user assignment
router.post('/test-user-notification', async (req, res) => {
  try {
    console.log('🧪 Creating test notification with user assignment...');
    
    const { userEmail, title, message, type = 'warning', priority = 'medium' } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'userEmail is required',
        example: {
          userEmail: 'user@example.com',
          title: 'Test Alert',
          message: 'This is a test notification',
          type: 'warning',
          priority: 'medium'
        }
      });
    }
    
    // Find the user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
        searchedEmail: userEmail,
        instructions: 'Please provide a valid user email that exists in the database'
      });
    }
    
    console.log(`📧 Found user: ${user.email} (${user._id})`);
    
    // Create a test notification assigned to this user
    const testNotification = new Notification({
      title: title || 'Test User Notification',
      message: message || 'This is a test notification assigned to a specific user',
      type: type,
      priority: priority,
      category: 'system',
      status: 'new',
      userId: user._id, // Assign to specific user
      deliveryPreferences: {
        email: { enabled: true, frequency: 'immediate', lastSent: null }
      },
      metadata: {
        siteName: 'Test Site',
        deviceName: 'Test Device',
        parameter: 'testParameter',
        currentValue: 100,
        threshold: 50,
        condition: 'above',
        unit: 'units'
      }
    });
    
    const savedNotification = await testNotification.save();
    console.log('✅ Test notification created successfully');
    
    // Test the filtering by fetching notifications for this user
    const userNotifications = await Notification.find({ userId: user._id });
    const allNotifications = await Notification.find({});
    
    res.json({
      success: true,
      message: 'Test notification with user assignment created successfully',
      testResults: {
        userFound: true,
        userEmail: user.email,
        userId: user._id,
        notificationCreated: true,
        notificationId: savedNotification._id,
        userSpecificCount: userNotifications.length,
        totalNotificationsInSystem: allNotifications.length,
        filteringTest: {
          userNotifications: userNotifications.map(n => ({
            id: n._id,
            title: n.title,
            userId: n.userId
          })),
          allNotifications: allNotifications.map(n => ({
            id: n._id,
            title: n.title,
            userId: n.userId
          }))
        }
      },
      instructions: 'Now test the filtering by calling GET /api/notifications?userId=' + user.email
    });
    
  } catch (error) {
    console.error('❌ Test notification creation failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Test notification creation failed',
      error: error.message
    });
  }
});

export default router; 