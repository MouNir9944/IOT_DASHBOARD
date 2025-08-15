@echo off
echo Starting IoT Dashboard Frontend with PM2 on Port 8000...
echo.

cd /d "%~dp0"

echo Building application...
call npm run build

echo.
echo Starting PM2 on port 8000...
echo Frontend will be available at: http://localhost:8000
echo.

set PORT=8000
pm2 start ecosystem.config.js

echo.
echo PM2 started successfully!
echo Use 'pm2 status' to check status
echo Use 'pm2 logs iot-dashboard-frontend' to view logs
echo Use 'pm2 stop iot-dashboard-frontend' to stop
echo.
pause
