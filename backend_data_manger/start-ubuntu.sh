#!/bin/bash

echo "========================================"
echo "  IoT Dashboard Data Manager Startup"
echo "  Ubuntu Server Configuration"
echo "========================================"
echo

# Set environment variables for Ubuntu server deployment
export PORT="5001"
export NODE_ENV="development"
export MONGODB_URI="mongodb://localhost:27017/iot_dashboard"
export MAIN_MANAGER_URL="http://162.19.25.155:5000"
export DEPLOYED_URL="http://162.19.25.155:5001"
export CORS_ORIGIN="http://162.19.25.155:3000"

echo "Environment variables set:"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo "  MONGODB_URI=$MONGODB_URI"
echo "  MAIN_MANAGER_URL=$MAIN_MANAGER_URL"
echo "  DEPLOYED_URL=$DEPLOYED_URL"
echo "  CORS_ORIGIN=$CORS_ORIGIN"
echo

echo "Starting Node.js data manager server..."
echo

echo "The data manager will be available at: http://162.19.25.155:5001"
echo "Main backend should be at: http://162.19.25.155:5000"
echo

echo "Press Ctrl+C to stop the server"
echo

# Start the data manager server
npm start
