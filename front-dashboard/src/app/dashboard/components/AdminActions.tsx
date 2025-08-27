"use client";
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../../contexts/LanguageContext';
  
export default function AdminActions() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const role = session?.user?.role;
  if (status !== 'authenticated' || (role !== 'admin' && role !== 'superadmin' && role !== 'sous admin')) return null;

  // Use the same classes as Sidebar navigation links
  const linkClass =
    'group flex items-center px-2 sm:px-3 py-2 sm:py-2 text-sm font-medium rounded-md transition-colors ' +
    'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100';

  return (
    <div className="mt-6 sm:mt-8">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 sm:mb-4 px-2">
        {t('users.title')} {t('common.actions')}
      </h3>
      <div className="space-y-1">
        <Link href="/dashboard/create-user" className={linkClass}>
          <UserGroupIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 mr-3" />
          <span className="truncate">{t('users.createUser')}</span>
        </Link>
        <Link href="/dashboard/create-site" className={linkClass}>
          <PlusIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 mr-3" />
          <span className="truncate">{t('sites.createSite')}</span>
        </Link>
      </div>
    </div>
  );
} 