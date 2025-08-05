'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import dynamic from 'next/dynamic';

const CreateSiteContent = dynamic(() => import('./CreateSiteContent'), { ssr: false });

export default function Page() {
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
      <CreateSiteContent />
    </DashboardLayout>
  );
}