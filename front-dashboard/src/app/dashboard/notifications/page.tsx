'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'; // TODO: change to /api/sites/user/{userId}   

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return <div className="p-6">Loading...</div>;
  }
  if (!session) {
    router.replace('/login');
    return null;
  }

  const user = {
    name: session.user?.name || 'User',
    email: session.user?.email || 'user@example.com',
    role: session.user?.role || 'User',
  };

  return (
    <DashboardLayout user={user}>
      <div className="p-8 text-center text-xl text-gray-700 font-semibold">
      notifications coming soon!
      </div>
    </DashboardLayout>
  );
} 