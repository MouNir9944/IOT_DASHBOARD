@echo off
echo IoT Dashboard Frontend - Port Selection
echo ======================================
echo.
echo Select a port to run your frontend:
echo 1. Port 3000 (default Next.js)
echo 2. Port 3001 (custom)
echo 3. Port 3002 (custom)
echo 4. Custom port
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo Starting frontend on port 3000...
    npm run dev:3000
) else if "%choice%"=="2" (
    echo Starting frontend on port 3001...
    npm run dev:3001
) else if "%choice%"=="3" (
    echo Starting frontend on port 3002...
    npm run dev:3002
) else if "%choice%"=="4" (
    set /p custom_port="Enter custom port number: "
    echo Starting frontend on port %custom_port%...
    set PORT=%custom_port%
    npm run dev
) else (
    echo Invalid choice. Starting on default port 3001...
    npm run dev
)
