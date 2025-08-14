# PowerShell script to start Frontend Dashboard for Ubuntu Server Deployment

Write-Host "Starting Frontend Dashboard for Ubuntu Server Deployment..." -ForegroundColor Green
Write-Host ""

# Set environment variables for Ubuntu server
$env:NEXT_PUBLIC_BACKEND_URL = "http://162.19.25.155:5000"
$env:PORT = "3000"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "NEXT_PUBLIC_BACKEND_URL = $env:NEXT_PUBLIC_BACKEND_URL" -ForegroundColor Cyan
Write-Host "PORT = $env:PORT" -ForegroundColor Cyan
Write-Host ""

# Start the development server
Write-Host "Starting Next.js development server..." -ForegroundColor Green
npm run dev
