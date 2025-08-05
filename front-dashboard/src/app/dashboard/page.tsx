import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import DashboardLayout from './components/DashboardLayout';
import DashboardContent from './components/DashboardContent';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
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