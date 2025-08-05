# Render Deployment Guide

## Prerequisites

1. Make sure your code is pushed to GitHub
2. Have a Render account

## Deployment Steps

### 1. Connect to Render

1. Go to [render.com](https://render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository

### 2. Configure the Service

- **Name**: `mqtt-data-manager` (or your preferred name)
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Root Directory**: `backend_data_manger` (important!)

### 3. Environment Variables

Add these environment variables in the Render dashboard:

```
MONGO_URI=mongodb://localhost:27017
MQTT_BROKER_URL=mqtt://broker.hivemq.com
PORT=5001
DEPLOYED_URL=https://your-app-name.onrender.com
```

Replace `your-app-name` with your actual Render app name.

### 4. Deploy

Click "Create Web Service" and wait for the deployment to complete.

## Troubleshooting

### Common Issues

1. **Module not found errors**: Make sure all dependencies are in package.json
2. **Environment variables**: Ensure all required env vars are set in Render dashboard
3. **Port issues**: Render will automatically assign a port, so PORT env var is optional
4. **MongoDB connection**: Use MongoDB Atlas or ensure your MongoDB is accessible

### Logs

Check the logs in Render dashboard to see what's happening during deployment.

## Health Check

Once deployed, you can test the health endpoint:
`https://your-app-name.onrender.com/ping` 