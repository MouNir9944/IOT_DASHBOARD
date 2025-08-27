'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { 
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckIcon,
  EyeIcon,
  XMarkIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  BuildingOfficeIcon,
  CogIcon,
  ShieldExclamationIcon,
  ExclamationCircleIcon as AlertIcon
} from '@heroicons/react/24/outline';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'critical';
  category: 'device' | 'site' | 'system' | 'maintenance' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'read' | 'acknowledged' | 'resolved';
  siteId?: {
    _id: string;
    name: string;
  };
  deviceId?: string;
  createdAt: string;
  readAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: any;
}

interface NotificationCounts {
  new: number;
  read: number;
  acknowledged: number;
  resolved: number;
  total: number;
}

import { API_CONFIG, buildApiUrl, validateConfig } from '../../../config/api';
import { useLanguage } from '../../../contexts/LanguageContext';

const API_URL = API_CONFIG.BACKEND_URL;

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    new: 0,
    read: 0,
    acknowledged: 0,
    resolved: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<'new' | 'acknowledged' | 'resolved'>('new');
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  
  // Mark all as read feedback
  const [showMarkAllFeedback, setShowMarkAllFeedback] = useState(false);
  const [markAllResult, setMarkAllResult] = useState<{
    message: string;
    modifiedCount: number;
    affectedNotifications: Notification[];
  } | null>(null);

  // Check if API_URL is available and validate configuration
  useEffect(() => {
    console.log('🔧 Notifications Page - API_URL:', API_URL);
    
    // Validate configuration
    if (!validateConfig()) {
      setError('Backend URL not configured properly. Please check your environment variables.');
      setLoading(false);
      return;
    }
    
    if (!API_URL) {
      setError('Backend URL not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }
  }, []);

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

  console.log('🔧 Notifications Page - User:', user);
  console.log('🔧 Notifications Page - Session:', session);

  const fetchNotifications = useCallback(async () => {
    if (!API_URL) {
      setError('Backend URL not configured');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        status: activeTab, // Use active tab as status filter
        userId: user.email // Filter by current user
      });
      
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      
      const response = await fetch(`${API_URL}/api/notifications?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalNotifications(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, currentPage, activeTab, typeFilter, categoryFilter, priorityFilter, user.email]);

  const fetchCounts = useCallback(async () => {
    if (!API_URL) {
      console.error('Backend URL not configured');
      return;
    }

    try {
      // Filter counts by current user
      const response = await fetch(`${API_URL}/api/notifications/count?userId=${user.email}`);
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      } else {
        console.error('Failed to fetch notification counts:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch notification counts:', err);
    }
  }, [API_URL, user.email]);

  useEffect(() => {
    if (API_URL) {
      fetchNotifications();
      fetchCounts();
    }
  }, [fetchNotifications, fetchCounts]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!API_URL) return;
    
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        // Update the notification in the list
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, status: 'read', readAt: new Date().toISOString() }
              : notif
          )
        );
        fetchCounts(); // Refresh counts
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleAcknowledge = async (notificationId: string) => {
    if (!API_URL) return;
    
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/acknowledge`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
              : notif
          )
        );
        fetchCounts();
      }
    } catch (err) {
      console.error('Failed to acknowledge notification:', err);
    }
  };

  const handleResolve = async (notificationId: string) => {
    if (!API_URL) return;
    
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/resolve`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, status: 'resolved', resolvedAt: new Date().toISOString() }
              : notif
          )
        );
        fetchCounts();
      }
    } catch (err) {
      console.error('Failed to resolve notification:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!API_URL) return;
    
    try {
      // Get current new notifications before marking as read
      const newNotifications = notifications.filter(notif => notif.status === 'new');
      
      const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${data.message}`);
        
        // Update all notifications in the list to read status
        setNotifications(prev => 
          prev.map(notif => 
            notif.status === 'new' 
              ? { ...notif, status: 'read', readAt: new Date().toISOString() }
              : notif
          )
        );
        
        // Set feedback data
        setMarkAllResult({
          message: data.message,
          modifiedCount: data.modifiedCount,
          affectedNotifications: newNotifications
        });
        setShowMarkAllFeedback(true);
        
        fetchCounts(); // Refresh counts
        fetchNotifications(); // Refresh the list
        
        // Auto-hide feedback after 5 seconds
        setTimeout(() => {
          setShowMarkAllFeedback(false);
          setMarkAllResult(null);
        }, 5000);
      } else {
        console.error('Failed to mark all notifications as read');
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'device':
        return <DevicePhoneMobileIcon className="w-4 h-4" />;
      case 'site':
        return <BuildingOfficeIcon className="w-4 h-4" />;
      case 'system':
        return <CogIcon className="w-4 h-4" />;
      case 'security':
        return <ShieldExclamationIcon className="w-4 h-4" />;
      default:
        return <CogIcon className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'read':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString();

  // Format numbers to 3 decimals when numeric
  const formatNumber = (val: unknown) => {
    const num = Number(val as any);
    return Number.isFinite(num) ? num.toFixed(3) : String(val ?? '');
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setCurrentPage(1);
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'new':
        return <AlertIcon className="w-5 h-5" />;
      case 'acknowledged':
        return <CheckIcon className="w-5 h-5" />;
      case 'resolved':
        return <CheckCircleIcon className="w-5 h-5" />;
      default:
        return <BellIcon className="w-5 h-5" />;
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'new':
        return counts.new;
      case 'acknowledged':
        return counts.acknowledged;
      case 'resolved':
        return counts.resolved;
      default:
        return 0;
    }
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'new':
        return 'New Alerts';
      case 'acknowledged':
        return 'Acknowledged';
      case 'resolved':
        return 'Resolved';
      default:
        return t('notifications.title');
    }
  };

  return (
    <DashboardLayout user={user}>
      <div className="p-6 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('notifications.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{t('notifications.allNotifications')}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Mark All as Read</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FunnelIcon className="w-4 h-4" />
                <span>Filters</span>
                {showFilters ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BellIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">New</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts.new}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <EyeIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Read</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts.read}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <CheckIcon className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Acknowledged</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts.acknowledged}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolved</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{counts.resolved}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Types</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Categories</option>
                  <option value="device">Device</option>
                  <option value="site">Site</option>
                  <option value="system">System</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {(['new', 'acknowledged', 'resolved'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {getTabIcon(tab)}
                  <span>{getTabTitle(tab)}</span>
                  {getTabCount(tab) > 0 && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tab === 'new' ? 'bg-red-100 text-red-800' :
                      tab === 'acknowledged' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {getTabCount(tab)}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{getTabTitle(activeTab)}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalNotifications} {activeTab === 'new' ? 'alerts' : 'notifications'} found
            </p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                              <p className="mt-2 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <ExclamationCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchNotifications}
                className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <BellIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 dark:text-gray-400">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => {
                const md = notification.metadata || {};
                const siteName = md.siteName || notification.siteId?.name;
                const deviceName = md.deviceName || notification.deviceId;
                const parameter = md.parameter;
                const unit = md.unit ? ` ${md.unit}` : '';
                const isConsumption = String(parameter || '').toLowerCase() === 'consumption';
                const value = isConsumption
                  ? (md.dailyConsumption ?? md.comparisonValue ?? md.currentValue)
                  : (md.currentValue ?? md.comparisonValue);
                const valueLabel = isConsumption ? 'Daily Consumption' : (parameter ? 'Current Value' : 'Value');
                const formattedValue = value !== undefined ? formatNumber(value) : undefined;
                const threshold = md.threshold;
                const formattedThreshold = threshold !== undefined ? formatNumber(threshold) : undefined;
                const condition = md.condition ? md.condition.toUpperCase() : undefined;
                return (
                  <div
                    key={notification._id}
                    className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      notification.status === 'new' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {notification.title}
                            </h3>
                            {notification.status === 'new' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(notification.status)}`}>
                              {notification.status}
                            </span>
                          </div>
                        </div>
                        
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </p>
                        
                        <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-1" title={formatDateTime(notification.createdAt)}>
                            <ClockIcon className="w-4 h-4" />
                            <span>{formatTime(notification.createdAt)} • {formatDateTime(notification.createdAt)}</span>
                          </div>
                          {notification.category && (
                            <div className="flex items-center space-x-1">
                              {getCategoryIcon(notification.category)}
                              <span className="capitalize">{notification.category}</span>
                            </div>
                          )}
                          {siteName && (
                            <div className="flex items-center space-x-1">
                              <BuildingOfficeIcon className="w-4 h-4" />
                              <span>{siteName}</span>
                            </div>
                          )}
                          {deviceName && (
                            <div className="flex items-center space-x-1">
                              <DevicePhoneMobileIcon className="w-4 h-4" />
                              <span>{deviceName}</span>
                            </div>
                          )}
                        </div>
                        {(parameter || value !== undefined || threshold !== undefined) && (
                          <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                            {parameter && (
                              <span className="font-medium">{isConsumption ? 'Daily Consumption' : parameter}:</span>
                            )} {formattedValue !== undefined ? `${formattedValue}${unit}` : ''}
                            {threshold !== undefined && (
                              <span className="ml-2 text-gray-500 dark:text-gray-400">({condition || ''} {formattedThreshold}{unit})</span>
                            )}
                          </div>
                        )}
                        
                        {/* Action buttons */}
                        <div className="mt-4 flex items-center space-x-2">
                          {notification.status === 'new' && (
                            <button
                              onClick={() => handleMarkAsRead(notification._id)}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                              <EyeIcon className="w-3 h-3 mr-1" />
                              Mark as Read
                            </button>
                          )}
                          {notification.status !== 'acknowledged' && notification.status !== 'resolved' && (
                            <button
                              onClick={() => handleAcknowledge(notification._id)}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/30"
                            >
                              <CheckIcon className="w-3 h-3 mr-1" />
                              Acknowledge
                            </button>
                          )}
                          {notification.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolve(notification._id)}
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md hover:bg-green-200 dark:hover:bg-green-900/30"
                            >
                              <CheckCircleIcon className="w-3 h-3 mr-1" />
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mark All as Read Feedback */}
        {showMarkAllFeedback && markAllResult && (
          <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  {markAllResult.message}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowMarkAllFeedback(false);
                  setMarkAllResult(null);
                }}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            {markAllResult.affectedNotifications.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
                <div className="px-4 py-3 border-b border-green-200 dark:border-green-700">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Affected Notifications ({markAllResult.affectedNotifications.length})
                  </h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-green-50 dark:bg-green-900/20">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300">Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300">Priority</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300">Category</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-700 dark:text-green-300">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-100 dark:divide-green-800">
                      {markAllResult.affectedNotifications.map((notification) => (
                        <tr key={notification._id} className="hover:bg-green-50 dark:hover:bg-green-900/30">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                            <div className="font-medium">{notification.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {notification.message}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              notification.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                              notification.type === 'error' || notification.type === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                              'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                            }`}>
                              {notification.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {notification.category}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatTime(notification.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalNotifications)} of {totalNotifications} notifications
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 