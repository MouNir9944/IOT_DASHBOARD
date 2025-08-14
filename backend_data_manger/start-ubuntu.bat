@echo off
echo ========================================
echo   IoT Dashboard Data Manager Startup
echo   Ubuntu Server Configuration
echo ========================================
echo.

REM Set environment variables for Ubuntu server deployment
set PORT=5001
set NODE_ENV=development
set MONGODB_URI=mongodb://localhost:27017/iot_dashboard
set MAIN_MANAGER_URL=http://162.19.25.155:5000
set DEPLOYED_URL=http://162.19.25.155:5001
set CORS_ORIGIN=http://162.19.25.155:3000

echo Environment variables set:
echo   PORT=%PORT%
echo   NODE_ENV=%NODE_ENV%
echo   MONGODB_URI=%MONGODB_URI%
echo   MAIN_MANAGER_URL=%MAIN_MANAGER_URL%
echo   DEPLOYED_URL=%DEPLOYED_URL%
echo   CORS_ORIGIN=%CORS_ORIGIN%
echo.

echo Starting Node.js data manager server...
echo.

echo The data manager will be available at: http://162.19.25.155:5002
echo Main backend should be at: http://162.19.25.155:5000
echo.

echo Press Ctrl+C to stop the server
echo.

REM Start the data manager server
npm start
