# Dashboard Layout System

This directory contains the dashboard layout system that ensures consistent navigation (sidebar and header) across all dashboard pages.

## Components

### DashboardLayout
The main layout component that wraps all dashboard pages with:
- Sidebar navigation
- Header with user info and notifications
- Responsive design for mobile and desktop

### PageTemplate
A template system for creating new dashboard pages with consistent structure.

## How to Create New Dashboard Pages

### Method 1: Using DashboardLayout directly

```tsx
// src/app/dashboard/analytics/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const user = {
    name: session.user?.name || 'User',
    email: session.user?.email || 'user@example.com',
    role: session.user?.role || 'User'
  };

  return (
    <DashboardLayout user={user}>
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">View detailed analytics and reports</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          {/* Your page content here */}
        </div>
      </div>
    </DashboardLayout>
  );
}
```

### Method 2: Using the PageTemplate helper

```tsx
// src/app/dashboard/analytics/page.tsx
import { createDashboardPage } from '../components/PageTemplate';

export default createDashboardPage(() => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
    <p className="text-gray-600 mt-1">View detailed analytics and reports</p>
    
    {/* Your page content here */}
  </div>
));
```

## Features

### Consistent Navigation
- All pages automatically get the sidebar and header
- User authentication is handled automatically
- User role-based navigation (admin features only show for admin users)

### Responsive Design
- Sidebar collapses on mobile
- Header adapts to screen size
- Touch-friendly navigation

### User Management
- Real user data from session
- Role-based access control
- User profile and logout functionality

### Notifications
- Bell icon with notification count
- Dropdown with notification list
- Real-time notification updates

## File Structure

```
src/app/dashboard/
├── components/
│   ├── DashboardLayout.tsx    # Main layout wrapper
│   ├── Header.tsx            # Top navigation bar
│   ├── Sidebar.tsx           # Side navigation
│   ├── PageTemplate.tsx      # Template helper
│   └── DashboardContent.tsx  # Main dashboard content
├── create-site/
│   ├── page.tsx              # Create site page
│   └── CreateSiteContent.tsx # Create site content
├── page.tsx                  # Main dashboard page
└── README.md                 # This file
```

## Adding New Navigation Items

To add new navigation items, edit `src/app/dashboard/components/Sidebar.tsx`:

```tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  // Add your new page here
  { name: 'Your Page', href: '/dashboard/your-page', icon: YourIcon },
];
```

## Styling Guidelines

- Use `p-6` for page padding
- Use `space-y-6` for vertical spacing between sections
- Use `bg-white rounded-lg shadow` for content containers
- Follow the existing color scheme (blue for primary actions, gray for text) 