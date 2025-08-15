@echo off
echo Rebuilding Frontend for Port 8001 Backend...
echo.

cd /d "%~dp0"

echo Cleaning previous build...
if exist .next rmdir /s /q .next

echo.
echo Installing dependencies...
call npm install

echo.
echo Building frontend...
call npm run build

echo.
echo Frontend rebuilt successfully!
echo.
echo Now you can test authentication:
echo 1. Start your backend on port 8001
echo 2. Start your frontend on port 8000
echo 3. Try to login - it should now connect to port 8001
echo.
echo Press any key to continue...
pause >nul
