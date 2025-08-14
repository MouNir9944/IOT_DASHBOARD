# 🚀 Comprehensive Fix for Undefined API URL Issue

## 🎯 **Problem Summary**
The frontend was experiencing critical errors where `process.env.NEXT_PUBLIC_BACKEND_URL` was `undefined`, causing all API calls to fail with URLs like:
- `http://162.19.25.155:3000/dashboard/undefined/api/notifications/stream`
- `http://162.19.25.155:3000/dashboard/undefined/api/sites`
- `http://162.19.25.155:3000/dashboard/undefined/api/users`

## 🔍 **Root Cause Analysis**
1. **Environment Variable Not Set**: `NEXT_PUBLIC_BACKEND_URL` was not properly configured
2. **Next.js Build vs Runtime**: Environment variables in Next.js are only available at build time, not runtime
3. **Multiple Components**: Many components were directly using `process.env.NEXT_PUBLIC_BACKEND_URL`
4. **No Fallback Strategy**: No fallback mechanism when environment variables are missing

## ✅ **Complete Solution Implemented**

### **1. Runtime Configuration System**
Created `src/config/runtime.ts` with multiple fallback strategies:
- Browser runtime configuration injection
- Environment variable fallback
- Hardcoded Ubuntu server fallback
- Global window object configuration

### **2. Centralized API Configuration**
Updated `src/config/api.ts` to use runtime configuration:
- Automatic fallback to Ubuntu server IP
- Configuration validation
- Helper functions for building API URLs

### **3. HTML Head Injection**
Modified `src/app/layout.tsx` to inject configuration immediately:
- Runtime config available before React loads
- No dependency on environment variables
- Immediate availability in browser

### **4. Component Updates**
Updated key components to use centralized configuration:
- `DashboardContent.tsx`
- `DashboardLayout.tsx`
- `page.tsx`
- All components now use `buildApiUrl()` helper

### **5. Startup Scripts**
Created platform-specific startup scripts:
- **Windows**: `start-fixed.bat`
- **PowerShell**: `start-fixed.ps1`
- **Linux/Ubuntu**: `start-fixed.sh`

## 🚀 **How to Use (Choose One)**

### **Option 1: Use Fixed Startup Scripts (Recommended)**
```bash
# Windows
start-fixed.bat

# PowerShell
.\start-fixed.ps1

# Linux/Ubuntu
chmod +x start-fixed.sh
./start-fixed.sh
```

### **Option 2: Manual Environment Variables**
```bash
# Linux/Ubuntu
export NEXT_PUBLIC_BACKEND_URL="http://162.19.25.155:5000"
export NEXT_PUBLIC_FRONTEND_URL="http://162.19.25.155:3000"
export PORT="3000"
npm run dev

# Windows Command Prompt
set NEXT_PUBLIC_BACKEND_URL=http://162.19.25.155:5000
set NEXT_PUBLIC_FRONTEND_URL=http://162.19.25.155:3000
set PORT=3000
npm run dev

# PowerShell
$env:NEXT_PUBLIC_BACKEND_URL = "http://162.19.25.155:5000"
$env:NEXT_PUBLIC_FRONTEND_URL = "http://162.19.25.155:3000"
$env:PORT = "3000"
npm run dev
```

### **Option 3: Create .env.local File**
Create `.env.local` in frontend root:
```env
NEXT_PUBLIC_BACKEND_URL=http://162.19.25.155:5000
NEXT_PUBLIC_FRONTEND_URL=http://162.19.25.155:3000
PORT=3000
NODE_ENV=development
```

## 🔧 **Technical Implementation Details**

### **Runtime Configuration Strategy**
```typescript
// Multiple fallback strategies in order:
// 1. Browser runtime config (window.__RUNTIME_CONFIG__)
// 2. Environment variable (process.env.NEXT_PUBLIC_BACKEND_URL)
// 3. Hardcoded Ubuntu server fallback
export const BACKEND_URL = (() => {
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
    return window.__RUNTIME_CONFIG__.BACKEND_URL;
  }
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  return 'http://162.19.25.155:5000'; // Final fallback
})();
```

### **HTML Head Injection**
```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        window.__RUNTIME_CONFIG__ = {
          BACKEND_URL: '${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000'}',
          FRONTEND_URL: '${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://162.19.25.155:3000'}'
        };
      `,
    }}
  />
</head>
```

### **API URL Building**
```typescript
// Instead of: process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'
// Use: buildApiUrl('/api/sites')

export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BACKEND_URL}${endpoint}`;
};
```

## ✅ **Verification Steps**

### **1. Check Browser Console**
After starting, look for:
```
🔧 Runtime configuration injected: {BACKEND_URL: "http://162.19.25.155:5000", ...}
✅ Runtime Configuration validated: {BACKEND_URL: "http://162.19.25.155:5000", ...}
✅ API Configuration validated: http://162.19.25.155:5000
```

### **2. Check Network Tab**
API calls should now go to:
- ✅ `http://162.19.25.155:5000/api/sites`
- ✅ `http://162.19.25.155:5000/api/notifications/stream`
- ❌ No more `undefined` in URLs

### **3. Check Component Logs**
Look for:
```
API URLs: {SITES_API_URL: 'http://162.19.25.155:5000/api/sites', ...}
🔌 Connecting to SSE stream: http://162.19.25.155:5000/api/notifications/stream
```

## 🛠️ **Troubleshooting**

### **If API calls still fail:**
1. **Use the fixed startup scripts** - they guarantee environment variables
2. **Check browser console** for runtime configuration messages
3. **Verify backend is running** at `http://162.19.25.155:5000`
4. **Check firewall settings** on Ubuntu server

### **If environment variables are not set:**
1. **Restart terminal/command prompt** after setting variables
2. **Use startup scripts** instead of manual commands
3. **Check shell profile** for variable overrides

### **If you need to change URLs:**
1. **Update startup scripts** with new URLs
2. **Update `src/config/runtime.ts`** with new fallback URLs
3. **Restart frontend** application

## 🔒 **Security Notes**
- Backend URL fallback is hardcoded for development purposes
- For production, use proper environment variable management
- Consider environment-specific configuration files
- Ensure backend has proper authentication and CORS settings

## 📋 **Files Modified**
- `src/config/runtime.ts` - New runtime configuration system
- `src/config/api.ts` - Updated to use runtime config
- `src/app/layout.tsx` - Added runtime config injection
- `src/app/dashboard/components/DashboardContent.tsx` - Updated API usage
- `src/app/dashboard/components/DashboardLayout.tsx` - Updated API usage
- `src/app/dashboard/page.tsx` - Updated API usage
- `start-fixed.bat` - Windows startup script
- `start-fixed.ps1` - PowerShell startup script
- `start-fixed.sh` - Linux/Ubuntu startup script

## 🎉 **Expected Result**
After implementing this solution:
- ✅ No more `undefined` API URLs
- ✅ All API calls go to correct backend
- ✅ Real-time notifications work
- ✅ Dashboard loads properly
- ✅ No more 404 errors on API endpoints

## 🚀 **Quick Start**
1. **Choose your platform startup script**
2. **Run the script** (it sets all environment variables)
3. **Frontend starts** with correct configuration
4. **Check browser console** for validation messages
5. **Enjoy working IoT Dashboard!**

The solution provides multiple layers of fallback and will prevent the "undefined API URL" issue from occurring again, regardless of environment variable configuration.
