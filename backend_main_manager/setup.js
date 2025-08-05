import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const setupDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'iot_dashboard',
      maxPoolSize: 10,
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@iotdashboard.com' });
    
    if (!adminExists) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('123456789', 10);
      
      const adminUser = new User({
        name: 'Super Admin User',
        email: 'mounir.mmahroug@gmail.com',
        password: hashedPassword,
        role: 'superadmin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Default admin user created');
      console.log('📧 Email: mounir.mmahroug@gmail.com'); 
      console.log('🔑 Password: 123456789');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Create a test user
    const testUserExists = await User.findOne({ email: 'test@example.com' });
    
    if (!testUserExists) {
      const hashedPassword = await bcrypt.hash('123456789', 10);
      
      const testUser = new User({
        name: 'Test User',
        email: 'mounir.mmahrou2@gmail.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });

      await testUser.save();
      console.log('✅ Test user created');
      console.log('📧 Email: mounir.mmahrou2@gmail.com');  
      console.log('🔑 Password: 123456789');
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