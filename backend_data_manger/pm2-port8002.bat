@echo off
echo Starting IoT Dashboard MQTT Data Manager with PM2 on Port 8002...
echo.

cd /d "%~dp0"

echo Starting PM2 on port 8002...
echo MQTT Data Manager will be available at: http://localhost:8002
echo.

set PORT=8002
pm2 start ecosystem.config.js

echo.
echo PM2 started successfully!
echo Use 'pm2 status' to check status
echo Use 'pm2 logs iot-dashboard-mqtt' to view logs
echo Use 'pm2 stop iot-dashboard-mqtt' to stop
echo.
pause
