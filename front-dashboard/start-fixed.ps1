# PowerShell script to start IoT Dashboard Frontend with Ubuntu Server Configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IoT Dashboard Frontend Startup" -ForegroundColor Cyan
Write-Host "  Ubuntu Server Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for Ubuntu server deployment
$env:NEXT_PUBLIC_BACKEND_URL = "http://162.19.25.155:5000"
$env:NEXT_PUBLIC_FRONTEND_URL = "http://162.19.25.155:3000"
$env:PORT = "3000"
$env:NODE_ENV = "development"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_BACKEND_URL = $env:NEXT_PUBLIC_BACKEND_URL" -ForegroundColor Green
Write-Host "  NEXT_PUBLIC_FRONTEND_URL = $env:NEXT_PUBLIC_FRONTEND_URL" -ForegroundColor Green
Write-Host "  PORT = $env:PORT" -ForegroundColor Green
Write-Host "  NODE_ENV = $env:NODE_ENV" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Next.js development server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "The frontend will be available at: http://162.19.25.155:3000" -ForegroundColor Yellow
Write-Host "Backend API will be at: http://162.19.25.155:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
Write-Host ""

# Start the development server
npm run dev
