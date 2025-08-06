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
      
      // Add query parameters for filtering
      const params = new URLSearchParams();
      if (session.user.role) {
        params.append('role', session.user.role);
      }
      if (session.user.role === 'admin' && session.user.id) {
        params.append('createdBy', session.user.id);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.error) {
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
        <Sidebar 
          sites={sites} 
          onSidebarToggle={toggleSidebar} 
          sidebarOpen={sidebarOpen} 
          userRole={user.role}
        />

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 