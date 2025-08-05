# IoT Dashboard Backend

Backend API for the IoT Dashboard frontend, built with Express.js, MongoDB, and JWT authentication.

## Features

- 🔐 JWT Authentication
- 👤 User Management (Login/Register)
- 🛡️ Security with Helmet and Rate Limiting
- 🗄️ MongoDB Database
- 🔄 CORS Support for Frontend
- 📊 Health Check Endpoints

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
MONGO_URI=mongodb://localhost:27017/iot_dashboard
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### 3. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile (requires token)

### Health Check

- `GET /api/health` - Server health status
- `GET /` - API information

## Testing the API

### 1. Create a Test User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "admin"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Check Health

```bash
curl http://localhost:5000/api/health
```

## Database Schema

### User Model

```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ['user', 'admin']),
  isActive: Boolean (default: true),
  timestamps: true
}
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation

## Frontend Integration

This backend is designed to work with the Next.js frontend. Make sure your frontend environment variables include:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

## Troubleshooting

1. **MongoDB Connection Error**: Make sure MongoDB is running
2. **CORS Errors**: Check that CORS_ORIGIN matches your frontend URL
3. **JWT Errors**: Ensure JWT_SECRET is set in environment variables
4. **Port Already in Use**: Change PORT in .env file

## Development

- Use `npm run dev` for development with auto-restart
- Check logs for detailed error messages
- Test endpoints with curl or Postman 