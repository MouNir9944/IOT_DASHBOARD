@echo off
echo Starting IoT Dashboard Backend on Port 8001...
echo.

cd /d "%~dp0"

echo Setting PORT environment variable to 8001...
set PORT=8001

echo.
echo Starting backend on port 8001...
echo Backend will be available at: http://localhost:8001
echo.
echo Press Ctrl+C to stop the server
echo.

npm start
