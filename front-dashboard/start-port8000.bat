@echo off
echo Starting IoT Dashboard Frontend on Port 8000...
echo.

cd /d "%~dp0"

echo Building application...
call npm run build

echo.
echo Starting frontend on port 8000...
echo Frontend will be available at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.

npm start
