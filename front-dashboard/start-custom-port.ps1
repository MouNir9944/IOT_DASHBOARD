# IoT Dashboard Frontend - Custom Port Starter
Write-Host "Setting custom port for IoT Dashboard Frontend..." -ForegroundColor Green
Write-Host ""

$portNumber = Read-Host "Enter the port number you want to use (e.g., 4000, 5000, 8080)"

if ([string]::IsNullOrEmpty($portNumber)) {
    Write-Host "No port specified, using default port 3001" -ForegroundColor Yellow
    $env:PORT = "3001"
} else {
    Write-Host "Setting PORT environment variable to $portNumber" -ForegroundColor Green
    $env:PORT = $portNumber
}

Write-Host ""
Write-Host "Starting frontend on port $env:PORT..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:$env:PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
