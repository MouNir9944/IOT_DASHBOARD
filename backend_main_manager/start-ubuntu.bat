@echo off
echo ========================================
echo   IoT Dashboard Backend Startup
echo   Ubuntu Server Configuration
echo ========================================
echo.

REM Set environment variables for Ubuntu server deployment
set CORS_ORIGIN=http://162.19.25.155:3000
set PORT=5000
set NODE_ENV=development
set MONGODB_URI=mongodb://localhost:27017/iot_dashboard

echo Environment variables set:
echo   CORS_ORIGIN=%CORS_ORIGIN%
echo   PORT=%PORT%
echo   NODE_ENV=%NODE_ENV%
echo   MONGODB_URI=%MONGODB_URI%
echo.

echo Starting Node.js backend server...
echo.

echo The backend will be available at: http://162.19.25.155:5000
echo Frontend can connect from: http://162.19.25.155:3000
echo.

echo Press Ctrl+C to stop the server
echo.

REM Start the backend server
npm start
