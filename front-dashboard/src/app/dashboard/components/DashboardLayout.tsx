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

const API_URL = 'http://localhost:5000/api/sites';

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sites, setSites] = useState<any[]>([]);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;
    const fetchSites = async () => {
      let url = API_URL;
      if (session.user.role !== 'superadmin') {
        url = `${API_URL}/user/${session.user.id}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setSites(data);
    };
    fetchSites();
  }, [session]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar sites={sites} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden lg:ml-0">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
} 