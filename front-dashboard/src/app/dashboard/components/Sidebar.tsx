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
import { useLanguage } from '../../../contexts/LanguageContext';


const navigation = [
  { name: 'dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  { name: 'notifications', href: '/dashboard/notifications', icon: BellIcon },
  { name: 'profile', href: '/dashboard/profile', icon: CogIcon },
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
  userRole?: string;
  currentSite?: any; // Add current site prop
}

export default function Sidebar({ sites, onSidebarToggle, sidebarOpen = false, userRole, currentSite }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();
  
  // Debug logging
  console.log('Sidebar props:', { sites: sites?.length, userRole, currentSite: currentSite?.name, currentSiteDevices: currentSite?.devices?.length });

  const toggleSidebar = () => {
    if (onSidebarToggle) {
      onSidebarToggle();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Filter navigation items based on user role
  const getFilteredNavigation = () => {
    if (userRole === 'technicien' || userRole === 'user') {
      // Techniciens and regular users see navigation items but they're disabled, except Profile
      return navigation.map(item => ({
        ...item,
        disabled: item.name === 'Profile' ? false : true
      }));
    }
    return navigation.map(item => ({
      ...item,
      disabled: false
    }));
  };

  const filteredNavigation = getFilteredNavigation();

  // Handle navigation click for technicien and user roles
  const handleNavigationClick = (e: React.MouseEvent, item: any) => {
    if ((userRole === 'technicien' || userRole === 'user') && item.disabled) {
      e.preventDefault();
      // Redirect to first site if available
      if (sites && sites.length > 0) {
        window.location.href = `/dashboard/sites/${sites[0]._id}`;
      }
    }
    // Profile is accessible to all roles, no redirection needed
  };

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-90 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'w-16' : 'w-64'} ${
        // On mobile, use absolute positioning to not take up space
        'lg:relative lg:flex-shrink-0 fixed lg:static inset-y-0 left-0 z-50'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 border-b border-gray-200 dark:border-gray-700">
                {filteredNavigation.length > 0 && (   
                  <div className="flex items-center justify-between mb-3 sm:mb-4 px-2">
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <h1 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{t('sidebar.dashboard')}</h1>
                      </div>
                    )}

                    {/* Collapse toggle button - only show on desktop */}     
                    <button
                      onClick={toggleCollapse}
                      className="hidden lg:flex p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4" />
                      ) : (
                        <ChevronLeftIcon className="w-4 h-4" />
                      )}
                    </button>
                    </div>
              )}
          <div className="flex items-center justify-end gap-2">  
            {/* Mobile close button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto">
            <div>

              <div className="space-y-1">
                {filteredNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={(e) => handleNavigationClick(e, item)}
                      className={`group flex items-center px-2 sm:px-3 py-2 sm:py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      } ${isCollapsed ? 'justify-center' : ''} ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isCollapsed ? (item.disabled ? `${item.name} - Access restricted for ${userRole === 'technicien' ? 'techniciens' : 'users'}` : item.name) : undefined}
                    >
                      <item.icon
                        className={`h-5 w-5 ${
                          isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                        } ${isCollapsed ? 'mx-auto' : 'mr-3'} ${item.disabled ? 'opacity-50' : ''}`}
                      />
                      {!isCollapsed && <span className="truncate">{t(`sidebar.${item.name}`)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 sm:mt-8">
              {userRole !== 'technicien' && userRole !== 'user' && (
                <>
                  {isCollapsed ? (
                    <div className="flex flex-col items-center gap-4">
                      {/* Only icons for admin actions when collapsed */}
                      {/* Example: */}
                      <button title="Admin Action" className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12.93V17h-2v-2.07A6.002 6.002 0 014 11H2v-2h2a6.002 6.002 0 015-5.93V3h2v2.07A6.002 6.002 0 0116 9h2v2h-2a6.002 6.002 0 01-5 5.93z" /></svg>
                      </button>
                    </div>
                  ) : (
                    <AdminActions />
                  )}
                </>
              )}
            </div>
                         {/* SITES LIST */}
             <div className="mt-6 sm:mt-8">
               <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{t('sites.title')}</h3>
               <ul className="space-y-1">
                                  {sites && sites.length > 0 ? (
                   sites.map(site => {
                     console.log('Site in sidebar:', { 
                       id: site._id, 
                       name: site.name, 
                       devices: site.devices?.length,
                       devicesArray: site.devices,
                       firstDevice: site.devices?.[0]
                     });
                     return (
                       <li key={site._id} className="space-y-1">
                         {/* Site Link */}
                         <Link
                           href={`/dashboard/sites/${site._id}`}
                           className={`flex items-center w-full px-2 py-1 rounded transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                             currentSite && currentSite._id === site._id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''
                           }`}
                           title={site.name}
                         >
                           <img
                             src={typeIconUrl[site.type] || defaultIconUrl}
                             alt={site.type}
                             className="w-5 h-5 inline-block align-middle filter brightness-150"
                           />
                           <span className="ml-2 block truncate text-gray-700 dark:text-gray-300">
                             {site.name}
                             {site.devices && site.devices.length > 0 && (
                               <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({site.devices.length})</span>
                             )}
                           </span>
                         </Link>
                         
                         {/* Devices under this site */}
                         {site.devices && site.devices.length > 0 && currentSite && currentSite._id === site._id ? (
                           <ul className="ml-6 space-y-1">
                             {site.devices.map((device: any) => (
                               <li key={device.deviceId}>
                                 <Link
                                   href={`/dashboard/sites/${site._id}/devices/${device.deviceId}/${device.type}`}
                                   className={`flex items-center w-full px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 text-sm`}
                                   title={`${device.name} (${device.type})`}
                                 >
                                   {/* Device type icon */}
                                   <div className="w-4 h-4 flex items-center justify-center mr-2">
                                     {device.type === 'energy' && <BoltIcon className="w-3 h-3 text-blue-500" />}
                                     {device.type === 'solar' && <SunIcon className="w-3 h-3 text-yellow-500" />}
                                     {device.type === 'water' && <CloudIcon className="w-3 h-3 text-blue-400" />}
                                     {device.type === 'gas' && <FireIcon className="w-3 h-3 text-red-500" />}
                                     {device.type === 'temperature' && <span className="text-xs text-orange-500">°C</span>}
                                     {device.type === 'humidity' && <span className="text-xs text-green-500">%</span>}
                                     {device.type === 'pressure' && <span className="text-xs text-purple-500">P</span>}
                                     {!['energy', 'solar', 'water', 'gas', 'temperature', 'humidity', 'pressure'].includes(device.type) && (
                                       <CogIcon className="w-4 h-4 text-gray-500" />
                                     )}
                                   </div>
                                   <span className="truncate text-gray-600 dark:text-gray-400">{device.name}</span>
                                 </Link>
                               </li>
                             ))}
                           </ul>
                         ) : null}
                       </li>
                     );
                   })
                 ) : (
                   <li className="text-gray-400 dark:text-gray-500 px-2 py-1">{t('sites.noSites')}</li>
                 )}
               </ul>
             </div>


          </nav>
        </div>
      </div>
    </>
  );
} 