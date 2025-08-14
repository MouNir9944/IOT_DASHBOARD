# IoT Dashboard Frontend - Port Selection
Write-Host "IoT Dashboard Frontend - Port Selection" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

Write-Host "Select a port to run your frontend:" -ForegroundColor Yellow
Write-Host "1. Port 3000 (default Next.js)" -ForegroundColor White
Write-Host "2. Port 3001 (custom)" -ForegroundColor White
Write-Host "3. Port 3002 (custom)" -ForegroundColor White
Write-Host "4. Custom port" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "Starting frontend on port 3000..." -ForegroundColor Green
        npm run dev:3000
    }
    "2" {
        Write-Host "Starting frontend on port 3001..." -ForegroundColor Green
        npm run dev:3001
    }
    "3" {
        Write-Host "Starting frontend on port 3002..." -ForegroundColor Green
        npm run dev:3002
    }
    "4" {
        $customPort = Read-Host "Enter custom port number"
        Write-Host "Starting frontend on port $customPort..." -ForegroundColor Green
        $env:PORT = $customPort
        npm run dev
    }
    default {
        Write-Host "Invalid choice. Starting on default port 3001..." -ForegroundColor Yellow
        npm run dev
    }
}
