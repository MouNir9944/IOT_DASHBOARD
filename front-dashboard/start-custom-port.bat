@echo off
echo Setting custom port for IoT Dashboard Frontend...
echo.

set /p PORT_NUMBER="Enter the port number you want to use (e.g., 4000, 5000, 8080): "

if "%PORT_NUMBER%"=="" (
    echo No port specified, using default port 3001
    set PORT=3001
) else (
    echo Setting PORT environment variable to %PORT_NUMBER%
    set PORT=%PORT_NUMBER%
)

echo.
echo Starting frontend on port %PORT%...
echo Frontend will be available at: http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
