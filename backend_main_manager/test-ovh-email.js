import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test SMTP configuration using environment variables
async function testSMTPEmail() {
  console.log('🧪 Testing SMTP configuration...');
  
  // Check if required environment variables are set
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SMTP_USER:', process.env.SMTP_USER ? 'Set' : 'Missing');
    console.error('   - SMTP_PASS:', process.env.SMTP_PASS ? 'Set' : 'Missing');
    console.error('📧 Please create a .env file with your SMTP credentials');
    return;
  }
  
  // Email configuration using environment variables
  const smtpConfig = {
    host: process.env.SMTP_HOST || "ssl0.ovh.net",
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true' || true, // Default to SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  console.log('📧 SMTP Configuration:');
  console.log(`   Host: ${smtpConfig.host}`);
  console.log(`   Port: ${smtpConfig.port}`);
  console.log(`   Secure: ${smtpConfig.secure}`);
  console.log(`   User: ${smtpConfig.auth.user}`);

  try {
    console.log('📧 Creating transporter...');
    const transporter = nodemailer.createTransport(smtpConfig);
    
    console.log('📧 Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    // Test sending a simple email
    console.log('📧 Sending test email...');
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: "vdbmvdbm3@gmail.com", // Your test email
      subject: "🧪 SMTP Test - DigiSmart Manager",
      html: `
        <h2>SMTP Test Successful! 🎉</h2>
        <p>This is a test email from your DigiSmart Manager system.</p>
        <p><strong>Configuration:</strong></p>
        <ul>
          <li>Host: ${smtpConfig.host}</li>
          <li>Port: ${smtpConfig.port} (${smtpConfig.secure ? 'SSL' : 'TLS'})</li>
          <li>User: ${smtpConfig.auth.user}</li>
          <li>From: ${process.env.SMTP_FROM || process.env.SMTP_USER}</li>
        </ul>
        <p>Your notification system is now ready to send emails!</p>
        <hr>
        <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.error('❌ Error details:', {
      code: error.code,
      command: error.command,
      response: error.response
    });
  }
}

// Run the test
testSMTPEmail();
