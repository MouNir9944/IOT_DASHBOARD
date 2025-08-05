# Setup Guide for IoT Dashboard

## Quick Setup

### 1. Backend Setup

First, make sure your backend is properly configured:

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file in backend directory:**
   ```env
   MONGO_URI=mongodb://localhost:27017/your_database
   JWT_SECRET=your-super-secret-jwt-key
   PORT=5000
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the backend server:**
   ```bash
   node server.js
   ```

### 2. Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd front-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local` file:**
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   ```

4. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

### 3. Test the Integration

1. Open your browser and go to `http://localhost:3000`
2. You should be redirected to the login page
3. Use your backend user credentials to log in
4. After successful login, you'll be redirected to the dashboard

## Troubleshooting

### Common Issues:

1. **CORS Errors:**
   - Make sure your backend CORS_ORIGIN includes `http://localhost:3000`
   - Check that the backend is running on port 5000

2. **Authentication Fails:**
   - Verify your backend `/api/auth/login` endpoint is working
   - Check that JWT_SECRET is set in backend environment
   - Ensure MongoDB is running and connected

3. **Frontend Can't Connect to Backend:**
   - Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
   - Check that backend server is running
   - Test backend endpoint directly: `http://localhost:5000/api/auth/login`

### Testing Backend API:

You can test your backend authentication endpoint directly:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

This should return a JSON response with a token and user information.

## Next Steps

After successful setup:

1. Create users in your backend database
2. Customize the dashboard components
3. Add more features to your IoT dashboard
4. Deploy to production with proper environment variables 