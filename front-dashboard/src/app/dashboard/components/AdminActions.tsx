"use client";
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
  
export default function AdminActions() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  if (status !== 'authenticated' || (role !== 'admin' && role !== 'superadmin')) return null;

  // Use the same classes as Sidebar navigation links
  const linkClass =
    'group flex items-center px-2 sm:px-3 py-2 sm:py-2 text-sm font-medium rounded-md transition-colors ' +
    'text-gray-600 hover:bg-gray-50 hover:text-gray-900';

  return (
    <div className="mt-6 sm:mt-8">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 sm:mb-4 px-2">
        Admin Actions
      </h3>
      <div className="space-y-1">
        <Link href="/dashboard/create-user" className={linkClass}>
          <UserGroupIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500 mr-3" />
          <span className="truncate">Create User</span>
        </Link>
        <Link href="/dashboard/create-site" className={linkClass}>
          <PlusIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-500 mr-3" />
          <span className="truncate">Create Site</span>
        </Link>
      </div>
    </div>
  );
} 