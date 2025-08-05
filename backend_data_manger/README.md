# MQTT Data Manager

This is the MQTT data manager service that handles real-time data collection from IoT devices.

## Environment Variables

For deployment on Render, you need to set the following environment variables:

- `MONGO_URI`: MongoDB connection string (e.g., `mongodb://localhost:27017` or your MongoDB Atlas URI)
- `MQTT_BROKER_URL`: MQTT broker URL (e.g., `mqtt://broker.hivemq.com`)
- `PORT`: Server port (default: 5001)
- `DEPLOYED_URL`: Your deployed app URL for self-ping mechanism (e.g., `https://your-app-name.onrender.com`)

## Installation

```bash
npm install
```

## Running Locally

```bash
npm start
```

## Deployment on Render

1. Connect your GitHub repository to Render
2. Set the build command: `npm install`
3. Set the start command: `npm start`
4. Add the required environment variables in the Render dashboard
5. Deploy!

## API Endpoints

- `GET /ping` - Health check
- `GET /api/mqtt/status` - MQTT client status
- `POST /api/mqtt/reinitialize` - Reinitialize MQTT subscriptions
- `POST /api/site/:siteId/:type/index` - Get site-specific data index
- `POST /api/global/:type/index` - Get global data index 