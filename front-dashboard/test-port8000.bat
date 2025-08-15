@echo off
echo Testing IoT Dashboard Frontend Port Configuration...
echo.

echo Checking if port 8000 is in use...
netstat -ano | findstr :8000

echo.
echo Checking PM2 status...
pm2 status

echo.
echo Checking PM2 logs for port information...
pm2 logs iot-dashboard-frontend --lines 10

echo.
echo Test completed!
pause
