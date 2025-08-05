import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/iot_dashboard', {
      dbName: 'iot_dashboard',
      maxPoolSize: 10,
    });
    console.log('✅ Connected to MongoDB');

    // Check if superadmin already exists
    const superAdminExists = await User.findOne({ email: 'mounir.mmahroug@gmail.com' });
    
    if (superAdminExists) {
      console.log('ℹ️ Superadmin user already exists');
      console.log('📧 Email: mounir.mmahroug@gmail.com');
      console.log('🔑 Password: 123456789');
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('123456789', 10);
    
    // Create superadmin user
    const superAdmin = new User({
      name: 'mounir',
      email: 'mounir.mmahroug@gmail.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    await superAdmin.save();
    console.log('✅ Superadmin user created successfully!');
    console.log('👤 Name: mounir');
    console.log('📧 Email: mounir.mmahroug@gmail.com');
    console.log('🔑 Password: 123456789');
    console.log('👑 Role: admin');
    
    console.log('\n🎉 You can now login to your dashboard!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create superadmin:', error.message);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin(); 