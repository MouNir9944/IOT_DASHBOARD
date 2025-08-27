'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { buildApiUrl } from '../../../config/api';

interface User {
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

const API_URL = buildApiUrl('/api/sites'); // TODO: change to /api/sites/user/{userId}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sites, setSites] = useState<any[]>([]);
  const [currentSite, setCurrentSite] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  
  // Detect current site from URL
  const getCurrentSiteId = () => {
    const siteMatch = pathname.match(/\/dashboard\/sites\/([^\/]+)/);
    return siteMatch ? siteMatch[1] : null;
  };
  
  const currentSiteId = getCurrentSiteId();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (!session?.user || !API_URL) return;
    
    const fetchSites = async () => {
      try {
        let url = API_URL;
        
        // Add query parameters for filtering
        const params = new URLSearchParams();
        if (session.user.role) {
          params.append('role', session.user.role);
        }
        // Always pass userId for role-based access control
        if (session.user.id) {
          params.append('userId', session.user.id);
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log('Fetching sites from URL:', url);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch sites: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.error) {
          console.error('Error fetching sites:', data);
          setSites([]);
        } else {
          console.log('Sites fetched:', data);
          console.log('Sites array length:', Array.isArray(data) ? data.length : 0);
          
          // Debug: Check if sites have devices
          if (Array.isArray(data) && data.length > 0) {
            const firstSite = data[0];
            console.log('🔍 First site:', { 
              id: firstSite._id, 
              name: firstSite.name, 
              devicesCount: firstSite.devices?.length || 0 
            });
            if (firstSite.devices && firstSite.devices.length > 0) {
              console.log('🔍 First device:', { 
                id: firstSite.devices[0].deviceId, 
                name: firstSite.devices[0].name, 
                type: firstSite.devices[0].type 
              });
            }
          }
          
          setSites(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        setSites([]);
      }
    };
    
    fetchSites();
  }, [session, API_URL]);

  // Fetch current site data when viewing a specific site
  useEffect(() => {
    if (!currentSiteId || !session?.user) return;
    
    const fetchCurrentSite = async () => {
      try {
        let url = `${API_URL}/${currentSiteId}`;
        
        // Add query parameters for filtering based on user role
        const params = new URLSearchParams();
        if (session.user.role) {
          params.append('role', session.user.role);
        }
        // Always pass userId for role-based access control
        if (session.user.id) {
          params.append('userId', session.user.id);
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch current site: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (data.error) {
          console.error('Error fetching current site:', data);
          setCurrentSite(null);
        } else {
          console.log('Current site data fetched:', data);
          console.log('Devices in current site:', data.devices);
          setCurrentSite(data);
        }
      } catch (error) {
        console.error('Error fetching current site:', error);
        setCurrentSite(null);
      }
    };
    
    fetchCurrentSite();
    
    // Cleanup function to clear current site when unmounting
    return () => {
      setCurrentSite(null);
    };
  }, [currentSiteId, session, API_URL]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header user={user} onSidebarToggle={toggleSidebar} />
      <div className="flex flex-1">
        <Sidebar 
          sites={sites} 
          onSidebarToggle={toggleSidebar} 
          sidebarOpen={sidebarOpen} 
          userRole={user.role}
          currentSite={currentSite}
        />

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
} 