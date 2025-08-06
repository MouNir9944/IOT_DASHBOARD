'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ChartBarIcon,
  CogIcon,
  BellIcon,
  WrenchScrewdriverIcon,
  SunIcon,
  BoltIcon,
  CloudIcon,
  FireIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import AdminActions from './AdminActions';


const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  { name: 'Notifications', href: '/dashboard/notifications', icon: BellIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
];

// Icon URLs by type (same as on the map)
const typeIconUrl: Record<string, string> = {
  manufacturing: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/gear-fill.svg',
  farm: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/tree-fill.svg',
  building: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/building.svg',
  warehouse: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/box-seam.svg',
  office: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/briefcase-fill.svg',
};
const defaultIconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png';

interface SidebarProps {
  sites?: any[];
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function Sidebar({ sites, onSidebarToggle, sidebarOpen = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => {
    if (onSidebarToggle) {
      onSidebarToggle();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'w-16' : 'w-64'} ${
        // On mobile, use absolute positioning to not take up space
        'lg:relative lg:flex-shrink-0 fixed lg:static inset-y-0 left-0 z-50'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 border-b border-gray-200">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate"></h1>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4 px-2">
                {!isCollapsed && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Main Navigation
                  </h3>
                )}
                {/* Collapse toggle button - only show on desktop */}
                <button
                  onClick={toggleCollapse}
                  className="hidden lg:flex p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4" />
                  ) : (
                    <ChevronLeftIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 sm:px-3 py-2 sm:py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } ${isCollapsed ? 'justify-center' : ''}`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <item.icon
                        className={`h-5 w-5 ${
                          isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                        } ${isCollapsed ? 'mx-auto' : 'mr-3'}`}
                      />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 sm:mt-8">
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-4">
                  {/* Only icons for admin actions when collapsed */}
                  {/* Example: */}
                  <button title="Admin Action" className="p-2 rounded hover:bg-gray-200">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12.93V17h-2v-2.07A6.002 6.002 0 014 11H2v-2h2a6.002 6.002 0 015-5.93V3h2v2.07A6.002 6.002 0 0116 9h2v2h-2a6.002 6.002 0 01-5 5.93z" /></svg>
                  </button>
                </div>
              ) : (
                <AdminActions />
              )}
            </div>
            {/* SITES LIST (replaces Device Categories) */}
                <div className="mt-6 sm:mt-8">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sites</h3>
              <ul className="space-y-1">
                {sites && sites.length > 0 ? (
                  sites.map(site => (
                    <li key={site._id} className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/sites/${site._id}`}
                        className={`flex items-center w-full px-2 py-1 rounded transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isCollapsed ? 'justify-center' : ''}`}
                        title={site.name}
                      >
                        <img
                          src={typeIconUrl[site.type] || defaultIconUrl}
                          alt={site.type}
                          className="w-5 h-5 inline-block align-middle filter brightness-150"
                        />
                        {!isCollapsed && (
                          <span className="ml-2 block truncate text-gray-700">{site.name}</span>
                        )}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400 px-2 py-1">No sites</li>
                )}
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
} 