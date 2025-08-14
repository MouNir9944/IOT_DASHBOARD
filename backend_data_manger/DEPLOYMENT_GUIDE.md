# 🚀 Data Manager Backend Deployment Guide for Ubuntu Server

## 🎯 **Overview**
This guide covers deploying the IoT Dashboard Data Manager backend on your Ubuntu server at `162.19.25.155`.

## 🔧 **Environment Configuration**

### **Required Environment Variables**
```bash
# Server Configuration
PORT=5001                           # Data Manager port
NODE_ENV=development               # Environment mode
MONGO_URI=mongodb://localhost:27017/iot_dashboard  # MongoDB connection

# Server URLs
MAIN_MANAGER_URL=http://162.19.25.155:5000    # Main backend URL
DEPLOYED_URL=http://162.19.25.155:5001        # Data Manager public URL
CORS_ORIGIN=http://162.19.25.155:3000         # Frontend URL for CORS
```

## 🚀 **Quick Start (Choose Your Platform)**

### **Option 1: Windows Command Prompt**
```cmd
cd backend_data_manger
start-ubuntu.bat
```

### **Option 2: PowerShell**
```powershell
cd backend_data_manger
.\start-ubuntu.ps1
```

### **Option 3: Linux/Ubuntu**
```bash
cd backend_data_manger
chmod +x start-ubuntu.sh
./start-ubuntu.sh
```

### **Option 4: Manual Environment Variables**
```bash
# Linux/Ubuntu
export PORT=5001
export NODE_ENV=development
export MONGODB_URI="mongodb://localhost:27017/iot_dashboard"
export MAIN_MANAGER_URL="http://162.19.25.155:5000"
export DEPLOYED_URL="http://162.19.25.155:5001"
export CORS_ORIGIN="http://162.19.25.155:3000"

npm start
```

## 📊 **Service Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Main Backend   │    │  Data Manager   │
│   Port: 3000    │◄──►│   Port: 5000     │◄──►│   Port: 5001    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔌 **API Endpoints Available**

### **Health & Status**
- `GET /ping` - Health check endpoint
- `GET /api/mqtt/status` - MQTT client status

### **Data Management**
- `POST /api/site/:siteId/:type/index` - Get site-specific data index
- `POST /api/global/:type/index` - Get global data index across sites

### **MQTT Management**
- `POST /api/mqtt/reinitialize` - Reinitialize MQTT subscriptions

### **User Management**
- `GET /api/users-groups` - Get users and groups for assignment
- `POST /api/devices/:deviceId/alerts/:alertId/assign-users` - Assign users/groups to alerts

### **Integration**
- `GET /api/test-main-manager` - Test connection to main backend

## 🌐 **CORS Configuration**

The data manager now includes comprehensive CORS support for:
- `http://localhost:3000` - Local development
- `http://162.19.25.155:3000` - Ubuntu server frontend
- `http://162.19.25.155:5000` - Main backend
- `http://162.19.25.155:5001` - Data manager backend
- `http://162.19.25.155:5002` - Additional backend (if needed)

## 📡 **MQTT Integration**

The data manager automatically:
- Connects to MQTT broker
- Subscribes to device topics
- Processes incoming data
- Stores data in site-specific databases
- Provides real-time data aggregation

## 🔍 **Verification Steps**

### **1. Check Service Status**
After starting, look for:
```
✅ Main DB Connected
🚀 Data Manager Server running on port 5001
📊 Available endpoints: [list of endpoints]
```

### **2. Test Health Endpoint**
```bash
curl http://162.19.25.155:5001/ping
```
Expected response:
```json
{
  "message": "MQTT Data Manager is alive",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "healthy"
}
```

### **3. Test Main Manager Connection**
```bash
curl http://162.19.25.155:5001/api/test-main-manager
```

### **4. Check MQTT Status**
```bash
curl http://162.19.25.155:5001/api/mqtt/status
```

## 🛠️ **Troubleshooting**

### **If MongoDB Connection Fails**
1. Verify MongoDB is running: `sudo systemctl status mongod`
2. Check MongoDB port: `netstat -tlnp | grep 27017`
3. Verify database exists: `mongo iot_dashboard`

### **If Port 5001 is Already in Use**
```bash
# Check what's using the port
sudo netstat -tlnp | grep 5001

# Kill the process if needed
sudo kill -9 <PID>

# Or use a different port
export PORT=5002
npm start
```

### **If CORS Errors Occur**
1. Verify CORS configuration in startup script
2. Check that frontend URL is in allowed origins
3. Restart the data manager after CORS changes

### **If MQTT Connection Fails**
1. Check MQTT broker status
2. Verify MQTT configuration in `.env` file
3. Check network connectivity to MQTT broker

## 🔒 **Security Considerations**

- **CORS**: Only allows specific origins
- **Rate Limiting**: Built-in protection against abuse
- **Input Validation**: All endpoints validate input data
- **Database Isolation**: Site-specific data is isolated

## 📋 **Files Modified for Deployment**

- `servermqtt.js` - Added CORS configuration and environment variable support
- `start-ubuntu.bat` - Windows startup script with all environment variables
- `start-ubuntu.ps1` - PowerShell startup script with all environment variables
- `start-ubuntu.sh` - Linux/Ubuntu startup script with all environment variables

## 🎉 **Expected Result**

After successful deployment:
- ✅ Data Manager running on port 5001
- ✅ MQTT client connected and processing data
- ✅ CORS properly configured for Ubuntu server
- ✅ All API endpoints accessible
- ✅ Integration with main backend working
- ✅ Real-time data processing active

## 🚀 **Next Steps**

1. **Start the data manager** using one of the startup scripts
2. **Verify all endpoints** are working
3. **Test MQTT integration** with your devices
4. **Monitor logs** for any errors or issues
5. **Test frontend integration** from your Ubuntu server

Your IoT Dashboard Data Manager is now fully configured for Ubuntu server deployment!
