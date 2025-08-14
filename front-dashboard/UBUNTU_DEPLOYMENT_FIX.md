# Ubuntu Deployment Fix for Undefined API URL

## Problem Description
The frontend was experiencing errors like:
```
GET http://162.19.25.155:3000/dashboard/undefined/api/notifications/stream net::ERR_ABORTED 404 (Not Found)
```

This occurred because the `NEXT_PUBLIC_BACKEND_URL` environment variable was `undefined`, causing API calls to go to `/dashboard/undefined/api/notifications/stream` instead of the correct backend URL.

## Root Cause
- The `NEXT_PUBLIC_BACKEND_URL` environment variable was not properly set
- Next.js was trying to use `undefined` as the backend URL
- This caused all API calls to fail with 404 errors

## Solution Implemented

### 1. Updated Next.js Configuration
Modified `next.config.ts` to include fallback environment variables:
```typescript
env: {
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000',
},
publicRuntimeConfig: {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000',
},
```

### 2. Created API Configuration Utility
Created `src/config/api.ts` with:
- Centralized API configuration
- Fallback backend URL
- Configuration validation
- Helper functions for building API URLs

### 3. Updated Components
Modified key components to use the new configuration:
- `Header.tsx` - Uses validated API URLs for notifications
- `notifications/page.tsx` - Validates configuration on mount
- All components now use the centralized API configuration

### 4. Created Startup Scripts
Created platform-specific startup scripts that set environment variables:

#### Windows (start-ubuntu.bat)
```batch
set NEXT_PUBLIC_BACKEND_URL=http://162.19.25.155:5000
set PORT=3000
npm run dev
```

#### PowerShell (start-ubuntu.ps1)
```powershell
$env:NEXT_PUBLIC_BACKEND_URL = "http://162.19.25.155:5000"
$env:PORT = "3000"
npm run dev
```

#### Linux/Ubuntu (start-ubuntu.sh)
```bash
export NEXT_PUBLIC_BACKEND_URL="http://162.19.25.155:5000"
export PORT="3000"
npm run dev
```

## How to Use

### Option 1: Use Startup Scripts (Recommended)
1. **Windows**: Double-click `start-ubuntu.bat`
2. **PowerShell**: Run `.\start-ubuntu.ps1`
3. **Linux/Ubuntu**: Run `./start-ubuntu.sh`

### Option 2: Set Environment Variables Manually
```bash
# Linux/Ubuntu
export NEXT_PUBLIC_BACKEND_URL="http://162.19.25.155:5000"
export PORT="3000"
npm run dev

# Windows Command Prompt
set NEXT_PUBLIC_BACKEND_URL=http://162.19.25.155:5000
set PORT=3000
npm run dev

# PowerShell
$env:NEXT_PUBLIC_BACKEND_URL = "http://162.19.25.155:5000"
$env:PORT = "3000"
npm run dev
```

### Option 3: Create .env.local File
Create a `.env.local` file in the frontend root directory:
```env
NEXT_PUBLIC_BACKEND_URL=http://162.19.25.155:5000
PORT=3000
```

## Verification
After starting the frontend, check the browser console for:
```
✅ API Configuration validated: http://162.19.25.155:5000
🔌 Connecting to SSE stream: http://162.19.25.155:5000/api/notifications/stream
```

## Backend Requirements
Ensure your backend server is:
1. Running on port 5000
2. Accessible at `http://162.19.25.155:5000`
3. Has the `/api/notifications/stream` endpoint working
4. CORS is properly configured for the frontend domain

## Troubleshooting

### If API calls still fail:
1. Check if backend is running: `curl http://162.19.25.155:5000/api/health`
2. Verify firewall settings on Ubuntu server
3. Check if port 5000 is open: `netstat -tlnp | grep :5000`

### If environment variables are not set:
1. Restart your terminal/command prompt
2. Use the startup scripts instead of manual commands
3. Check if your shell profile is overriding the variables

### If you need to change the backend URL:
1. Update the startup scripts with the new URL
2. Update `src/config/api.ts` with the new fallback URL
3. Restart the frontend application

## Security Notes
- The backend URL is hardcoded in the fallback for development purposes
- For production, use proper environment variable management
- Consider using environment-specific configuration files
- Ensure your backend has proper authentication and CORS settings
