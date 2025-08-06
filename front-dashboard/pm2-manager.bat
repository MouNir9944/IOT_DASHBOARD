@echo off
REM PM2 Manager Script for IoT Dashboard Frontend (Windows)
REM Usage: pm2-manager.bat [start|stop|restart|status|logs|monit|build|deploy]

set APP_NAME=iot-dashboard-frontend
set FRONTEND_DIR=./front-dashboard

if "%1"=="start" (
    echo 🚀 Starting IoT Dashboard Frontend with PM2...
    cd /d %FRONTEND_DIR%
    pm2 start ecosystem.config.js
    echo ✅ Frontend started successfully!
    goto :eof
)

if "%1"=="stop" (
    echo 🛑 Stopping IoT Dashboard Frontend...
    pm2 stop %APP_NAME%
    echo ✅ Frontend stopped successfully!
    goto :eof
)

if "%1"=="restart" (
    echo 🔄 Restarting IoT Dashboard Frontend...
    pm2 restart %APP_NAME%
    echo ✅ Frontend restarted successfully!
    goto :eof
)

if "%1"=="status" (
    echo 📊 PM2 Status:
    pm2 status
    goto :eof
)

if "%1"=="logs" (
    echo 📋 Showing logs for %APP_NAME%:
    pm2 logs %APP_NAME% --lines 50
    goto :eof
)

if "%1"=="monit" (
    echo 📈 Opening PM2 Monitor...
    pm2 monit
    goto :eof
)

if "%1"=="build" (
    echo 🔨 Building Next.js application...
    cd /d %FRONTEND_DIR%
    npm run build
    echo ✅ Build completed!
    goto :eof
)

if "%1"=="deploy" (
    echo 🚀 Deploying IoT Dashboard Frontend...
    cd /d %FRONTEND_DIR%
    echo 📦 Installing dependencies...
    npm install
    echo 🔨 Building application...
    npm run build
    echo 🚀 Starting with PM2...
    pm2 start ecosystem.config.js
    echo ✅ Deployment completed!
    goto :eof
)

if "%1"=="reload" (
    echo 🔄 Zero-downtime reload...
    pm2 reload %APP_NAME%
    echo ✅ Reload completed!
    goto :eof
)

if "%1"=="delete" (
    echo 🗑️ Deleting PM2 process...
    pm2 delete %APP_NAME%
    echo ✅ Process deleted!
    goto :eof
)

if "%1"=="save" (
    echo 💾 Saving PM2 configuration...
    pm2 save
    echo ✅ Configuration saved!
    goto :eof
)

if "%1"=="setup" (
    echo ⚙️ Setting up PM2 startup script...
    pm2 startup
    pm2 save
    echo ✅ PM2 startup configured!
    goto :eof
)

echo Usage: %0 {start^|stop^|restart^|status^|logs^|monit^|build^|deploy^|reload^|delete^|save^|setup}
echo.
echo Commands:
echo   start   - Start the frontend application
echo   stop    - Stop the frontend application
echo   restart - Restart the frontend application
echo   status  - Show PM2 status
echo   logs    - Show application logs
echo   monit   - Open PM2 monitor
echo   build   - Build the Next.js application
echo   deploy  - Full deployment (install, build, start)
echo   reload  - Zero-downtime reload
echo   delete  - Delete PM2 process
echo   save    - Save PM2 configuration
echo   setup   - Setup PM2 startup script 