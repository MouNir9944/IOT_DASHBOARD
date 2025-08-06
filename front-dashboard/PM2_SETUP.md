# PM2 Setup Guide for IoT Dashboard Frontend

## Overview
This guide explains how to use PM2 to keep your Next.js frontend application running continuously with **Server-Side Rendering (SSR)** support.

## Prerequisites

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Build the application:**
   ```bash
   cd front-dashboard
   npm install
   npm run build
   ```

## Quick Start

### Using NPM Scripts (Recommended)
```bash
# Start the application
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Monitor in real-time
npm run pm2:monit

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop
```

### Using Management Scripts

**Linux/Mac:**
```bash
# Make script executable
chmod +x pm2-manager.sh

# Start application
./pm2-manager.sh start

# Full deployment
./pm2-manager.sh deploy

# View status
./pm2-manager.sh status
```

**Windows:**
```cmd
# Start application
pm2-manager.bat start

# Full deployment
pm2-manager.bat deploy

# View status
pm2-manager.bat status
```

## Configuration

### Environment Variables
Set these environment variables before starting PM2:

```bash
# For development
export NEXT_PUBLIC_BACKEND_URL=http://localhost:5000

# For production
export NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com
```

### PM2 Ecosystem Configuration
The `ecosystem.config.js` file contains:

- **Application Name**: `iot-dashboard-frontend`
- **Instances**: 1 (single instance for SSR to prevent session conflicts)
- **Auto-restart**: Enabled
- **Memory limit**: 1GB
- **Log files**: Stored in `./logs/`
- **Environment**: Production mode
- **SSR Optimizations**: Enabled
- **Health Check**: Available at `/api/health`

## Common Commands

### Basic PM2 Commands
```bash
# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop iot-dashboard-frontend

# Restart application
pm2 restart iot-dashboard-frontend

# Delete application
pm2 delete iot-dashboard-frontend

# Reload (zero-downtime)
pm2 reload iot-dashboard-frontend
```

### Monitoring Commands
```bash
# View all processes
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs iot-dashboard-frontend

# View logs with line limit
pm2 logs iot-dashboard-frontend --lines 100
```

### Startup Configuration
```bash
# Save current PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# After system restart, restore processes
pm2 resurrect
```

## Log Management

### Log Files Location
- **Error logs**: `./logs/err.log`
- **Output logs**: `./logs/out.log`
- **Combined logs**: `./logs/combined.log`

### Log Rotation
PM2 automatically rotates logs. You can configure log rotation in `ecosystem.config.js`:

```javascript
log_file: './logs/combined.log',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
```

## SSR Performance Monitoring

### Memory Usage
- **Max memory restart**: 1GB
- **Node.js heap size**: 1024MB
- **SSR optimization**: `--optimize-for-size` flag enabled
- **Monitor with**: `pm2 monit`

### SSR-Specific Optimizations
- **Single instance**: Prevents session conflicts in SSR
- **Kill timeout**: 5 seconds for graceful SSR shutdown
- **Listen timeout**: 10 seconds for SSR startup
- **Health check grace period**: 5 seconds for SSR initialization

### CPU Usage
- **Single instance**: Prevents CPU overload
- **Auto-restart**: On memory/CPU issues
- **Health checks**: Enabled

## Troubleshooting

### Common Issues

1. **Application won't start:**
   ```bash
   # Check logs
   pm2 logs iot-dashboard-frontend
   
   # Check if port is in use
   netstat -tulpn | grep :3000
   ```

2. **Memory issues:**
   ```bash
   # Increase memory limit in ecosystem.config.js
   max_memory_restart: '2G'
   ```

3. **Build errors:**
   ```bash
   # Clean and rebuild
   rm -rf .next
   npm run build
   ```

4. **Environment variables not loading:**
   ```bash
   # Restart PM2 with new environment
   pm2 restart iot-dashboard-frontend --update-env
   ```

### Debug Mode
```bash
# Start with debug logging
pm2 start ecosystem.config.js --env development

# View detailed logs
pm2 logs iot-dashboard-frontend --raw
```

## Production Deployment

### Step-by-Step Deployment
```bash
# 1. Install dependencies
npm install

# 2. Build application
npm run build

# 3. Start with PM2
pm2 start ecosystem.config.js

# 4. Save configuration
pm2 save

# 5. Setup startup script
pm2 startup
```

### Environment-Specific Configurations

**Development:**
```javascript
env: {
  NODE_ENV: 'development',
  PORT: 3000,
  NEXT_PUBLIC_BACKEND_URL: 'http://localhost:5000'
}
```

**Production:**
```javascript
env_production: {
  NODE_ENV: 'production',
  PORT: 3000,
  NEXT_PUBLIC_BACKEND_URL: 'https://your-backend-app-name.onrender.com'
}
```

## Security Considerations

1. **Environment Variables**: Never commit sensitive data
2. **Log Files**: Secure log directory permissions
3. **Port Binding**: Use specific port, not 0.0.0.0
4. **Process User**: Run as non-root user in production

## Monitoring and Alerts

### Health Checks
- **Grace period**: 3 seconds
- **Fatal exceptions**: Enabled
- **Auto-restart**: On crashes

### Performance Metrics
- **Memory usage**: Monitored
- **CPU usage**: Monitored
- **Uptime**: Tracked
- **Restart count**: Limited to 10

## Backup and Recovery

### Configuration Backup
```bash
# Save PM2 configuration
pm2 save

# Backup ecosystem file
cp ecosystem.config.js ecosystem.config.js.backup
```

### Process Recovery
```bash
# After system restart
pm2 resurrect

# Or manually start
pm2 start ecosystem.config.js
```

## Advanced Configuration

### Cluster Mode (Optional)
For high-traffic applications, you can enable cluster mode:

```javascript
instances: 'max', // Use all CPU cores
exec_mode: 'cluster'
```

### Custom Logging
```javascript
log_file: './logs/combined.log',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
log_type: 'json'
```

### SSR Health Check Endpoint
A health check endpoint is available at `/api/health` for monitoring SSR status:

```javascript
// src/app/api/health/route.ts
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ssr: true,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}
```

**Test the health check:**
```bash
curl http://localhost:3000/api/health
```

## Support

For issues with PM2:
1. Check PM2 logs: `pm2 logs`
2. Check application logs: `pm2 logs iot-dashboard-frontend`
3. Monitor resources: `pm2 monit`
4. Restart if needed: `pm2 restart iot-dashboard-frontend` 