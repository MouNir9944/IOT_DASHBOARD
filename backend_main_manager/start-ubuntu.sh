#!/bin/bash

echo "========================================"
echo "  IoT Dashboard Backend Startup"
echo "  Ubuntu Server Configuration"
echo "========================================"
echo

# Set environment variables for Ubuntu server deployment
export CORS_ORIGIN="http://162.19.25.155:3000"
export PORT="5000"
export NODE_ENV="development"
export MONGODB_URI="mongodb://localhost:27017/iot_dashboard"

echo "Environment variables set:"
echo "  CORS_ORIGIN=$CORS_ORIGIN"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo "  MONGODB_URI=$MONGODB_URI"
echo

echo "Starting Node.js backend server..."
echo

echo "The backend will be available at: http://162.19.25.155:5000"
echo "Frontend can connect from: http://162.19.25.155:3000"
echo

echo "Press Ctrl+C to stop the server"
echo

# Start the backend server
npm start
