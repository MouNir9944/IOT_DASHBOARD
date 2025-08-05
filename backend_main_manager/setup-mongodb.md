# MongoDB Setup Guide

## Option 1: MongoDB Atlas (Recommended)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/atlas
   - Sign up for a free account
   - Create a new cluster (free tier is sufficient)

2. **Get Connection String**
   - In Atlas dashboard, click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

3. **Set Environment Variable**
   ```bash
   # Windows PowerShell
   $env:MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/iot_dashboard?retryWrites=true&w=majority"
   
   # Or create a .env file (not tracked by git)
   echo "MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/iot_dashboard?retryWrites=true&w=majority" > .env
   ```

## Option 2: Local MongoDB Installation

1. **Install MongoDB Community Server**
   - Download from: https://www.mongodb.com/try/download/community
   - Or use winget: `winget install MongoDB.Server`

2. **Start MongoDB Service**
   ```bash
   # Windows
   net start MongoDB
   
   # Or start manually
   mongod --dbpath C:\data\db
   ```

3. **Set Environment Variable**
   ```bash
   $env:MONGO_URI="mongodb://localhost:27017/iot_dashboard"
   ```

## Quick Test

After setting up MongoDB, test the connection:

```bash
cd backend_main_manager
node server.js
```

You should see: `✅ MongoDB Connected Successfully`

## Environment Variables

Create a `.env` file in the `backend_main_manager` directory:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/iot_dashboard
# OR for Atlas: MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/iot_dashboard?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# MQTT Configuration
MQTT_BROKER_URL=mqtt://broker.hivemq.com

# Deployment URL
DEPLOYED_URL=http://localhost:5000
```

## Troubleshooting

- **Connection refused**: MongoDB is not running
- **Authentication failed**: Wrong username/password in Atlas connection string
- **Network error**: Check firewall settings or use Atlas instead of local MongoDB 