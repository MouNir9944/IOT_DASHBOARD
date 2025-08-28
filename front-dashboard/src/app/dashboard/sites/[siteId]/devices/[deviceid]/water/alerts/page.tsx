'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '../../../../../../../../contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import DashboardLayout from '../../../../../../components/DashboardLayout';
import {
  CloudIcon,
  BellIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

interface WaterDevice {
  id: string;
  deviceid: string;
  name: string;
  type: string;
  status: string;
  parameters?: {
    flowRate?: number;
    pressure?: number;
    temperature?: number;
    consumption?: number;
  };
}

interface AlertConfiguration {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'device' | 'site' | 'system' | 'maintenance' | 'security';
  parameter: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  isActive: boolean;
  createdAt: string;
  periodicity: 'immediate' | 'hourly' | 'daily' | 'weekly';
  emailEnabled: boolean;
  createdBy?: string;
  assignedUsers?: string[];
  schedule?: {
    enabled: boolean;
    daysOfWeek: string[];
    timeSlots: Array<{
      startTime: string;
      endTime: string;
    }>;
  };
}

interface AlertForm {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'device' | 'site' | 'system' | 'maintenance' | 'security';
  parameter: string;
  threshold: number;
  condition: 'above' | 'below' | 'equals';
  periodicity: 'immediate' | 'hourly' | 'daily' | 'weekly';
  emailEnabled: boolean;
  schedule: {
    enabled: boolean;
    daysOfWeek: string[];
    timeSlots: Array<{
      startTime: string;
      endTime: string;
    }>;
  };
}

export default function WaterAlertsPage({ params }: { params: Promise<{ siteId: string; deviceid: string }> }) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const { siteId, deviceid: encodedDeviceId } = use(params);
  
  // Decode the deviceid parameter to handle URL encoding
  const deviceid = decodeURIComponent(encodedDeviceId);
  


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [waterDevices, setWaterDevices] = useState<WaterDevice[]>([]);
  const [alertConfigurations, setAlertConfigurations] = useState<AlertConfiguration[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<WaterDevice | null>(null);
  const [showUserAssignmentModal, setShowUserAssignmentModal] = useState(false);
  const [selectedAlertForAssignment, setSelectedAlertForAssignment] = useState<AlertConfiguration | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalInitialized, setModalInitialized] = useState(false);

  // Helper function to get user ID from different possible field names
  const getUserId = (user: any): string => {
    return user.id || user._id || user.userId || user.user_id || '';
  };
  const [alertForm, setAlertForm] = useState<AlertForm>({
    title: '',
    message: '',
    type: 'warning',
    priority: 'medium',
    category: 'device',
    parameter: 'flowRate',
    threshold: 0,
    condition: 'above',
    periodicity: 'immediate',
    emailEnabled: true,
    schedule: {
      enabled: false,
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      timeSlots: [{ startTime: '00:00', endTime: '23:59' }],
    },
  });

  const waterParameters = [
    { value: 'flowRate', label: 'Flow Rate', unit: 'L/s', icon: CloudIcon },
    { value: 'pressure', label: 'Pressure', unit: 'bar', icon: ExclamationTriangleIcon },
    { value: 'temperature', label: 'Temperature', unit: '°C', icon: InformationCircleIcon },
    { value: 'consumption', label: 'Consumption', unit: 'm³', icon: CloudIcon }
  ];

  // Helper function to format schedule display
  const formatScheduleDisplay = (schedule: AlertConfiguration['schedule']) => {
    if (!schedule || !schedule.enabled) return 'Always Active';
    
    const days = schedule.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ');
    const times = schedule.timeSlots.map(slot => `${slot.startTime}-${slot.endTime}`).join(', ');
    
    return `${days} | ${times}`;
  };

  useEffect(() => {
    if (siteId && deviceid && session?.accessToken) {
      setLoading(true);
      setError('');
      fetchWaterDevices();
      fetchAlertConfigurations();
    } else if (!session?.accessToken) {
      // Don't set error here, just wait for session
    } else {
      setError('Missing site or device information');
      setLoading(false);
    }
  }, [siteId, deviceid, session?.accessToken]);

  // Reset selected users when modal closes
  useEffect(() => {
    if (!showUserAssignmentModal) {
      setSelectedUsers([]);
      setModalInitialized(false);
    }
  }, [showUserAssignmentModal]);

  const fetchWaterDevices = async () => {
    if (!siteId || !session?.accessToken) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/devices`, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch devices: ${response.status} ${errorText}`);
      }

      const devices = await response.json();
      const waterDevices = devices.filter((device: any) => device.type === 'water');
      
      setWaterDevices(waterDevices);
      
      // Find the current device - check both deviceid and id fields, and also try encoded version
      const currentDevice = waterDevices.find((device: WaterDevice) => {
        return device.deviceid === deviceid || 
               device.id === deviceid || 
               device.deviceid === encodedDeviceId || 
               device.id === encodedDeviceId;
      });
      
      setSelectedDevice(currentDevice || null);
      
      // If no device found, set error
      if (!currentDevice) {
        const availableDevices = waterDevices.map((d: any) => `${d.deviceid || d.id} (${d.name})`).join(', ');
      }
    } catch (error) {
      console.error('Error fetching water devices:', error);
    }
  };

  const fetchAlertConfigurations = async () => {
    if (!deviceid || !session?.accessToken) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/${deviceid}/alerts`, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch alert configurations: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // For superadmin, show all alerts. For other users, show only their own alerts
      let filteredAlerts;
      if (session?.user?.role === 'superadmin') {
        filteredAlerts = data.alertConfigurations || data || [];
      } else {
        filteredAlerts = (data.alertConfigurations || data || []).filter((alert: AlertConfiguration) => 
          alert.createdBy === session?.user?.email || !alert.createdBy
        );
      }
      
      setAlertConfigurations(filteredAlerts);
    } catch (error) {
      console.error('Error fetching alert configurations:', error);
      setError(`Failed to fetch alert configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate schedule configuration
    if (alertForm.schedule.enabled) {
      if (alertForm.schedule.daysOfWeek.length === 0) {
        setError('Please select at least one day of the week for the schedule');
        setLoading(false);
        return;
      }
      
      if (alertForm.schedule.timeSlots.length === 0) {
        setError('Please add at least one time slot for the schedule');
        setLoading(false);
        return;
      }
      
      // Validate time slots
      for (const slot of alertForm.schedule.timeSlots) {
        if (!slot.startTime || !slot.endTime) {
          setError('Please ensure all time slots have valid start and end times');
          setLoading(false);
          return;
        }
      }
    }

    try {
      // Ensure the current user is automatically assigned to the alert
      const currentUserEmail = session?.user?.email;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/${deviceid}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          title: alertForm.title,
          message: alertForm.message,
          type: alertForm.type,
          priority: alertForm.priority,
          category: alertForm.category,
          parameter: alertForm.parameter,
          threshold: alertForm.threshold,
          condition: alertForm.condition,
          periodicity: alertForm.periodicity,
          emailEnabled: alertForm.emailEnabled,
          createdBy: currentUserEmail,
          // Explicitly include the creator in assignedUsers to ensure they are assigned
          assignedUsers: currentUserEmail ? [currentUserEmail] : [],
          schedule: alertForm.schedule
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create alert configuration');
      }

      const scheduleInfo = alertForm.schedule.enabled 
        ? ` Schedule: ${formatScheduleDisplay(alertForm.schedule)}`
        : '';

      setSuccess(`Water alert configuration saved successfully! You have been automatically assigned to this alert.${scheduleInfo}`);
      setAlertForm({
        title: '',
        message: '',
        type: 'warning',
        priority: 'medium',
        category: 'device',
        parameter: 'flowRate',
        threshold: 0,
        condition: 'above',
        periodicity: 'immediate',
        emailEnabled: true,
        schedule: {
          enabled: false,
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          timeSlots: [{ startTime: '00:00', endTime: '23:59' }],
        },
      });
      
      // Refresh alert configurations
      await fetchAlertConfigurations();
    } catch (error) {
      console.error('Error creating alert configuration:', error);
      setError('Failed to create alert configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert configuration?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/${deviceid}/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete alert configuration');
      }

      setSuccess('Alert configuration deleted successfully!');
      await fetchAlertConfigurations();
    } catch (error) {
      console.error('Error deleting alert configuration:', error);
      setError('Failed to delete alert configuration');
    }
  };

  const handleToggleAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/${deviceid}/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle alert configuration');
      }

      setSuccess('Alert configuration status updated!');
      await fetchAlertConfigurations();
    } catch (error) {
      console.error('Error toggling alert configuration:', error);
      setError('Failed to toggle alert configuration');
    }
  };

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      // Build URL with required query parameters
      let url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users?role=${session?.user?.role || 'user'}`;
      
      // Add createdBy parameter for admin users
      if (session?.user?.role === 'admin' && session?.user?.id) {
        url += `&createdBy=${session.user.id}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const users = await response.json();
      
      if (Array.isArray(users)) {
        // Map users to ensure they have the correct structure
        const mappedUsers = users.map((user: any) => ({
          id: getUserId(user),
          name: user.name || user.username || user.fullName || '',
          email: user.email || user.emailAddress || ''
        }));
        setAvailableUsers(mappedUsers);
      } else {
        console.error('Users response is not an array:', users);
        setAvailableUsers([]);
        setError('Invalid users response format');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenUserAssignment = async (alert: AlertConfiguration) => {
    setSelectedAlertForAssignment(alert);
    setLoadingUsers(true);
    
    // Fetch users first, then open modal
    await fetchAvailableUsers();
    
    // Ensure the alert creator is in the available users list
    let updatedAvailableUsers = [...availableUsers];
    if (alert.createdBy && !availableUsers.find(user => user.email === alert.createdBy)) {
      // Add the creator to the available users list if not already present
      updatedAvailableUsers.push({
        id: `creator_${alert.createdBy}`,
        name: alert.createdBy.split('@')[0], // Use email prefix as name
        email: alert.createdBy
      });
      setAvailableUsers(updatedAvailableUsers);
    }
    
    // Pre-select users who are already assigned to this alert
    if (alert.assignedUsers && alert.assignedUsers.length > 0) {
      const assignedUserIds = updatedAvailableUsers
        .filter(user => alert.assignedUsers?.includes(user.email))
        .map(user => user.id);
      setSelectedUsers(assignedUserIds);
    } else {
      setSelectedUsers([]);
    }
    
    setShowUserAssignmentModal(true);
  };

  const handleAssignUsers = async () => {
    if (!selectedAlertForAssignment) return;

    try {
      // Convert selected user IDs to actual user emails or IDs
      const userIdsToSend = selectedUsers.map(userId => {
        // If it's a creator ID, extract the email
        if (userId.startsWith('creator_')) {
          return userId.replace('creator_', '');
        }
        // If it's a regular user ID, find the corresponding user
        const user = availableUsers.find(u => u.id === userId);
        return user ? user.email : userId;
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/${deviceid}/alerts/${selectedAlertForAssignment.id}/assign-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          userIds: userIdsToSend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign users to alert');
      }

      setSuccess('Users assigned to alert successfully!');
      handleCloseUserAssignmentModal();
      await fetchAlertConfigurations();
    } catch (error) {
      console.error('Error assigning users to alert:', error);
      setError('Failed to assign users to alert');
    }
  };

  const handleCloseUserAssignmentModal = () => {
    setShowUserAssignmentModal(false);
    setSelectedAlertForAssignment(null);
    // The useEffect will handle resetting selectedUsers and modalInitialized
  };

  const getParameterIcon = (parameter: string) => {
    const param = waterParameters.find(p => p.value === parameter);
    return param?.icon || CloudIcon;
  };

  const getAlertTypeColor = (type: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      critical: 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || colors.info;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

    // Show loading state while waiting for params or session
    if (!siteId || !deviceid || !session?.accessToken || (loading && alertConfigurations.length === 0)) {
      return (
        <DashboardLayout user={session?.user || {}}>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {!siteId || !deviceid 
                  ? 'Loading device information...' 
                  : !session?.accessToken 
                    ? 'Loading session...' 
                    : 'Loading alert configurations...'
                }
              </p>
              {!siteId || !deviceid ? (
                <p className="mt-2 text-sm text-gray-500">
                  Site ID: {siteId || 'Loading...'} | Device ID: {deviceid || 'Loading...'}
                </p>
              ) : null}
            </div>
          </div>
        </DashboardLayout>
      );
    }

  return (
    <DashboardLayout user={session?.user || {}}>
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Water Devices
          </button>
          <div className="flex items-center gap-2">
            <BellIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Water Alert Management</h1>
          </div>
        </div>

        {selectedDevice && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">Current Device</h2>
            <div className="flex items-center gap-3">
              <CloudIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDevice.name}</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">({selectedDevice.deviceid})</span>
              <span className={`ml-auto px-2 py-1 rounded-full text-xs ${
                selectedDevice.status === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
              }`}>
                {selectedDevice.status}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Alert Creation Form */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-400">{t('alerts.createAlert')}</h2>
            <form onSubmit={handleAlertSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('alerts.title')}</label>
                <input
                  type="text"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({...alertForm, title: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., High Flow Rate Alert"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('alerts.message')}</label>
                <textarea
                  value={alertForm.message}
                  onChange={(e) => setAlertForm({...alertForm, message: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Describe the alert details..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('alerts.type')}</label>
                  <select
                    value={alertForm.type}
                    onChange={(e) => setAlertForm({...alertForm, type: e.target.value as any})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="info">{t('alerts.info')}</option>
                    <option value="success">{t('alerts.success')}</option>
                    <option value="warning">{t('alerts.warning')}</option>
                    <option value="error">{t('alerts.error')}</option>
                    <option value="critical">{t('alerts.critical')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('alerts.priority')}</label>
                  <select
                    value={alertForm.priority}
                    onChange={(e) => setAlertForm({...alertForm, priority: e.target.value as any})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="low">{t('alerts.priorityLow')}</option>
                    <option value="medium">{t('alerts.priorityMedium')}</option>
                    <option value="high">{t('alerts.priorityHigh')}</option>
                    <option value="critical">{t('alerts.priorityCritical')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">Water Parameter</label>
                <select
                  value={alertForm.parameter}
                  onChange={(e) => setAlertForm({...alertForm, parameter: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  {waterParameters.map((param) => {
                    const IconComponent = param.icon;
                    return (
                      <option key={param.value} value={param.value}>
                        {param.label} ({param.unit})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('common.threshold')} {t('common.value')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alertForm.threshold}
                    onChange={(e) => setAlertForm({...alertForm, threshold: parseFloat(e.target.value)})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('common.condition')}</label>
                  <select
                    value={alertForm.condition}
                    onChange={(e) => setAlertForm({...alertForm, condition: e.target.value as any})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                    <option value="equals">Equals</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">Email Notifications</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alertForm.emailEnabled}
                      onChange={(e) => setAlertForm({...alertForm, emailEnabled: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Send email notifications</span>
                  </div>
                </div>
                
                <div>
                  <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">Alert Frequency</label>
                  <select
                    value={alertForm.periodicity}
                    onChange={(e) => setAlertForm({...alertForm, periodicity: e.target.value as any})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="immediate">Immediate</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {/* Schedule Configuration */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={alertForm.schedule.enabled}
                    onChange={(e) => setAlertForm({
                      ...alertForm, 
                      schedule: {...alertForm.schedule, enabled: e.target.checked}
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="block font-semibold text-gray-900 dark:text-gray-100">Enable Schedule Restrictions</label>
                  {alertForm.schedule.enabled && (
                    <span className="ml-2 px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                      Scheduled
                    </span>
                  )}
                </div>
                
                {!alertForm.schedule.enabled && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 pl-6">
                    When disabled, alerts will be active 24/7. Enable to restrict alerts to specific days and times.
                  </p>
                )}
                
                {alertForm.schedule.enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                    {/* Schedule Summary */}
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                      <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">Current Schedule:</h4>
                      <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                        <p><strong>Days:</strong> {alertForm.schedule.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ')}</p>
                        <p><strong>Times:</strong> {alertForm.schedule.timeSlots.map(slot => `${slot.startTime} - ${slot.endTime}`).join(', ')}</p>
        
                      </div>
                    </div>
                    
                    {/* Days of Week */}
                    <div>
                      <label className="block font-semibold mb-2 text-gray-900 dark:text-gray-100">Active Days</label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Select the days when this alert should be active:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                          <label key={day} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={alertForm.schedule.daysOfWeek.includes(day)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAlertForm({
                                    ...alertForm,
                                    schedule: {
                                      ...alertForm.schedule,
                                      daysOfWeek: [...alertForm.schedule.daysOfWeek, day]
                                    }
                                  });
                                } else {
                                  setAlertForm({
                                    ...alertForm,
                                    schedule: {
                                      ...alertForm.schedule,
                                      daysOfWeek: alertForm.schedule.daysOfWeek.filter(d => d !== day)
                                    }
                                  });
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm capitalize text-gray-900 dark:text-gray-100">{day}</span>
                          </label>
                        ))}
                      </div>
                      {alertForm.schedule.daysOfWeek.length === 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please select at least one day</p>
                      )}
                    </div>

                    {/* Time Slots */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block font-semibold text-gray-900 dark:text-gray-100">Active Time Slots</label>
                        <button
                          type="button"
                          onClick={() => setAlertForm({
                            ...alertForm,
                            schedule: {
                              ...alertForm.schedule,
                              timeSlots: [...alertForm.schedule.timeSlots, { startTime: '09:00', endTime: '17:00' }]
                            }
                          })}
                          className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-700"
                        >
                          + Add Time Slot
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Define when during the day this alert should be active:</p>
                      
                      <div className="space-y-2">
                        {alertForm.schedule.timeSlots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => {
                                const newTimeSlots = [...alertForm.schedule.timeSlots];
                                newTimeSlots[index].startTime = e.target.value;
                                setAlertForm({
                                  ...alertForm,
                                  schedule: { ...alertForm.schedule, timeSlots: newTimeSlots }
                                });
                              }}
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => {
                                const newTimeSlots = [...alertForm.schedule.timeSlots];
                                newTimeSlots[index].endTime = e.target.value;
                                setAlertForm({
                                  ...alertForm,
                                  schedule: { ...alertForm.schedule, timeSlots: newTimeSlots }
                                });
                              }}
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                            {alertForm.schedule.timeSlots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newTimeSlots = alertForm.schedule.timeSlots.filter((_, i) => i !== index);
                                  setAlertForm({
                                    ...alertForm,
                                    schedule: { ...alertForm.schedule, timeSlots: newTimeSlots }
                                  });
                                }}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {alertForm.schedule.timeSlots.length === 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please add at least one time slot</p>
                      )}
                    </div>


                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 dark:bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving Alert...' : 'Save Alert Configuration'}
              </button>
            </form>
          </div>

          {/* Existing Alert Configurations */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-400">
              {session?.user?.role === 'superadmin' ? 'All Alert Configurations' : 'Your Alert Configurations'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {session?.user?.role === 'superadmin' 
                ? 'Showing all alerts for this device' 
                : 'Showing alerts created by you'
              }
            </p>
            
            {alertConfigurations.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <BellIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-500" />
                <p>No alert configurations found</p>
                <p className="text-sm">Create your first alert configuration using the form</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertConfigurations.map((alert) => {
                  const IconComponent = getParameterIcon(alert.parameter);
                  const selectedParameter = waterParameters.find(p => p.value === alert.parameter);
                  
                  return (
                    <div key={alert.id} className={`border rounded-lg p-4 ${alert.isActive ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{alert.title}</h3>
                          {/* Schedule Status Indicator */}
                          {alert.schedule && alert.schedule.enabled && (
                            <span className="px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 flex items-center gap-1">
                              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                              Scheduled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${getAlertTypeColor(alert.type)}`}>
                            {alert.type}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(alert.priority)}`}>
                            {alert.priority}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{alert.message}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span>Parameter: {selectedParameter?.label}</span>
                        <span>Threshold: {alert.threshold} {selectedParameter?.unit}</span>
                        <span>Condition: {alert.condition}</span>
                        {alert.createdBy && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Created by: {alert.createdBy}</span>
                        )}
                      </div>
                      
                      {/* Assigned Users */}
                      {alert.assignedUsers && alert.assignedUsers.length > 0 && (
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Assigned Users:</h4>
                          <div className="flex flex-wrap gap-1">
                            {alert.assignedUsers.map((userEmail, index) => (
                              <span key={`${alert.id}-${userEmail}-${index}`} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                {userEmail}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Alert Settings */}
                      <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Alert Settings:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${alert.emailEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-500'}`}></span>
                            <span>Email: {alert.emailEnabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>Frequency: {alert.periodicity}</span>
                          </div>
                        </div>
                        
                        {/* Schedule Information */}
                        {alert.schedule && alert.schedule.enabled && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Schedule:</h5>
                            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span>Days: {alert.schedule.daysOfWeek.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span>Time: {alert.schedule.timeSlots.map(slot => `${slot.startTime}-${slot.endTime}`).join(', ')}</span>
                              </div>
                              
                            </div>
                          </div>
                        )}
                      </div>
                      
                                              <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleAlert(alert.id)}
                              className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors ${
                                alert.isActive 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' 
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {alert.isActive ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                              {alert.isActive ? 'Active' : 'Inactive'}
                            </button>
                            <button
                              onClick={() => handleOpenUserAssignment(alert)}
                              className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-700"
                            >
                              <PencilIcon className="w-4 h-4" />
                              Assign Users
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteAlert(alert.id)}
                              className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>



        {/* Parameter Information */}
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-400">Water Parameters Reference</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waterParameters.map((param) => {
              const IconComponent = param.icon;
              const isSelected = alertForm.parameter === param.value;
              
              return (
                <div
                  key={param.value}
                  className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    isSelected 
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  onClick={() => setAlertForm({...alertForm, parameter: param.value})}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`w-6 h-6 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    <div className="flex-1">
                      <h3 className={`font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {param.label}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Unit: {param.unit}</p>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Information */}
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-purple-700 dark:text-purple-400">Schedule Configuration Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-300">Days of the Week</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Select which days of the week your alerts should be active. This is useful for:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Business hours only (Monday-Friday)</li>
                <li>• Weekend monitoring (Saturday-Sunday)</li>
                <li>• Specific operational days</li>
                <li>• Maintenance windows</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3 text-purple-600 dark:text-purple-300">Time Slots</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Define specific time periods when alerts should be active. You can create multiple time slots:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Business hours (9:00 AM - 5:00 PM)</li>
                <li>• Night shift (10:00 PM - 6:00 AM)</li>
                <li>• Peak usage times</li>
                <li>• Maintenance periods</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">💡 Pro Tips:</h4>
            <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              
              <p>• <strong>Multiple slots:</strong> Create overlapping or separate time periods as needed</p>
              <p>• <strong>Midnight crossing:</strong> Time slots can span midnight (e.g., 10:00 PM to 6:00 AM)</p>
              <p>• <strong>Always active:</strong> Leave scheduling disabled for 24/7 monitoring</p>
            </div>
          </div>
        </div>

        {/* User Assignment Modal */}
        {showUserAssignmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Assign Users to Alert
                  </h3>
                  {selectedAlertForAssignment && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedAlertForAssignment.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCloseUserAssignmentModal}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              {selectedAlertForAssignment && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getAlertTypeColor(selectedAlertForAssignment.type)}`}>
                      {selectedAlertForAssignment.type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(selectedAlertForAssignment.priority)}`}>
                      {selectedAlertForAssignment.priority}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {selectedAlertForAssignment.message}
                  </p>
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Parameter: {selectedAlertForAssignment.parameter} | 
                    Threshold: {selectedAlertForAssignment.threshold} | 
                    Condition: {selectedAlertForAssignment.condition}
                  </div>
                </div>
              )}

              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading users...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Select Users to Assign:
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUsers(availableUsers.map(user => user.id))}
                          className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedUsers([])}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                      {availableUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                          No users available for assignment
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {availableUsers.map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers([...selectedUsers, user.id]);
                                  } else {
                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Current Assignment Info */}
                    {selectedAlertForAssignment?.assignedUsers && selectedAlertForAssignment.assignedUsers.length > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Currently Assigned:</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedAlertForAssignment.assignedUsers.map((userEmail, index) => (
                            <span key={`current-${userEmail}-${index}`} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              {userEmail}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleCloseUserAssignmentModal}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignUsers}
                      disabled={selectedUsers.length === 0}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
} 