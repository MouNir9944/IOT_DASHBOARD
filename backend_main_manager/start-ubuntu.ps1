# PowerShell script to start IoT Dashboard Backend with Ubuntu Server Configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IoT Dashboard Backend Startup" -ForegroundColor Cyan
Write-Host "  Ubuntu Server Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for Ubuntu server deployment
$env:CORS_ORIGIN = "http://162.19.25.155:3000"
$env:PORT = "5000"
$env:NODE_ENV = "development"
$env:MONGODB_URI = "mongodb://localhost:27017/iot_dashboard"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  CORS_ORIGIN = $env:CORS_ORIGIN" -ForegroundColor Green
Write-Host "  PORT = $env:PORT" -ForegroundColor Green
Write-Host "  NODE_ENV = $env:NODE_ENV" -ForegroundColor Green
Write-Host "  MONGODB_URI = $env:MONGODB_URI" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Node.js backend server..." -ForegroundColor Cyan
Write-Host ""

Write-Host "The backend will be available at: http://162.19.25.155:5000" -ForegroundColor Yellow
Write-Host "Frontend can connect from: http://162.19.25.155:3000" -ForegroundColor Yellow
Write-Host ""

Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
Write-Host ""

# Start the backend server
npm start
