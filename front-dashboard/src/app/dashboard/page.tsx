import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import DashboardLayout from './components/DashboardLayout';
import DashboardContent from './components/DashboardContent';
import { buildApiUrl } from '../../config/api';

const API_URL = buildApiUrl('/api/sites');

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  console.log('Dashboard page - Session user:', {
    id: session.user?.id,
    role: session.user?.role,
    name: session.user?.name,
    email: session.user?.email
  });

  // Redirect users and techniciens to their first site
  if (session.user?.role === 'user' || session.user?.role === 'technicien') {
    console.log('User/Technicien detected, redirecting to their first site...');
    
    // First try to get user-specific sites
    let sites = [];
    try {
      const url = `${API_URL}/user/${session.user.id}`;
      console.log('Fetching user-specific sites:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store' // Ensure fresh data
      });
      
      if (res.ok) {
        const userSites = await res.json();
        console.log('User sites fetched:', userSites);
        if (Array.isArray(userSites)) {
          sites = userSites;
        }
      } else {
        console.log('User-specific sites failed, trying fallback...');
      }
    } catch (error) {
      console.error('Error fetching user-specific sites:', error);
    }
    
    // If no user-specific sites, try all sites as fallback
    if (sites.length === 0) {
      try {
        console.log('Trying fallback - fetching all sites...');
        const allSitesRes = await fetch(API_URL, { cache: 'no-store' });
        const allSites = await allSitesRes.json();
        if (Array.isArray(allSites)) {
          sites = allSites;
          console.log('Fallback sites fetched:', sites.length);
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    }
    
    // Redirect to first site if available
    if (sites.length > 0) {
      const firstSite = sites[0];
      console.log('Redirecting to first site:', firstSite._id, firstSite.name);
      redirect(`/dashboard/sites/${firstSite._id}`);
    } else {
      console.log('No sites available for redirect');
    }
  } else {
    console.log('Admin/Superadmin detected, showing dashboard...');
  }

  // Use real user data from session
  const user = {
    name: session.user?.name || 'User',
    email: session.user?.email || 'user@example.com',
    role: session.user?.role || 'User'
  };

  return (
    <DashboardLayout user={user}>
      <DashboardContent />
    </DashboardLayout>
  );
} 