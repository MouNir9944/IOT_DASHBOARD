@echo off
echo IoT Dashboard Frontend - Port Configuration
echo ==========================================
echo.

set /p PORT_NUMBER="Enter the port number (e.g., 4000, 5000, 8080): "

if "%PORT_NUMBER%"=="" (
    echo No port specified, using default port 3000
    set PORT=3000
) else (
    echo Setting PORT to %PORT_NUMBER%
    set PORT=%PORT_NUMBER%
)

echo.
echo Starting frontend on port %PORT%...
echo Frontend will be available at: http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the server
echo.

next dev --turbopack -p %PORT%
