#!/bin/bash

echo "Starting Frontend Dashboard for Ubuntu Server Deployment..."
echo

# Set environment variables for Ubuntu server
export NEXT_PUBLIC_BACKEND_URL="http://162.19.25.155:5000"
export PORT="3000"

echo "Environment variables set:"
echo "NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL"
echo "PORT=$PORT"
echo

# Start the development server
echo "Starting Next.js development server..."
npm run dev
