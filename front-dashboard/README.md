# IoT Dashboard Frontend

This is the frontend dashboard for the IoT system, built with Next.js and NextAuth.js.

## Features

- User authentication with backend integration
- Protected dashboard routes
- Role-based access control
- Modern UI with Tailwind CSS

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the frontend directory with the following variables:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### 2. Backend Requirements

Make sure your backend server is running on port 5000 with the following:

- MongoDB connection
- JWT_SECRET environment variable set
- Authentication routes at `/api/auth/login`
- CORS configured to allow frontend requests

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Authentication Flow

1. Users enter their credentials on the login page
2. Credentials are sent to the backend `/api/auth/login` endpoint
3. Backend validates credentials and returns JWT token
4. Frontend stores the token in NextAuth session
5. Users are redirected to the dashboard
6. Protected routes check for valid session

## Backend Integration

The frontend connects to your backend API for:
- User authentication
- Session management
- Role-based access control

Make sure your backend is running and accessible at the URL specified in `NEXT_PUBLIC_BACKEND_URL`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts          # NextAuth configuration
│   │
│   ├── dashboard/
│   │   └── page.tsx                  # Dashboard page
│   │
│   ├── login/
│   │   └── page.tsx                  # Login page
│   │
│   ├── globals.css                   # Global styles
│   │
│   ├── layout.tsx                    # Root layout
│   │
│   ├── page.tsx                      # Home page (redirects)
│   │
│   └── providers.tsx                 # Client providers
```

## Customization

### Adding New Pages

1. Create a new directory in `src/app/`
2. Add a `page.tsx` file
3. Use `getServerSession(authOptions)` for protected routes

### Styling

The application uses Tailwind CSS. You can customize the design by modifying:
- `src/app/globals.css` - Global styles
- Component-specific classes in each page

## Security Notes

- This is a demo application with hardcoded credentials
- For production, implement proper user management and database integration
- Use environment variables for sensitive configuration
- Consider adding rate limiting and additional security measures

## License

MIT License
