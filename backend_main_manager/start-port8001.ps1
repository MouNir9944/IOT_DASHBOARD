# IoT Dashboard Backend - Port 8001 Starter
Write-Host "Starting IoT Dashboard Backend on Port 8001..." -ForegroundColor Green
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

Write-Host "Setting PORT environment variable to 8001..." -ForegroundColor Yellow
$env:PORT = "8001"

Write-Host ""
Write-Host "Starting backend on port 8001..." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:8001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm start
