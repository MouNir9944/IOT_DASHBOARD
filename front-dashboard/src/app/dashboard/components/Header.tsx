'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  BuildingOfficeIcon,
  DevicePhoneMobileIcon,
  SunIcon,
  MoonIcon,
  LanguageIcon
} from '@heroicons/react/24/outline';
import Logo from './Logo';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../../contexts/LanguageContext';

interface User {
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface NotificationMeta {
  siteName?: string;
  deviceName?: string;
  parameter?: string;
  currentValue?: number | string;
  comparisonValue?: number | string;
  dailyConsumption?: number | string;
  threshold?: number | string;
  condition?: string;
  unit?: string;
  deviceType?: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'critical';
  status: 'new' | 'read' | 'acknowledged' | 'resolved';
  createdAt: string;
  siteId?: { _id: string; name: string };
  deviceId?: string;
  metadata?: NotificationMeta;
}

interface HeaderProps {
  user: User;
  onSidebarToggle?: () => void;
}

import { API_CONFIG, buildApiUrl, getNotificationStreamUrl, validateConfig } from '../../../config/api';

// Validate configuration on component mount
const API_URL = API_CONFIG.BACKEND_URL;

export default function Header({ user, onSidebarToggle }: HeaderProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { currentLanguage, setLanguage, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  // Validate configuration on component mount
  useEffect(() => {
    if (!validateConfig()) {
      console.error('❌ Invalid API configuration detected');
    }
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // Filter notifications by current user ID
      const response = await fetch(`${API_URL}/api/notifications?status=new&limit=5&userId=${user.email}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      // Filter notification count by current user ID
      const response = await fetch(`${API_URL}/api/notifications/count?userId=${user.email}`);
      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.new);
        console.log('📊 Fetched notification count:', data.new);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  // Function to refresh notifications and count
  const refreshNotifications = async () => {
    await fetchNotifications();
    await fetchNotificationCount();
  };

  // Function to handle notification status changes
  const handleNotificationStatusChange = async (notificationId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/${newStatus}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh notifications and count after status change
        await refreshNotifications();
        console.log(`✅ Notification ${notificationId} marked as ${newStatus}`);
      }
    } catch (error) {
      console.error(`Failed to update notification status:`, error);
    }
  };

  //

  // Initialize Server-Sent Events for real-time notifications
  const initializeSSE = () => {
    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new SSE connection using validated URL
      const streamUrl = getNotificationStreamUrl();
      console.log('🔌 Connecting to SSE stream:', streamUrl);
      eventSourceRef.current = new EventSource(streamUrl);
      
      eventSourceRef.current.onopen = () => {
        console.log('🔌 SSE connection established for notifications');
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📢 Received SSE notification update:', data);
          
          if (data.type === 'notification_created') {
            // Only process notifications assigned to current user
            if (data.userId === user.email) {
              // Refresh to fetch full details (site/device/metadata)
              refreshNotifications();
              // Optimistically update count
              setNotificationCount(prev => prev + 1);
              
              // Show browser notification if permission granted
              if (Notification.permission === 'granted') {
                new Notification(data.notification.title, {
                  body: data.notification.message,
                  icon: '/favicon.ico'
                });
              }
            } else {
              console.log('📢 Ignoring notification for different user:', data.userId);
            }
          } else if (data.type === 'notification_count_update') {
            // Only update count if it's for the current user
            if (data.userId === user.email) {
              setNotificationCount(data.count);
              console.log('📊 Updated notification count:', data.count);
            } else {
              console.log('📊 Ignoring count update for different user:', data.userId);
            }
          } else if (data.type === 'connected') {
            console.log('🔌 SSE connected:', data.message);
          } else if (data.type === 'heartbeat') {
            // Handle heartbeat - connection is alive
            console.log('💓 SSE heartbeat received');
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('SSE connection error:', error);
        // Reconnect after 5 seconds
        setTimeout(() => {
          console.log('🔄 Reconnecting SSE...');
          initializeSSE();
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to initialize SSE:', error);
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  };



  useEffect(() => {
    // Initial fetch
    refreshNotifications();
    
    // Initialize SSE for real-time updates
    initializeSSE();
    
    // Request notification permission
    requestNotificationPermission();
    
    // Fallback polling every 30 seconds (in case SSE fails)
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);
    
    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Close language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLanguageMenu && !(event.target as Element).closest('.language-selector')) {
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageMenu]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <ExclamationCircleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return t('time.justNow');
    if (diffInMinutes < 60) return `${diffInMinutes}${t('time.minutesAgo')}`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}${t('time.hoursAgo')}`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format numbers to 3 decimals when numeric
  const formatNumber = (val: unknown) => {
    const num = Number(val as any);
    return Number.isFinite(num) ? num.toFixed(3) : String(val ?? '');
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 md:px-6 py-3 sm:py-4 z-10">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Mobile sidebar toggle button */}
          <button
            onClick={onSidebarToggle}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 mr-3"
          >
            <Bars3Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
            <Logo size="lg" className="mr-0" />
            <div className="flex-1 min-w-0">
            <div className="flex flex-col items-start gap-2">
              <h1 className="hidden sm:block text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{t('dashboard.title')}</h1>
              <p className="hidden sm:block text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{t('header.welcome')}, {user.name || user.email}</p>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center animate-pulse">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('header.notifications')}</h3>
                </div>
                <div className="max-h-64 sm:max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center">
                      <BellIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('header.noNotifications')}</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const siteName = notification.metadata?.siteName || notification.siteId?.name;
                      const deviceName = notification.metadata?.deviceName || notification.deviceId;
                      const parameter = notification.metadata?.parameter;
                      const unit = notification.metadata?.unit ? ` ${notification.metadata.unit}` : '';
                      const isConsumption = String(parameter || '').toLowerCase() === 'consumption';
                      const value = isConsumption
                        ? (notification.metadata?.dailyConsumption ?? notification.metadata?.comparisonValue ?? notification.metadata?.currentValue)
                        : (notification.metadata?.currentValue ?? notification.metadata?.comparisonValue);
                      const valueLabel = isConsumption ? 'Daily Consumption' : (parameter ? 'Current Value' : 'Value');
                      const formattedValue = value !== undefined ? formatNumber(value) : undefined;
                      const threshold = notification.metadata?.threshold;
                      const formattedThreshold = threshold !== undefined ? formatNumber(threshold) : undefined;
                      const condition = notification.metadata?.condition?.toUpperCase();
                      return (
                      <div
                        key={notification._id}
                        className={`p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          notification.type === 'error' || notification.type === 'critical' ? 'border-l-4 border-l-red-500' :
                          notification.type === 'warning' ? 'border-l-4 border-l-yellow-500' :
                          notification.type === 'success' ? 'border-l-4 border-l-green-500' :
                          'border-l-4 border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getTypeIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {notification.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            {(siteName || deviceName) && (
                              <div className="mt-2 flex items-center gap-3 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
                                {siteName && (
                                  <span className="inline-flex items-center gap-1">
                                    <BuildingOfficeIcon className="w-3 h-3" /> {siteName}
                                  </span>
                                )}
                                {deviceName && (
                                  <span className="inline-flex items-center gap-1">
                                    <DevicePhoneMobileIcon className="w-3 h-3" /> {deviceName}
                                  </span>
                                )}
                              </div>
                            )}
                              {(parameter || value !== undefined || threshold !== undefined) && (
                              <div className="mt-1 text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">
                                {parameter && (
                                  <span className="font-medium">{isConsumption ? t('analytics.dailyConsumption') : parameter}:</span>
                                )} {formattedValue !== undefined ? `${formattedValue}${unit}` : ''}
                                {threshold !== undefined && (
                                    <span className="ml-2 text-gray-500 dark:text-gray-400">({condition || ''} {formattedThreshold}{unit})</span>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" title={formatDateTime(notification.createdAt)}>
                              {formatTime(notification.createdAt)} • {formatDateTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
                <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
                  <button 
                    onClick={() => {
                      setShowNotifications(false);
                      // Navigate to notifications page using Next.js router
                      router.push('/dashboard/notifications');
                    }}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    {t('header.viewAllNotifications')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={theme === 'light' ? t('header.switchToDark') : t('header.switchToLight')}
          >
            {theme === 'light' ? (
              <MoonIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <SunIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          {/* Language Selector */}
          <div className="relative language-selector">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('header.switchLanguage')}
            >
              <div className="flex items-center space-x-1">
                <LanguageIcon className="w-4 h-4" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {currentLanguage === 'en' ? 'EN' : 'FR'}
                </span>
              </div>
            </button>

            {/* Language Dropdown */}
            {showLanguageMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setShowLanguageMenu(false);
                      // TODO: Implement language change logic
                      console.log('Language changed to English');
                    }}
                    className={`flex items-center w-full px-3 py-2 text-sm ${
                      currentLanguage === 'en' 
                        ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">🇺🇸</span>
                    English
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('fr');
                      setShowLanguageMenu(false);
                      // TODO: Implement language change logic
                      console.log('Language changed to French');
                    }}
                    className={`flex items-center w-full px-3 py-2 text-sm ${
                      currentLanguage === 'fr' 
                        ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">🇫🇷</span>
                    Français
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <UserCircleIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              <div className="text-left hidden sm:block">
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
              </div>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2 sm:mr-3" />
                    {t('header.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 