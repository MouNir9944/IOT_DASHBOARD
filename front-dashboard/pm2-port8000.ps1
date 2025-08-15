# IoT Dashboard Frontend - PM2 Port 8000 Starter
Write-Host "Starting IoT Dashboard Frontend with PM2 on Port 8000..." -ForegroundColor Green
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

Write-Host "Building application..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "Starting PM2 on port 8000..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Set environment variable for port 8000
$env:PORT = "8000"
pm2 start ecosystem.config.js

Write-Host ""
Write-Host "PM2 started successfully!" -ForegroundColor Green
Write-Host "Use 'pm2 status' to check status" -ForegroundColor Yellow
Write-Host "Use 'pm2 logs iot-dashboard-frontend' to view logs" -ForegroundColor Yellow
Write-Host "Use 'pm2 stop iot-dashboard-frontend' to stop" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to continue"
