# 🚀 CORS Fix Solution for Ubuntu Server Deployment

## 🎯 **Problem Identified**
The frontend was correctly getting the backend URL (`http://localhost:5000`), but all API calls were failing with **CORS (Cross-Origin Resource Sharing) errors**:

```
Access to fetch at 'http://localhost:5000/api/sites' from origin 'http://162.19.25.155:3000' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value 'http://localhost:3000' that is not equal to the supplied origin.
```

## 🔍 **Root Cause**
The backend server's CORS configuration was only allowing requests from `http://localhost:3000`, but your frontend is running on `http://162.19.25.155:3000` (Ubuntu server IP).

## ✅ **Solution Implemented**

### **1. Updated Backend CORS Configuration**
Modified `backend_main_manager/server.js` to allow multiple origins:

```javascript
// CORS configuration for frontend
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://162.19.25.155:3000',
      'http://162.19.25.155:5000',
      process.env.CORS_ORIGIN
    ].filter(Boolean); // Remove undefined values
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### **2. Updated Socket.IO CORS Configuration**
Also updated Socket.IO CORS settings to match:

```javascript
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Same origin validation logic as above
      // ... (same code as above)
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  // ... other Socket.IO options
});
```

### **3. Created Backend Startup Scripts**
Created platform-specific startup scripts that set the correct CORS environment variables:

- **Windows**: `backend_main_manager/start-ubuntu.bat`
- **PowerShell**: `backend_main_manager/start-ubuntu.ps1`
- **Linux/Ubuntu**: `backend_main_manager/start-ubuntu.sh`

## 🚀 **How to Use**

### **Step 1: Restart Backend with New CORS Settings**
Choose your platform and run the appropriate startup script:

```bash
# Windows
cd backend_main_manager
start-ubuntu.bat

# PowerShell
cd backend_main_manager
.\start-ubuntu.ps1

# Linux/Ubuntu
cd backend_main_manager
chmod +x start-ubuntu.sh
./start-ubuntu.sh
```

### **Step 2: Verify CORS is Working**
After restarting the backend, check the console for:
```
✅ CORS configuration updated
✅ Allowing origins: localhost:3000, 162.19.25.155:3000, 162.19.25.155:5000
```

### **Step 3: Test Frontend API Calls**
The frontend should now be able to make API calls without CORS errors. Check the browser console for:
```
✅ API calls successful
✅ No more CORS errors
```

## 🔧 **Technical Details**

### **CORS Origins Allowed**
- `http://localhost:3000` - Local development
- `http://162.19.25.155:3000` - Ubuntu server frontend
- `http://162.19.25.155:5000` - Ubuntu server backend
- `process.env.CORS_ORIGIN` - Environment variable override

### **Security Features**
- Origin validation function
- Credentials support for authenticated requests
- Proper error logging for blocked origins
- Fallback to environment variable configuration

## 🛠️ **Troubleshooting**

### **If CORS errors persist:**
1. **Restart the backend server** after making CORS changes
2. **Check backend console** for CORS configuration messages
3. **Verify environment variables** are set correctly
4. **Check firewall settings** on Ubuntu server

### **If you need to add more origins:**
1. **Edit `backend_main_manager/server.js`**
2. **Add new origins to the `allowedOrigins` array**
3. **Restart the backend server**

### **If you need to change the Ubuntu server IP:**
1. **Update all startup scripts** with new IP address
2. **Update CORS configuration** in `server.js`
3. **Restart both frontend and backend**

## 📋 **Files Modified**
- `backend_main_manager/server.js` - Updated CORS configuration
- `backend_main_manager/start-ubuntu.bat` - Windows startup script
- `backend_main_manager/start-ubuntu.ps1` - PowerShell startup script
- `backend_main_manager/start-ubuntu.sh` - Linux/Ubuntu startup script

## 🎉 **Expected Result**
After implementing this solution:
- ✅ No more CORS errors
- ✅ API calls work from Ubuntu server frontend
- ✅ Real-time notifications work
- ✅ WebSocket connections work
- ✅ All dashboard functionality restored

## 🚀 **Quick Start**
1. **Stop the current backend server** (Ctrl+C)
2. **Run the appropriate startup script** for your platform
3. **Verify CORS configuration** in backend console
4. **Test frontend functionality** - API calls should work!

The CORS issue will be completely resolved, and your IoT Dashboard will work properly on the Ubuntu server deployment.
