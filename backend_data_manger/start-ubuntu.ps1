# PowerShell script to start IoT Dashboard Data Manager with Ubuntu Server Configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IoT Dashboard Data Manager Startup" -ForegroundColor Cyan
Write-Host "  Ubuntu Server Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for Ubuntu server deployment
$env:PORT = "5001"
$env:NODE_ENV = "development"
$env:MONGODB_URI = "mongodb://localhost:27017/iot_dashboard"
$env:MAIN_MANAGER_URL = "http://162.19.25.155:5000"
$env:DEPLOYED_URL = "http://162.19.25.155:5001"
$env:CORS_ORIGIN = "http://162.19.25.155:3000"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  PORT = $env:PORT" -ForegroundColor Green
Write-Host "  NODE_ENV = $env:NODE_ENV" -ForegroundColor Green
Write-Host "  MONGODB_URI = $env:MONGODB_URI" -ForegroundColor Green
Write-Host "  MAIN_MANAGER_URL = $env:MAIN_MANAGER_URL" -ForegroundColor Green
Write-Host "  DEPLOYED_URL = $env:DEPLOYED_URL" -ForegroundColor Green
Write-Host "  CORS_ORIGIN = $env:CORS_ORIGIN" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Node.js data manager server..." -ForegroundColor Cyan
Write-Host ""

Write-Host "The data manager will be available at: http://162.19.25.155:5001" -ForegroundColor Yellow
Write-Host "Main backend should be at: http://162.19.25.155:5000" -ForegroundColor Yellow
Write-Host ""

Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
Write-Host ""

# Start the data manager server
npm start
