# Frontend Port Configuration

This document explains how to run your IoT Dashboard frontend on different ports.

## Quick Start Options

### Option 1: Use the Interactive Scripts
- **Windows**: Double-click `run-frontend.bat` or run it in Command Prompt
- **PowerShell**: Right-click `run-frontend.ps1` and select "Run with PowerShell"

### Option 2: Use npm Scripts Directly
```bash
# Run on port 3000 (default Next.js)
npm run dev:3000

# Run on port 3001 (custom)
npm run dev:3001

# Run on port 3002 (custom)
npm run dev:3002

# Run on custom port (uses PORT environment variable)
npm run dev
```

### Option 3: Set Environment Variable
```bash
# Windows Command Prompt
set PORT=4000
npm run dev

# Windows PowerShell
$env:PORT = "4000"
npm run dev

# Linux/Mac
export PORT=4000
npm run dev
```

## Default Configuration

- **Default port**: 3001
- **API URL**: http://localhost:5000
- **Fallback port**: 3000 (if no port is specified)

## Available Ports

The following ports are pre-configured:
- **3000**: Default Next.js port
- **3001**: Custom port (default for this project)
- **3002**: Additional custom port

## Custom Ports

You can use any available port by:
1. Setting the `PORT` environment variable
2. Using the interactive scripts and selecting option 4
3. Modifying the `config.js` file

## Troubleshooting

### Port Already in Use
If you get a "port already in use" error:
1. Try a different port number
2. Check what's running on the port: `netstat -ano | findstr :PORT`
3. Kill the process using that port

### Permission Issues
- Make sure you have permission to bind to the selected port
- Some ports (below 1024) require administrator privileges on Windows

## Production

For production builds, use:
```bash
npm run build
npm run start -p YOUR_PORT
```

## PM2 Configuration

If using PM2, the port configuration is handled in `ecosystem.config.js`. You can modify the port there for production deployments.
