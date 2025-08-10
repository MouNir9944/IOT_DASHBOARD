import nodemailer from 'nodemailer';
import twilio from 'twilio';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

class NotificationService {
  constructor() {
    // Email configuration - only create if SMTP credentials are available
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ,
        port: process.env.SMTP_PORT ,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Test the connection
      this.emailTransporter.verify()
        .then(() => {
          console.log('✅ Email transporter configured and verified');
        })
        .catch((error) => {
          console.error('❌ Email transporter verification failed:', error.message);
          this.emailTransporter = null;
        });
    } else {
      this.emailTransporter = null;
      console.log('⚠️ Email transporter not configured - SMTP credentials missing');
    }

    // SMS removed per requirement
    this.twilioClient = null;
  }

  // Send email notification
  async sendEmail(notification, user) {
    try {
      if (!user.email) {
        console.log('❌ No email address found for user');
        return false;
      }

      // Check if email transporter is configured
      if (!this.emailTransporter) {
        console.log('❌ Email transporter not configured. Please set SMTP_USER and SMTP_PASS environment variables');
        console.log('📧 Email would have been sent to:', user.email);
        console.log('📧 Subject:', `[${notification.priority.toUpperCase()}] ${notification.title}`);
        return false;
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@iotdashboard.com',
        to: user.email,
        subject: `[${notification.priority.toUpperCase()}] ${notification.title}`,
        html: this.generateEmailTemplate(notification, user)
      };

      console.log(`📧 Attempting to send email to: ${user.email}`);
      await this.emailTransporter.sendMail(mailOptions);
      
      // Update last sent timestamp if notification is a Mongoose model
      if (notification.deliveryPreferences?.email) {
        notification.deliveryPreferences.email.lastSent = new Date();
        if (typeof notification.save === 'function') {
          await notification.save();
        }
      }
      
      console.log(`✅ Email sent to ${user.email} for notification: ${notification.title}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        command: error.command
      });
      return false;
    }
  }

  // SMS sending removed

  // Generate email HTML template
  generateEmailTemplate(notification, user) {
    const md = notification.metadata || {};
    const siteName = md.siteName || notification.siteId?.name || 'Unknown site';
    const deviceName = md.deviceName || notification.deviceId || 'Unknown device';
    const parameter = md.parameter || 'N/A';
    const unit = md.unit ? ` ${md.unit}` : '';
    const isConsumptionParam = String(parameter).toLowerCase() === 'consumption';
    const displayValue = (isConsumptionParam && md.dailyConsumption != null)
      ? md.dailyConsumption
      : (md.comparisonValue ?? md.currentValue ?? 'N/A');
    const valueLabel = isConsumptionParam ? 'Daily Consumption' : 'Current Value';
    const threshold = (md.threshold ?? 'N/A');
    const condition = md.condition ? md.condition.toUpperCase() : 'N/A';
    const deviceType = md.deviceType || 'N/A';

    // Format numbers to 3 decimal places when numeric
    const formatValue = (val) => {
      const num = Number(val);
      if (Number.isFinite(num)) return num.toFixed(3);
      return val ?? 'N/A';
    };
    const formattedDisplayValue = formatValue(displayValue);
    const formattedThreshold = formatValue(threshold);
    const formattedDaily = formatValue(md.dailyConsumption);

    const priorityColors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444',
      critical: '#DC2626'
    };

    const typeIcons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>DigiSmart Manager Alert</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: ${priorityColors[notification.priority]}; color: white; padding: 25px 20px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0 0 15px 0; font-size: 24px; font-weight: 600; }
          .content { background: #f9f9f9; padding: 25px 20px; border-radius: 0 0 8px 8px; }
          .priority { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .type { display: inline-block; margin-left: 15px; font-size: 14px; opacity: 0.9; }
          .footer { margin-top: 25px; padding: 20px; background: #f5f5f5; border-radius: 0 0 8px 8px; font-size: 13px; color: #666; }
          .details { margin: 25px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid ${priorityColors[notification.priority]}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .details strong { color: #2c3e50; font-size: 16px; }
          .kv { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .kv th, .kv td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; }
          .kv th { color: #555; width: 40%; font-weight: 600; background: #f8f9fa; }
          .kv tr:nth-child(odd) { background: #fafafa; }
          .kv tr:hover { background: #f0f0f0; }
          p { margin: 8px 0; }
          strong { color: #2c3e50; }
          em { color: #e74c3c; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${typeIcons[notification.type]} ${notification.title}</h1>
            <div>
              <span class="priority" style="background: ${priorityColors[notification.priority]}; color: white;">
                ${notification.priority.toUpperCase()}
              </span>
              <span class="type">${notification.type.toUpperCase()}</span>
            </div>
          </div>
          <div class="content">
            <p><strong>Hello ${user.name || user.email},</strong></p>
            <p>You have received a <strong>${notification.priority}</strong> priority alert from your DigiSmart Manager.</p>
            <p><strong>Alert Summary:</strong></p>
            <p>${notification.message}</p>
            <p><strong>Threshold:</strong> ${condition} ${formattedThreshold}${unit}</p>
            ${isConsumptionParam && md.dailyConsumption != null ? `<p><strong>Daily Consumption:</strong> ${formattedDaily}${unit}</p>` : ''}
            <div class="details">
              <strong>Alert Details</strong>
              <table class="kv">
                <tr>
                  <th>Site</th>
                  <td>${siteName}</td>
                </tr>
                <tr>
                  <th>Device</th>
                  <td>${deviceName}</td>
                </tr>
                <tr>
                  <th>Device Type</th>
                  <td>${deviceType}</td>
                </tr>
                <tr>
                  <th>Parameter</th>
                  <td>${parameter}</td>
                </tr>
                <tr>
                  <th>${valueLabel}</th>
                  <td>${formattedDisplayValue}${unit}</td>
                </tr>
                <tr>
                  <th>Threshold</th>
                  <td>${condition} ${formattedThreshold}${unit}</td>
                </tr>
                <tr>
                  <th>Category</th>
                  <td>${notification.category}</td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td>${new Date(notification.createdAt).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <p>This is an automated notification from your DigiSmart Manager system.</p>
            <p><em>Please review this alert and take appropriate action if necessary.</em></p>
          </div>
          <div class="footer">
            <p>This is an automated alert from your DigiSmart Manager system. Please do not reply to this email.</p>
            <p>To manage your notification preferences, please log into your dashboard.</p>
            <p>© ${new Date().getFullYear()} DigiSmart Manager. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // SMS text removed

  // Process notification delivery based on preferences
  async processNotificationDelivery(notificationId) {
    try {
      console.log(`📧 Starting delivery processing for notification: ${notificationId}`);
      
      const notification = await Notification.findById(notificationId).populate('userId');
      if (!notification) {
        console.log('❌ Notification not found:', notificationId);
        return;
      }

      console.log(`📧 Notification loaded:`, {
        id: notification._id,
        title: notification.title,
        deliveryPreferences: notification.deliveryPreferences,
        userId: notification.userId
      });

      const user = notification.userId;
      if (!user) {
        console.log('⚠️ No user associated with notification:', notificationId);
        console.log('📧 Skipping email/SMS delivery - notification will only appear in UI');
        return;
      }

      console.log(`📧 User found:`, {
        id: user._id,
        name: user.name,
        email: user.email
      });

      // Check and send email
      if (notification.deliveryPreferences?.email?.enabled) {
        console.log(`📧 Email delivery enabled, checking if should send...`);
        const shouldSendEmail = notification.shouldSendNotification('email');
        console.log(`📧 Should send email: ${shouldSendEmail}`);
        
        if (shouldSendEmail) {
          console.log(`📧 Sending email to: ${user.email}`);
          await this.sendEmail(notification, user);
        } else {
          console.log(`📧 Email not sent - frequency limit reached`);
        }
      } else {
        console.log(`📧 Email delivery disabled or not configured`);
      }

      // SMS delivery removed

      console.log(`✅ Notification delivery processing completed for: ${notificationId}`);

    } catch (error) {
      console.error('❌ Error processing notification delivery:', error);
      console.error('❌ Error stack:', error.stack);
      throw error; // Re-throw to be caught by the calling function
    }
  }

  // Set delivery preferences based on priority
  setPriorityBasedPreferences(notification, priority) {
    const prioritySettings = notification.priorityDelivery[priority];
    
    if (prioritySettings) {
      notification.deliveryPreferences.email.enabled = prioritySettings.email;
      notification.deliveryPreferences.sms.enabled = prioritySettings.sms;
      notification.deliveryPreferences.email.frequency = prioritySettings.frequency;
      notification.deliveryPreferences.sms.frequency = prioritySettings.frequency;
    }
    
    return notification;
  }

  // Update notification delivery preferences
  async updateDeliveryPreferences(notificationId, preferences) {
    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.updateDeliveryPreferences(preferences);
      return notification;
    } catch (error) {
      console.error('Error updating delivery preferences:', error);
      throw error;
    }
  }
}

export default new NotificationService(); 