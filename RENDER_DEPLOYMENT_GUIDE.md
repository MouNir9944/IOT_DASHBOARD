# Render Deployment Guide for IoT Dashboard

## Overview
This guide will help you deploy your IoT Dashboard to Render with PM2 support for both backend and frontend.

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Environment Variables**: Prepare your environment variables

## Backend Deployment (backend_main_manager)

### 1. Create Backend Service on Render

1. **Go to Render Dashboard**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

```
Name: iot-dashboard-backend
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 2. Environment Variables for Backend

Set these environment variables in your Render backend service:

```
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_atlas_connection_string
MQTT_BROKER_URL=your_mqtt_broker_url
CORS_ORIGIN=https://your-frontend-app-name.onrender.com
DEPLOYED_URL=https://your-backend-app-name.onrender.com
JWT_SECRET=your_jwt_secret_key
```

### 3. Backend Configuration

Your backend is already configured for Render deployment. The server will:
- Use the PORT provided by Render
- Configure CORS for your frontend domain
- Handle WebSocket connections
- Auto-restart on crashes

## Frontend Deployment (front-dashboard)

### 1. Create Frontend Service on Render

1. **Go to Render Dashboard**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

```
Name: iot-dashboard-frontend
Environment: Node
Root Directory: front-dashboard
Build Command: npm install && npm run build
Start Command: npm start
```

### 2. Environment Variables for Frontend

Set these environment variables in your Render frontend service:

```
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com
```

### 3. Frontend PM2 Configuration for Render

Create a Render-specific PM2 configuration:

```javascript
// front-dashboard/ecosystem.render.js
module.exports = {
  apps: [
    {
      name: 'iot-dashboard-frontend',
      script: 'npm',
      args: 'start',
      cwd: './front-dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower for Render free tier
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: '--max-old-space-size=512'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_restarts: 5,
      min_uptime: '10s',
      health_check_grace_period: 3000,
      kill_timeout: 3000,
      listen_timeout: 5000
    }
  ]
};
```

## Step-by-Step Deployment Process

### Step 1: Prepare Your Repository

1. **Ensure all files are committed to GitHub**
2. **Check that your package.json files are correct**
3. **Verify environment variables are ready**

### Step 2: Deploy Backend

1. **Create Web Service on Render**
2. **Set environment variables**
3. **Deploy and wait for build to complete**
4. **Note the backend URL**

### Step 3: Deploy Frontend

1. **Create Web Service on Render**
2. **Set environment variables (including backend URL)**
3. **Deploy and wait for build to complete**
4. **Test the connection**

### Step 4: Configure CORS

Update your backend CORS settings to allow your frontend domain:

```javascript
// In backend_main_manager/server.js
const corsOptions = {
  origin: [
    'https://your-frontend-app-name.onrender.com',
    'http://localhost:3000' // For local development
  ],
  credentials: true
};
```

## Environment Variables Reference

### Backend Environment Variables

```bash
# Required
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/iot_dashboard
MQTT_BROKER_URL=mqtt://your-mqtt-broker.com:1883
CORS_ORIGIN=https://your-frontend-app-name.onrender.com
DEPLOYED_URL=https://your-backend-app-name.onrender.com
JWT_SECRET=your-super-secret-jwt-key

# Optional
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
```

### Frontend Environment Variables

```bash
# Required
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com

# Optional
NEXT_TELEMETRY_DISABLED=1
```

## Render-Specific Optimizations

### 1. Memory Optimization

For Render's free tier limitations:

```javascript
// Backend optimization
max_memory_restart: '512M'

// Frontend optimization  
max_memory_restart: '512M'
NODE_OPTIONS: '--max-old-space-size=512'
```

### 2. Health Checks

Add health check endpoints:

```javascript
// Backend health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend health check (already created)
// Available at /api/health
```

### 3. Auto-Restart Configuration

```javascript
// For both services
autorestart: true,
max_restarts: 5,
min_uptime: '10s'
```

## Troubleshooting Render Deployment

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs in Render dashboard
   # Ensure all dependencies are in package.json
   # Verify Node.js version compatibility
   ```

2. **Environment Variables**
   ```bash
   # Double-check all environment variables are set
   # Ensure no typos in variable names
   # Verify URLs are correct
   ```

3. **CORS Errors**
   ```bash
   # Check CORS_ORIGIN matches your frontend URL exactly
   # Include protocol (https://)
   # Add localhost for development
   ```

4. **WebSocket Connection Issues**
   ```bash
   # Verify WebSocket URL in frontend
   # Check CORS settings for WebSocket
   # Ensure backend is accessible
   ```

### Debug Commands

```bash
# Check backend logs
# Go to Render dashboard → Your backend service → Logs

# Check frontend logs  
# Go to Render dashboard → Your frontend service → Logs

# Test backend health
curl https://your-backend-app-name.onrender.com/health

# Test frontend health
curl https://your-frontend-app-name.onrender.com/api/health
```

## Monitoring and Maintenance

### 1. Render Dashboard Monitoring

- **Uptime**: Monitor service status
- **Logs**: View real-time logs
- **Metrics**: CPU and memory usage
- **Deployments**: Track deployment history

### 2. Custom Domain (Optional)

1. **Add custom domain in Render dashboard**
2. **Configure DNS records**
3. **Update CORS settings**
4. **Update environment variables**

### 3. SSL/HTTPS

- **Automatic**: Render provides SSL certificates
- **Custom**: Upload your own certificates
- **Redirect**: HTTP to HTTPS redirect

## Cost Optimization

### Free Tier Limitations

- **Backend**: 750 hours/month
- **Frontend**: 750 hours/month
- **Memory**: 512MB per service
- **Bandwidth**: 100GB/month

### Paid Tier Benefits

- **Unlimited**: No time restrictions
- **More Memory**: Up to 8GB
- **Custom Domains**: Multiple domains
- **Priority Support**: Faster response times

## Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **CORS**: Restrict to specific domains
3. **JWT Secrets**: Use strong, unique secrets
4. **Database**: Use MongoDB Atlas with IP restrictions
5. **MQTT**: Use secure MQTT connections

## Deployment Checklist

### Backend Checklist
- [ ] MongoDB Atlas connection string
- [ ] MQTT broker URL configured
- [ ] JWT secret set
- [ ] CORS origin configured
- [ ] Environment variables set
- [ ] Service deployed and running
- [ ] Health check endpoint working

### Frontend Checklist
- [ ] Backend URL configured
- [ ] Environment variables set
- [ ] Build completed successfully
- [ ] Service deployed and running
- [ ] Health check endpoint working
- [ ] WebSocket connection established

## Support

For Render-specific issues:
1. **Check Render documentation**: [docs.render.com](https://docs.render.com)
2. **View service logs**: Render dashboard → Logs
3. **Contact Render support**: Available in dashboard
4. **Community forum**: [community.render.com](https://community.render.com)

## Next Steps

After successful deployment:
1. **Test all functionality**
2. **Monitor performance**
3. **Set up alerts**
4. **Configure custom domain (optional)**
5. **Set up monitoring tools** 