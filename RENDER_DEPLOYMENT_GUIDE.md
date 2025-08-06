# Render Deployment Guide for IoT Dashboard

## Overview
This guide will help you deploy your IoT Dashboard to Render with proper WebSocket support.

## Backend Deployment (backend_main_manager)

### 1. Environment Variables
Set these environment variables in your Render backend service:

```
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_atlas_connection_string
MQTT_BROKER_URL=your_mqtt_broker_url
CORS_ORIGIN=https://your-frontend-app-name.onrender.com
DEPLOYED_URL=https://your-backend-app-name.onrender.com
```

### 2. Build Command
```
npm install
```

### 3. Start Command
```
npm start
```

### 4. Important Notes for Backend
- The server will automatically use the PORT provided by Render
- WebSocket server is configured to accept connections from the frontend URL
- CORS is configured to allow your frontend domain
- Self-ping mechanism keeps the server alive

## Frontend Deployment (front-dashboard)

### 1. Environment Variables
Set these environment variables in your Render frontend service:

```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com
```

### 2. Build Command
```
npm install && npm run build
```

### 3. Start Command
```
npm start
```

### 4. Important Notes for Frontend
- The WebSocket connection now uses the environment variable instead of hardcoded localhost
- All API calls use the same environment variable for consistency

## WebSocket Configuration

### Backend Changes Made:
1. **Enhanced CORS Configuration**: Added fallback and additional methods
2. **Transport Configuration**: Explicitly enabled both WebSocket and polling transports
3. **Environment Variable Support**: Uses CORS_ORIGIN environment variable

### Frontend Changes Made:
1. **Dynamic WebSocket URL**: Now uses `NEXT_PUBLIC_BACKEND_URL` instead of hardcoded localhost
2. **Fallback Support**: Falls back to localhost for local development

## Troubleshooting WebSocket Issues

### 1. Check Environment Variables
Ensure both services have the correct environment variables set:
- Backend: `CORS_ORIGIN` should point to your frontend URL
- Frontend: `NEXT_PUBLIC_BACKEND_URL` should point to your backend URL

### 2. Verify URLs
- Backend URL: `https://your-backend-app-name.onrender.com`
- Frontend URL: `https://your-frontend-app-name.onrender.com`

### 3. Check Browser Console
Look for WebSocket connection errors in the browser console:
- Connection refused errors
- CORS errors
- Transport errors

### 4. Test WebSocket Connection
You can test the WebSocket connection using browser dev tools:
```javascript
const socket = io('https://your-backend-app-name.onrender.com');
socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (error) => console.log('Connection error:', error));
```

## Common Issues and Solutions

### Issue: WebSocket Connection Refused
**Solution**: 
- Check that your backend service is running
- Verify the `NEXT_PUBLIC_BACKEND_URL` environment variable is correct
- Ensure CORS_ORIGIN is set to your frontend URL

### Issue: CORS Errors
**Solution**:
- Verify CORS_ORIGIN environment variable in backend
- Check that the frontend URL is exactly correct (including https://)

### Issue: WebSocket Transport Errors
**Solution**:
- The server now supports both WebSocket and polling transports
- Check that your Render service allows WebSocket connections

### Issue: Real-time Data Not Updating
**Solution**:
- Check MQTT broker connection
- Verify device subscriptions are working
- Check browser console for WebSocket errors

## Monitoring and Debugging

### Backend Logs
Monitor your backend logs in Render dashboard for:
- WebSocket connection messages
- MQTT connection status
- Device subscription events

### Frontend Logs
Check browser console for:
- WebSocket connection status
- Real-time data updates
- Connection errors

## Security Considerations

1. **CORS Configuration**: Only allow your specific frontend domain
2. **Environment Variables**: Never commit sensitive data to version control
3. **MQTT Security**: Use secure MQTT connections (mqtts://) in production
4. **Rate Limiting**: Already configured in the backend

## Performance Optimization

1. **WebSocket Transports**: Both WebSocket and polling are enabled for maximum compatibility
2. **Connection Pooling**: MongoDB connection pooling is configured
3. **Self-ping**: Keeps the server alive on Render's free tier
4. **Error Handling**: Comprehensive error handling for all connections

## Deployment Checklist

- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] Both services deployed and running
- [ ] WebSocket connection tested
- [ ] Real-time data flowing
- [ ] CORS errors resolved
- [ ] MQTT connection working
- [ ] Device subscriptions working

## Support

If you continue to have WebSocket issues after following this guide:

1. Check Render service logs for errors
2. Verify all environment variables are set correctly
3. Test the WebSocket connection manually
4. Ensure both services are running and accessible 