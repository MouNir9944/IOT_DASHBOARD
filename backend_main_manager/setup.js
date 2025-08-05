import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const setupDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect("https://iot-dashboard-qa2y.onrender.com", {
      dbName: 'iot_dashboard',
      maxPoolSize: 10,
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@iotdashboard.com' });
    
    if (!adminExists) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@iotdashboard.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Default admin user created');
      console.log('📧 Email: admin@iotdashboard.com');
      console.log('🔑 Password: admin123');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Create a test user
    const testUserExists = await User.findOne({ email: 'test@example.com' });
    
    if (!testUserExists) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user',
        isActive: true
      });

      await testUser.save();
      console.log('✅ Test user created');
      console.log('📧 Email: test@example.com');
      console.log('🔑 Password: password123');
    } else {
      console.log('ℹ️ Test user already exists');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nYou can now start the server with:');
    console.log('npm run dev');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
};

// Run setup
setupDatabase(); 