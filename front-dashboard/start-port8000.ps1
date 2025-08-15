# IoT Dashboard Frontend - Always Port 8000 Starter
Write-Host "Starting IoT Dashboard Frontend on Port 8000..." -ForegroundColor Green
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

Write-Host "Building application..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "Starting frontend on port 8000..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm start
