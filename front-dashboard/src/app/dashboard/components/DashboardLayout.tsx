'use client';

import { useState, useEffect } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from './Sidebar';
import Header from './Header';

interface User {
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'; // TODO: change to /api/sites/user/{userId}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sites, setSites] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (!session?.user) return;
    const fetchSites = async () => {
      let url = API_URL;
      if (session.user.role !== 'superadmin') {
        url = `${API_URL}/user/${session.user.id}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      
      // Handle error response - if user not found, try fetching all sites
      if (data.error && data.error.includes('User not found') && session.user.role !== 'superadmin') {
        console.log('User not found, fetching all sites instead');
        const allSitesRes = await fetch(API_URL);
        const allSitesData = await allSitesRes.json();
        setSites(Array.isArray(allSitesData) ? allSitesData : []);
      } else if (data.error) {
        console.error('Error fetching sites:', data);
        setSites([]);
      } else {
        setSites(Array.isArray(data) ? data : []);
      }
    };
    fetchSites();
  }, [session]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header user={user} onSidebarToggle={toggleSidebar} />
      <div className="flex flex-1">
        <Sidebar sites={sites} onSidebarToggle={toggleSidebar} sidebarOpen={sidebarOpen} />

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 