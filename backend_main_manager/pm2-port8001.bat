@echo off
echo Starting IoT Dashboard Backend with PM2 on Port 8001...
echo.

cd /d "%~dp0"

echo Starting PM2 on port 8001...
echo Backend will be available at: http://localhost:8001
echo.

set PORT=8001
pm2 start ecosystem.config.js

echo.
echo PM2 started successfully!
echo Use 'pm2 status' to check status
echo Use 'pm2 logs iot-dashboard-backend' to view logs
echo Use 'pm2 stop iot-dashboard-backend' to stop
echo.
pause
