#!/bin/bash

# Render Deployment Script for IoT Dashboard
# This script helps prepare your application for Render deployment

echo "🚀 Preparing IoT Dashboard for Render Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if git is initialized
if [ ! -d ".git" ]; then
    print_error "Git repository not found. Please initialize git first."
    exit 1
fi

# Check if all changes are committed
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes. Please commit them before deploying."
    echo "Run: git add . && git commit -m 'Prepare for Render deployment'"
    exit 1
fi

print_status "Checking backend configuration..."

# Check backend package.json
if [ ! -f "backend_main_manager/package.json" ]; then
    print_error "Backend package.json not found"
    exit 1
fi

# Check frontend package.json
if [ ! -f "front-dashboard/package.json" ]; then
    print_error "Frontend package.json not found"
    exit 1
fi

print_status "Checking environment variables..."

# Create environment template files
echo "Creating environment variable templates..."

# Backend environment template
cat > backend_main_manager/.env.example << EOF
# Backend Environment Variables for Render
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/iot_dashboard
MQTT_BROKER_URL=mqtt://your-mqtt-broker.com:1883
CORS_ORIGIN=https://your-frontend-app-name.onrender.com
DEPLOYED_URL=https://your-backend-app-name.onrender.com
JWT_SECRET=your-super-secret-jwt-key
EOF

# Frontend environment template
cat > front-dashboard/.env.example << EOF
# Frontend Environment Variables for Render
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com
NEXT_TELEMETRY_DISABLED=1
EOF

print_status "Environment templates created"

# Check for required files
echo "Checking required files..."

required_files=(
    "backend_main_manager/server.js"
    "backend_main_manager/package.json"
    "front-dashboard/package.json"
    "front-dashboard/next.config.ts"
    "front-dashboard/ecosystem.render.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "Found $file"
    else
        print_error "Missing required file: $file"
        exit 1
    fi
done

print_status "All required files found"

# Create deployment checklist
cat > RENDER_CHECKLIST.md << EOF
# Render Deployment Checklist

## Pre-Deployment Checklist

### Backend (backend_main_manager)
- [ ] MongoDB Atlas database created
- [ ] MQTT broker configured
- [ ] Environment variables prepared
- [ ] CORS settings updated
- [ ] JWT secret generated

### Frontend (front-dashboard)
- [ ] Backend URL determined
- [ ] Environment variables prepared
- [ ] Build tested locally
- [ ] PM2 configuration ready

## Deployment Steps

### Step 1: Deploy Backend
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repository
4. Configure:
   - Name: iot-dashboard-backend
   - Environment: Node
   - Build Command: npm install
   - Start Command: npm start
5. Set environment variables
6. Deploy

### Step 2: Deploy Frontend
1. Create another Web Service
2. Configure:
   - Name: iot-dashboard-frontend
   - Environment: Node
   - Root Directory: front-dashboard
   - Build Command: npm install && npm run build
   - Start Command: npm start
3. Set environment variables (including backend URL)
4. Deploy

### Step 3: Test Deployment
- [ ] Backend health check: https://your-backend.onrender.com/health
- [ ] Frontend health check: https://your-frontend.onrender.com/api/health
- [ ] WebSocket connection working
- [ ] Real-time data flowing
- [ ] Authentication working

## Environment Variables

### Backend Variables
\`\`\`bash
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_connection_string
MQTT_BROKER_URL=your_mqtt_broker_url
CORS_ORIGIN=https://your-frontend-app-name.onrender.com
DEPLOYED_URL=https://your-backend-app-name.onrender.com
JWT_SECRET=your_jwt_secret
\`\`\`

### Frontend Variables
\`\`\`bash
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BACKEND_URL=https://your-backend-app-name.onrender.com
\`\`\`

## Troubleshooting

### Common Issues
1. **Build Failures**: Check package.json dependencies
2. **CORS Errors**: Verify CORS_ORIGIN matches frontend URL
3. **WebSocket Issues**: Check backend URL in frontend
4. **Memory Issues**: Monitor memory usage in Render dashboard

### Debug Commands
\`\`\`bash
# Test backend
curl https://your-backend.onrender.com/health

# Test frontend
curl https://your-frontend.onrender.com/api/health

# Check logs in Render dashboard
\`\`\`
EOF

print_status "Deployment checklist created: RENDER_CHECKLIST.md"

echo ""
echo "🎉 Preparation complete!"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub"
echo "2. Follow the checklist in RENDER_CHECKLIST.md"
echo "3. Deploy backend first, then frontend"
echo "4. Test all functionality"
echo ""
echo "Good luck with your deployment! 🚀" 