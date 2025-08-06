# Server Troubleshooting Guide

## Common Issues and Solutions

### 1. Server Crashes After Running for a While

**Symptoms:**
- Server stops responding after several hours/days
- Memory usage increases over time
- MQTT connection drops
- Socket.IO connections accumulate

**Causes:**
- Memory leaks from unclosed connections
- MQTT client reconnection loops
- Socket.IO event listener accumulation
- Unhandled promise rejections

**Solutions:**
- Use `npm run start:prod` for production (includes memory limits and garbage collection)
- Monitor server health with `npm run monitor`
- Check logs for memory usage patterns
- Restart server if memory usage exceeds 500MB

### 2. MQTT Connection Issues

**Symptoms:**
- "MQTT Connected: false" in health checks
- No real-time data updates
- MQTT reconnection loops

**Solutions:**
- Check MQTT broker URL in environment variables
- Verify MQTT broker is running and accessible
- Check network connectivity to MQTT broker
- Restart server to reset MQTT connection

### 3. Memory Leaks

**Symptoms:**
- Memory usage continuously increases
- Server becomes slow over time
- Out of memory errors

**Solutions:**
- Use production start script: `npm run start:prod`
- Monitor memory usage in logs
- Check for stale socket connections
- Restart server periodically if needed

### 4. Socket.IO Connection Issues

**Symptoms:**
- Frontend can't connect to WebSocket
- Real-time updates not working
- Connection errors in browser console

**Solutions:**
- Check CORS configuration
- Verify Socket.IO server is running
- Check for firewall/network issues
- Restart server to clear connection state

### 5. Rate Limiting Issues (429 Errors)

**Symptoms:**
- "429 Too Many Requests" errors in logs
- Self-ping failures
- Health check failures

**Causes:**
- Too many requests to the server
- Render's rate limiting
- Excessive health checks

**Solutions:**
- The server now automatically handles rate limiting
- Self-ping will pause when rate limited
- Use `npm run start:prod` for production
- Monitor logs for rate limiting messages

## Monitoring Commands

### Check Server Health
```bash
npm run monitor
```

### Check Deployment Health
```bash
npm run deploy-check
```

### Check Memory Usage
```bash
curl http://localhost:5000/health | jq '.memory'
```

### Check MQTT Status
```bash
curl http://localhost:5000/health | jq '.mqttConnected'
```

### Check Connected Clients
```bash
curl http://localhost:5000/health | jq '.connectedClients'
```

## Environment Variables

Make sure these are set correctly:

```env
MONGO_URI=mongodb://localhost:27017/iot_dashboard
MQTT_BROKER_URL=mqtt://localhost:1883
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=production
```

## Production Deployment

For production deployment, use:

```bash
npm run start:prod
```

This command includes:
- Memory limit of 512MB
- Garbage collection enabled
- Better error handling
- Automatic memory cleanup

## Log Analysis

### Memory Leak Indicators
- Memory usage increasing over time
- High number of connected clients
- MQTT reconnection attempts
- Socket.IO connection accumulation

### Healthy Server Indicators
- Stable memory usage
- MQTT connected: true
- Reasonable number of connected clients
- Regular garbage collection logs

## Emergency Recovery

If server becomes unresponsive:

1. **Immediate Action:**
   ```bash
   # Kill the process
   pkill -f "node server.js"
   
   # Restart with production settings
   npm run start:prod
   ```

2. **Check Logs:**
   ```bash
   # Look for error patterns
   tail -f logs/error.log
   ```

3. **Monitor Health:**
   ```bash
   # Check if server is responding
   curl http://localhost:5000/health
   ```

## Prevention Tips

1. **Regular Monitoring:**
   - Set up health check monitoring
   - Monitor memory usage
   - Check MQTT connection status

2. **Scheduled Restarts:**
   - Restart server weekly in production
   - Use process managers like PM2
   - Set up automatic restart on failure

3. **Resource Limits:**
   - Use memory limits in production
   - Monitor CPU usage
   - Set connection limits

4. **Error Handling:**
   - Check logs regularly
   - Set up error alerting
   - Monitor uncaught exceptions 