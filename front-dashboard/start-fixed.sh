#!/bin/bash

echo "========================================"
echo "  IoT Dashboard Frontend Startup"
echo "  Ubuntu Server Configuration"
echo "========================================"
echo

# Set environment variables for Ubuntu server deployment
export NEXT_PUBLIC_BACKEND_URL="http://162.19.25.155:5000"
export NEXT_PUBLIC_FRONTEND_URL="http://162.19.25.155:3000"
export PORT="3000"
export NODE_ENV="development"

echo "Environment variables set:"
echo "  NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL"
echo "  NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL"
echo "  PORT=$PORT"
echo "  NODE_ENV=$NODE_ENV"
echo

echo "Starting Next.js development server..."
echo
echo "The frontend will be available at: http://162.19.25.155:3000"
echo "Backend API will be at: http://162.19.25.155:5000"
echo
echo "Press Ctrl+C to stop the server"
echo

# Start the development server
npm run dev
