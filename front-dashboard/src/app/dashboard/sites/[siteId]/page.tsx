'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TextField from '@mui/material/TextField';
import { BarChart } from '@mui/x-charts/BarChart';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';

// NOTE: This page intentionally excludes pressure and temperature devices
// Only energy, solar, water, and gas devices are displayed
// Pressure and temperature data can be accessed from individual device pages

export default function SiteDetailPage() {
  const params = useParams();
  const { t } = useLanguage();
  const siteId = params?.siteId as string;
  
  const timePeriods = [
    { label: '7d', value: '7d', granularity: 'day' },
    { label: '30d', value: '30d', granularity: 'day' },
    { label: t('common.custom'), value: 'custom', granularity: 'day' }
  ];
  
  const [site, setSite] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceModalMode, setDeviceModalMode] = useState<'create' | 'edit'>('create');
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    deviceId: '',
    type: 'energy',
    name: '',
    description: '',
    status: 'active'
  });
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Period selection state
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Chart and stats data
  const [energyData, setEnergyData] = useState<number[]>([]);
  const [solarData, setSolarData] = useState<number[]>([]);
  const [waterData, setWaterData] = useState<number[]>([]);
  const [gasData, setGasData] = useState<number[]>([]);
  const [energyLabels, setEnergyLabels] = useState<string[]>([]);
  const [solarLabels, setSolarLabels] = useState<string[]>([]);
  const [waterLabels, setWaterLabels] = useState<string[]>([]);
  const [gasLabels, setGasLabels] = useState<string[]>([]);
  const [energyIndex, setEnergyIndex] = useState<number | null>(null);
  const [solarIndex, setSolarIndex] = useState<number | null>(null);
  const [waterIndex, setWaterIndex] = useState<number | null>(null);
  const [gasIndex, setGasIndex] = useState<number | null>(null);

  // Helper to format values
  function formatValue(type: string, value: number) {
    switch (type) {
      case 'energy':
      case 'solar':
        return value.toFixed(1) + ' kWh';
      case 'water':
        return value.toFixed(3) + ' m³';
      case 'gas':
        return value.toFixed(1) + ' m³';
      default:
        return value.toString();
    }
  }
  // Helper to calculate percent change
  function calcChange(data: number[]) {
    if (!data || data.length < 2) return { change: 'N/A', changeType: 'increase' };
    const prev = data[data.length - 2];
    const curr = data[data.length - 1];
    if (prev === 0) return { change: 'N/A', changeType: 'increase' };
    const percent = ((curr - prev) / Math.abs(prev)) * 100;
    return {
      change: (percent >= 0 ? '+' : '') + percent.toFixed(1) + '%',
      changeType: percent >= 0 ? 'increase' : 'decrease',
    };
  }

  // Calculate statistics for chart analytics
  const calculateStats = (data: number[], type: string) => {
    if (!data || data.length === 0) return null;
    
    // Filter out zero values to get actual data points
    const nonZeroData = data.filter(val => val > 0);
    if (nonZeroData.length === 0) return null;
    
    const totalConsumption = nonZeroData.reduce((sum, val) => sum + val, 0);
    const averagePerDay = nonZeroData.length > 0 ? totalConsumption / nonZeroData.length : 0;
    const peakConsumption = Math.max(...nonZeroData);
    const dataPoints = nonZeroData.length;
    
    return {
      totalConsumption: formatValue(type, totalConsumption),
      averagePerDay: formatValue(type, averagePerDay),
      peakConsumption: formatValue(type, peakConsumption),
      dataPoints
    };
  };

  // CSV Export function for individual charts
  const exportChartToCSV = (chartType: string, data: number[], labels: string[]) => {
    const { from, to } = getDateRange();
    const granularity = getGranularity();
    const startDate = new Date(from);
    
    console.log('🔍 Site export debug - Date range:', { from, to, startDate: startDate.toISOString(), granularity });
    
    // Prepare CSV data
    const csvData = [];
    
    // Add header based on chart type
    let header = ['Date'];
    let unit = '';
    switch (chartType) {
      case 'energy':
        header.push('Energy (kWh)');
        unit = 'kWh';
        break;
      case 'solar':
        header.push('Solar Production (kWh)');
        unit = 'kWh';
        break;
      case 'water':
        header.push('Water Usage (m³)');
        unit = 'm³';
        break;
      case 'gas':
        header.push('Gas Usage (m³)');
        unit = 'm³';
        break;
    }
    csvData.push(header);
    
    // Add data rows (include all days, even with zero values)
    for (let i = 0; i < labels.length; i++) {
      const value = data[i] || 0;
      
      // Reconstruct the actual date by calculating from start date and index
      let actualDate = new Date(startDate);
      
      // Calculate the actual date based on granularity and index
      switch (granularity) {
        case 'day':
          actualDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
          break;
        case 'week':
          actualDate = new Date(startDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          actualDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
          break;
        default:
          actualDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      }
      
      csvData.push([
        actualDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'UTC'
        }),
        value.toFixed(3)
      ]);
    }
    
    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${site.name}_${chartType}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get date range based on selected period (using UTC time)
  const getDateRange = (): { from: string; to: string } => {
    const now = new Date();
    
    // Use UTC time for consistent boundaries
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const to = utcNow.toISOString();
    let from: string;

    switch (selectedPeriod) {
      case '7d':
        // Calculate exactly 7 days ago in UTC
        const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));
        from = sevenDaysAgo.toISOString();
        break;
      case '30d':
        // Calculate exactly 30 days ago in UTC
        const thirtyDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0));
        from = thirtyDaysAgo.toISOString();
        break;
      case 'custom':
        if (customFrom && customTo) {
          return { from: customFrom.toISOString(), to: customTo.toISOString() };
        }
        // Fallback to 7d if custom dates not set
        const fallbackDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));
        from = fallbackDate.toISOString();
        break;
      default:
        const defaultDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0));
        from = defaultDate.toISOString();
    }

    return { from, to };
  };

  // Get granularity
  const getGranularity = () => {
    const period = timePeriods.find(p => p.value === selectedPeriod);
    return period?.granularity || 'day';
  };

  // Helper to generate a list of periods (labels) between two dates (matching dashboard approach)
  function generatePeriodLabels(from: string, to: string, granularity: string) {
    const start = new Date(from);
    const end = new Date(to);
    const labels: string[] = [];
    
    // For daily granularity, ensure we get exactly the right number of days
    if (granularity === 'day') {
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        labels.push(date.toISOString().slice(0, 10));
      }
    } else if (granularity === 'month') {
      let current = new Date(start);
      while (current <= end) {
        labels.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
      }
    } else if (granularity === 'year') {
      let current = new Date(start);
      while (current <= end) {
        labels.push(current.getFullYear().toString());
        current.setFullYear(current.getFullYear() + 1);
      }
    } else {
      // Default to daily
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        labels.push(date.toISOString().slice(0, 10));
      }
    }
    
    return labels;
  }

  // Fetch site info
  useEffect(() => {
    fetch(`${API_URL}`)
      .then(res => res.json())
      .then(data => setSites(data))
      .catch(() => setSites([]));
  }, []);

  // Fetch site data
  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetch(`${API_URL}/${siteId}`)
      .then(res => {
        if (!res.ok) throw new Error('Site not found');
        return res.json();
      })
      .then(data => {
        setSite(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Site not found');
        setLoading(false);
      });
  }, [siteId]);

  // Helper function to refresh site devices
  const refreshSiteDevices = async () => {
    try {
      const siteRes = await fetch(`${API_URL}/${siteId}`);
      const siteData = await siteRes.json();
      setSite(siteData);
    } catch (error) {
      console.error('Failed to refresh site data:', error);
    }
  };

  // Fetch stats and chart data
  useEffect(() => {
    if (!siteId) return;
    const { from, to } = getDateRange();
    const granularity = getGranularity();
    const periodLabels = generatePeriodLabels(from, to, granularity);
    // Helper to fetch stats
    const fetchStats = async (type: string, setData: any, setLabels: any) => {
      const qs = new URLSearchParams({ from, to, granularity }).toString();
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/${type}/stats?${qs}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) { setData(Array(periodLabels.length).fill(0)); setLabels(periodLabels); return; }
      const data = await res.json();
      console.log(`[fetchStats] type: ${type}, raw response:`, data);
      const filled = Array.isArray(data)
        ? data
        : data.values || [];
      console.log(`[fetchStats] type: ${type}, filled:`, filled);
      // Map period to value using dashboard approach for consistency
      const valueMap = new Map();
      filled.forEach((v: any) => {
        const period = v.period;
        const value = v.totalIndex ?? v.total ?? v.value ?? 0;
        valueMap.set(period, value);
      });
      
      // Use the exact same fillMissingPeriods logic as dashboard for consistency
      const fillMissingPeriods = (data: any[], fromDate: string, toDate: string, granularity: string) => {
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        const periods: { [key: string]: number } = {};
        const labels: string[] = [];
        
        // Initialize all periods with zero
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          let periodKey: string;
          let label: string;
          
          switch (granularity) {
            case 'day':
              // Use consistent date format that matches backend expectations
              periodKey = currentDate.toISOString().slice(0, 10);
              label = currentDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'week':
              // Get ISO week
              const year = currentDate.getFullYear();
              const week = Math.ceil((currentDate.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
              periodKey = `${year}-W${week.toString().padStart(2, '0')}`;
              label = `Week ${week}`;
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'month':
              periodKey = currentDate.toISOString().slice(0, 7) + '-01T00:00:00.000Z';
              label = currentDate.toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
              });
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            default:
              periodKey = currentDate.toISOString().slice(0, 10);
              label = currentDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
              currentDate.setDate(currentDate.getDate() + 1);
          }
          
          periods[periodKey] = 0;
          labels.push(label);
        }
        
        // Fill in actual data - handle both period and date formats from backend
        data.forEach(item => {
          let key = item.period;
          
          // If the backend returns a date instead of period, convert it to our period format
          if (item.date) {
            const itemDate = new Date(item.date);
            key = itemDate.toISOString().slice(0, 10);
          }
          
          // Also handle cases where the backend might return the period in a different format
          if (periods.hasOwnProperty(key)) {
            periods[key] = item.totalIndex || item.total || item.value || 0;
          }
        });
        
        // Convert to sorted array
        const sortedEntries = Object.entries(periods)
          .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
        
        const result = {
          values: sortedEntries.map(([_, total]) => total),
          labels: labels
        };
        
        return result;
      };
      
      // Apply the same fillMissingPeriods logic as dashboard
      const filledData = fillMissingPeriods(filled, from, to, granularity);
      
      setData(filledData.values);
      setLabels(filledData.labels);
    };
    fetchStats('energy', setEnergyData, setEnergyLabels);
    fetchStats('solar', setSolarData, setSolarLabels);
    fetchStats('water', setWaterData, setWaterLabels);
    fetchStats('gas', setGasData, setGasLabels);
    // Fetch index values
    const fetchIndex = async (type: string, setter: any) => {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/${type}/index`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) { setter(null); return; }
      const data = await res.json();
      console.log(`[fetchIndex] type: ${type}, response:`, data);
      setter(data.totalIndex ?? data.value ?? data);
    };
    fetchIndex('energy', setEnergyIndex);
    fetchIndex('solar', setSolarIndex);
    fetchIndex('water', setWaterIndex);
    fetchIndex('gas', setGasIndex);
  }, [siteId, selectedPeriod, customFrom, customTo]);

  if (loading) return <div className="p-8 text-gray-600 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="p-8 text-red-600 dark:text-red-400">{error}</div>;
  if (!site) return null;

  // Prepare user object for DashboardLayout
  const user = {
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    role: session?.user?.role || '',
  };
  const canConfigure = user.role === 'superadmin' || user.role === 'admin' || user.role === 'technicien';

  // Helper function to check if data has meaningful values (non-zero)
  const hasData = (data: number[]) => {
    return data.length > 0 && data.some(value => value > 0);
  };

  // Filter to exclude pressure and temperature devices - only show energy, solar, water, gas
  const allowedDeviceTypes = ['energy', 'solar', 'water', 'gas'];
  const filteredDevices = site.devices?.filter((device: any) => 
    allowedDeviceTypes.includes(device.type)
  ) || [];

  // Compute stats
  const energyChange = calcChange(energyData);
  const solarChange = calcChange(solarData);
  const waterChange = calcChange(waterData);
  const gasChange = calcChange(gasData);

  // Time period selector component
  const TimePeriodSelector = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.period')}:</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {timePeriods.map((period) => (
              <button
                key={period.value}
                onClick={() => {
                  setSelectedPeriod(period.value);
                  setShowCustomPicker(period.value === 'custom');
                }}
                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => router.push(`/dashboard/sites/${siteId}/analytics`)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors w-full sm:w-auto"
          >
            {t('sites.siteAnalytics')}
          </button>
        </div>
        {showCustomPicker && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <DateTimePicker
                label={t('common.from')}
                value={customFrom}
                onChange={setCustomFrom}
                slotProps={{ textField: { size: 'small' } }}
                className="w-full sm:w-40"
              />
              <span className="text-gray-500 dark:text-gray-400 text-center sm:hidden">{t('common.to')}</span>
              <DateTimePicker
                label={t('common.to')}
                value={customTo}
                onChange={setCustomTo}
                slotProps={{ textField: { size: 'small' } }}
                className="w-full sm:w-40"
              />
            </div>
          </LocalizationProvider>
        )}
      </div>
    </div>
  );

  // Device management functions
  const openCreateDeviceModal = () => {
    setDeviceModalMode('create');
    setEditingDevice(null);
    setDeviceForm({
      deviceId: '',
      type: 'energy',
      name: '',
      description: '',
      status: 'active'
    });
    setIsDeviceModalOpen(true);
  };

  const openEditDeviceModal = (device: any) => {
    setDeviceModalMode('edit');
    setEditingDevice(device);
    setDeviceForm({
      deviceId: device.deviceId,
      type: device.type,
      name: device.name,
        description: device.description || '',
      status: device.status
    });
    setIsDeviceModalOpen(true);
  };

  const handleDeviceSubmit = async (e: React.FormEvent) => {  
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        deviceId: deviceForm.deviceId,
        type: deviceForm.type,
        name: deviceForm.name,
        description: deviceForm.description,
        status: deviceForm.status
      };

      let res: Response, data: any;
      if (deviceModalMode === 'edit' && editingDevice) {
        // Update device using new device route
        res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/site/${siteId}/${editingDevice.deviceId}`, {   
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update device');
        // Refresh the site data to get updated devices
        await refreshSiteDevices();
      } else {
        // Create device using new device route
        res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/site/${siteId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create device');
        // Refresh the site data to get updated devices
        await refreshSiteDevices();
      }
      setIsDeviceModalOpen(false);
      setEditingDevice(null);
      setDeviceForm({
        deviceId: '', 
        type: 'energy',
        name: '',
        description: '',
        status: 'active'
      });
    } catch (err: any) {
      if (err.message === 'Device ID already exists in another site') {
        alert('A device with this ID already exists in another site. Please use a unique device ID.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
      if (!confirm('Are you sure you want to delete this device?')) return;
    setLoading(true);
    setError('');
    try {
      // Delete device using new device route
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/site/${siteId}/${deviceId}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete device');
      // Refresh the site data to get updated devices
      await refreshSiteDevices();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout user={user}>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">

        {/* Site Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{site.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              {/*
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Location Information</h4>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  Latitude: {site.location?.latitude !== undefined ? site.location.latitude.toFixed(6) : 'N/A'},&nbsp;
                  </div>
                  <div>
                  Longitude: {site.location?.longitude !== undefined ? site.location.longitude.toFixed(6) : 'N/A'}
                </div>
                {site.address && <div>Address: {site.address}</div>}
              </div>
              */}
            </div>
            <div>
              {/*
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Site Information</h4>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div>Type: {site.type}</div>
                <div>Status: {site.status || 'Active'}</div>
                <div>Devices: {filteredDevices.length || 0} (excluding pressure/temperature)</div> 
              </div>
              */}
            </div>
          </div>
        </div>
        {/* Time Period Selector */}
        {user.role !== 'technicien' && <TimePeriodSelector />}
        {/* Stats Cards */}
        {user.role !== 'technicien' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {/* Energy Stats - Only show if it has data */}
            {hasData(energyData) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-lg bg-blue-500">
                    <BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{t('parameters.energy')} {t('parameters.consumption')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatValue('energy', energyIndex !== null ? energyIndex : energyData.reduce((a, b) => a + b, 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex items-center">
                  {energyChange.changeType === 'increase' ? (
                    <ArrowTrendingUpIcon className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                  )}
                  <span className={`ml-1 text-xs sm:text-sm font-medium ${
                    energyChange.changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {energyChange.change}
                  </span>
                  <span className="ml-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">{t('common.from')} {t('common.last')} {t('common.period')}</span>
                </div>
              </div>
            )}

            {/* Solar Stats - Only show if it has data */}
            {hasData(solarData) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-lg bg-green-500">
                    <SunIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{t('devices.solar')} {t('parameters.production')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatValue('solar', solarIndex !== null ? solarIndex : solarData.reduce((a, b) => a + b, 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex items-center">
                  {solarChange.changeType === 'increase' ? (
                    <ArrowTrendingUpIcon className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                  )}
                  <span className={`ml-1 text-xs sm:text-sm font-medium ${
                    solarChange.changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {solarChange.change}
                  </span>
                  <span className="ml-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">{t('common.from')} {t('common.last')} {t('common.period')}</span>
                </div>
              </div>
            )}

            {/* Water Stats - Only show if it has data */}
            {hasData(waterData) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-lg bg-purple-500">
                    <CloudIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{t('devices.water')} {t('parameters.usage')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatValue('water', waterIndex !== null ? waterIndex : waterData.reduce((a, b) => a + b, 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex items-center">
                  {waterChange.changeType === 'increase' ? (
                    <ArrowTrendingUpIcon className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                  )}
                  <span className={`ml-1 text-xs sm:text-sm font-medium ${
                    waterChange.changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {waterChange.change}
                  </span>
                  <span className="ml-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">{t('common.from')} {t('common.last')} {t('common.period')}</span>
                </div>
              </div>
            )}

            {/* Gas Stats - Only show if it has data */}
            {hasData(gasData) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-lg bg-red-500">
                    <FireIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{t('devices.gas')} {t('parameters.usage')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatValue('gas', gasIndex !== null ? gasIndex : gasData.reduce((a, b) => a + b, 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex items-center">
                  {gasChange.changeType === 'increase' ? (
                    <ArrowTrendingUpIcon className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                  )}
                  <span className={`ml-1 text-xs sm:text-sm font-medium ${
                    gasChange.changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {gasChange.change}
                  </span>
                  <span className="ml-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">{t('common.from')} {t('common.last')} {t('common.period')}</span>
                </div>
              </div>
            )}

            {/* Show message when no stats have data */}
            {!hasData(energyData) && !hasData(solarData) && !hasData(waterData) && !hasData(gasData) && (
              <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <BoltIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('devices.noDevices')}</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('devices.noDevices')}
                </p>
              </div>
            )}
          </div>
        )}


        {/* Charts */}
        {user.role !== 'technicien' && (() => {
          // Count how many charts have data
          const chartsWithData = [
            hasData(energyData),
            hasData(solarData),
            hasData(waterData), 
            hasData(gasData)
          ].filter(Boolean).length;

          // Determine grid layout based on number of charts
          let gridClasses = '';
          if (chartsWithData === 1) {
            gridClasses = 'grid grid-cols-1'; // Single chart takes full width
          } else if (chartsWithData === 2) {
            gridClasses = 'grid grid-cols-1 md:grid-cols-2'; // Two charts side by side on medium+ screens
          } else if (chartsWithData === 3) {
            gridClasses = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3'; // Three charts responsive
          } else if (chartsWithData === 4) {
            gridClasses = 'grid grid-cols-1 md:grid-cols-2'; // Four charts in a 2x2 grid
          } else {
            gridClasses = 'grid grid-cols-1'; // Default case
          }

          return (
            <div className={`${gridClasses} gap-4 sm:gap-6`}>
              {/* Energy Chart - Only show if it has data */}
              {hasData(energyData) && (() => {
                const energyStats = calculateStats(energyData, 'energy');
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('parameters.energy')} {t('parameters.consumption')} ({t('units.kilowattHours')})</h4>
                      {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && (
                        <button
                          onClick={() => exportChartToCSV('energy', energyData, energyLabels)}
                          className="px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                          title={t('analytics.exportData')}
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                          Export
                        </button>
                      )}
                    </div>
                    <BarChart
                      xAxis={[{ data: energyLabels.map(d => {
                        const date = new Date(d);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }), label: 'Date' }]}
                      series={[{ data: energyData, label: 'Energy', color: '#3B82F6' }]}
                      height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                    />
                    
                    {/* Chart Analytics */}
                    {energyStats && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('analytics.chartAnalytics')}</h5>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{energyStats.dataPoints} {t('analytics.dataPoints')}</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t('analytics.totalConsumption')}</h6>
                            </div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">{energyStats.totalConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.selectedPeriod')}</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ChartBarIcon className="w-4 h-4 text-blue-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t('analytics.averagePerDay')}</h6>
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{energyStats.averagePerDay}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.averageConsumption')}</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-purple-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t('analytics.peakConsumption')}</h6>
                            </div>
                            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{energyStats.peakConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.highestDailyUsage')}</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="w-4 h-4 text-yellow-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t('analytics.dataPoints')}</h6>
                            </div>
                            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{energyStats.dataPoints}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{t('analytics.dataPeriods')}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Solar Chart - Only show if it has data */}
              {hasData(solarData) && (() => {
                const solarStats = calculateStats(solarData, 'solar');
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Solar Production (kWh)</h4>
                      {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && (
                        <button
                          onClick={() => exportChartToCSV('solar', solarData, solarLabels)}
                          className="px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                          title={t('analytics.exportData')}
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                          Export
                        </button>
                      )}
                    </div>
                    <BarChart
                      xAxis={[{ data: solarLabels.map(d => {
                        const date = new Date(d);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }), label: 'Date' }]}
                      series={[{ data: solarData, label: 'Solar', color: '#22C55E' }]}
                      height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                    />
                    
                    {/* Chart Analytics */}
                    {solarStats && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chart Analytics</h5>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{solarStats.dataPoints} data points</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Total Production</h6>
                            </div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">{solarStats.totalConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Selected period</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ChartBarIcon className="w-4 h-4 text-blue-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Average per day</h6>
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{solarStats.averagePerDay}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Average production</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-purple-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Peak Production</h6>
                            </div>
                            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{solarStats.peakConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Highest daily production</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="w-4 h-4 text-yellow-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Data Points</h6>
                            </div>
                            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{solarStats.dataPoints}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Data periods</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Water Chart - Only show if it has data */}
              {hasData(waterData) && (() => {
                const waterStats = calculateStats(waterData, 'water');
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Water Usage (m³)</h4>
                      {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && (
                        <button
                          onClick={() => exportChartToCSV('water', waterData, waterLabels)}
                          className="px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                          title={t('analytics.exportData')}
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                          Export
                        </button>
                      )}
                    </div>
                    <BarChart
                      xAxis={[{ data: waterLabels.map(d => {
                        const date = new Date(d);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }), label: 'Date' }]}
                      series={[{ data: waterData, label: 'Water', color: '#9333EA' }]}
                      height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                    />
                    
                    {/* Chart Analytics */}
                    {waterStats && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chart Analytics</h5>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{waterStats.dataPoints} data points</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Total Usage</h6>
                            </div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">{waterStats.totalConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Selected period</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ChartBarIcon className="w-4 h-4 text-blue-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Average per day</h6>
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{waterStats.averagePerDay}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Average usage</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-purple-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Peak Usage</h6>
                            </div>
                            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{waterStats.peakConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Highest daily usage</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="w-4 h-4 text-yellow-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Data Points</h6>
                            </div>
                            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{waterStats.dataPoints}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Data periods</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Gas Chart - Only show if it has data */}
              {hasData(gasData) && (() => {
                const gasStats = calculateStats(gasData, 'gas');
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gas Usage (m³)</h4>
                      {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && (
                        <button
                          onClick={() => exportChartToCSV('gas', gasData, gasLabels)}
                          className="px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                          title={t('analytics.exportData')}
                        >
                          <ArrowDownTrayIcon className="w-3 h-3" />
                          Export
                        </button>
                      )}
                    </div>
                    <BarChart
                      xAxis={[{ data: gasLabels.map(d => {
                        const date = new Date(d);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }), label: 'Date' }]}
                      series={[{ data: gasData, label: 'Gas', color: '#EF4444' }]}
                      height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                    />
                    
                    {/* Chart Analytics */}
                    {gasStats && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chart Analytics</h5>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{gasStats.dataPoints} data points</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Total Usage</h6>
                            </div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">{gasStats.totalConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Selected period</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ChartBarIcon className="w-4 h-4 text-blue-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Average per day</h6>
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{gasStats.averagePerDay}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Average usage</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowTrendingUpIcon className="w-4 h-4 text-purple-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Peak Usage</h6>
                            </div>
                            <div className="text-sm font-bold text-purple-600 dark:text-purple-400">{gasStats.peakConsumption}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Highest daily usage</div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="w-4 h-4 text-yellow-500" />
                              <h6 className="font-medium text-gray-900 dark:text-gray-100 text-xs">Data Points</h6>
                            </div>
                            <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{gasStats.dataPoints}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Data periods</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Show message when no charts have data */}
              {!hasData(energyData) && !hasData(solarData) && !hasData(waterData) && !hasData(gasData) && (
                              <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('devices.noDeviceData')}</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('devices.noDeviceDataDescription')}
                </p>
              </div>
              )}
            </div>
          );
        })()}
        {/* Device Modal */}
        {isDeviceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 dark:bg-opacity-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-lg w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-2 right-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
                onClick={() => setIsDeviceModalOpen(false)}
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-6 text-blue-700 dark:text-blue-400">
                    {deviceModalMode === 'edit' ? t('devices.editDevice') : t('devices.createDevice')}
              </h2>
                <form className="space-y-4" onSubmit={handleDeviceSubmit}>
                <div>
                  <label className="block font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('devices.deviceId')}</label> 
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    type="text"
                    value={deviceForm.deviceId}
                    onChange={e => setDeviceForm({...deviceForm, deviceId: e.target.value})}
                    required
                    placeholder="e.g., DEVICE_001"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.name')}</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    type="text"
                    value={deviceForm.name}
                    onChange={e => setDeviceForm({...deviceForm, name: e.target.value})}
                    required
                    placeholder="Device name"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.type')}</label>
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={deviceForm.type}
                    onChange={e => setDeviceForm({...deviceForm, type: e.target.value})}
                    required
                  >
                    <option value="water">Water</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.status')}</label>
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={deviceForm.status}
                    onChange={e => setDeviceForm({...deviceForm, status: e.target.value})}
                    required
                  >
                    <option value="active">{t('dashboard.online')}</option>
                    <option value="inactive">{t('dashboard.offline')}</option>
                    <option value="maintenance">{t('dashboard.maintenance')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-gray-900 dark:text-gray-100">{t('common.description')}</label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={deviceForm.description}
                    onChange={e => setDeviceForm({...deviceForm, description: e.target.value})}
                    placeholder="Device description (optional)"
                    rows={3}
                  />
                </div>
                <button
                  className="w-full bg-blue-600 dark:bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? deviceModalMode === 'edit'
                      ? t('common.updating')
                      : t('common.creating')
                    : deviceModalMode === 'edit'
                    ? t('devices.updateDevice')
                    : t('devices.createDevice')}
                </button>
              </form>
                    {error && <div className="text-red-600 dark:text-red-400 mt-4">{error}</div>}
            </div>
          </div>
        )}
        {/* Devices Section */}  
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Devices</h3>
            <div className="flex gap-2">
                 {/*         <button
              onClick={() => router.push(`/dashboard/sites/${siteId}/devices/energy/energy`)}
              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors flex items-center gap-1"
            >
              <BoltIcon className="w-4 h-4" />
              Energy
            </button>*/}
            {/*            <button
              onClick={() => {
                // Find the first solar device to navigate to
                const solarDevice = site.devices?.find((d: any) => d.type === 'solar');
                if (solarDevice) {
                  router.push(`/dashboard/sites/${siteId}/devices/${solarDevice.deviceId}/solar`);
                } else {
                  // If no solar device exists, show an alert
                  alert('No solar devices found in this site');
                }
              }}
              className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              <SunIcon className="w-4 h-4" />
              Solar
            </button>*/}
             {/*
            <button
              onClick={() => {
                // Find the first water device to navigate to
                const waterDevice = site.devices?.find((d: any) => d.type === 'water');
                if (waterDevice) {
                  router.push(`/dashboard/sites/${siteId}/devices/${waterDevice.deviceId}/water`);
                } else {
                  // If no water device exists, show an alert
                  alert('No water devices found in this site');
                }
              }}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <CloudIcon className="w-4 h-4" />
              Water
            </button>
            */}
            {/*<button
              onClick={() => router.push(`/dashboard/sites/${siteId}/devices/gas/gas`)}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors flex items-center gap-1"
            >
              <FireIcon className="w-4 h-4" />
              Gas
            </button>*/}
            </div>
          </div>
          {/* Floating Plus Button for Add Device (only for canConfigure) */}
          {canConfigure && (
            <button
              onClick={openCreateDeviceModal}
              className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors text-2xl fixed"
              title={t('devices.addDevice')}
              style={{ position: 'fixed', right: '2rem', bottom: '2rem', zIndex: 1000 }}
            >
              <span className="sr-only">{t('devices.addDevice')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
          {filteredDevices && filteredDevices.length > 0 ? (
            <div className="relative max-h-[32rem] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 album-grid">
                {filteredDevices.map((device: any) => (
                  <div key={device.deviceId} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 bg-white dark:bg-gray-700 shadow hover:shadow-lg transition-all flex flex-col items-center album-card">
                    <div className="flex items-center justify-between w-full mb-2">
                      <h4 
                        className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => router.push(`/dashboard/sites/${siteId}/devices/${device.deviceId}/${device.type}`)}
                        title="Click to view device details"
                      >
                        {device.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        device.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                        device.status === 'maintenance' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 w-full">
                      <div className="flex justify-between">
                        <span>{t('common.name')}:</span>
                        <span className="font-mono text-gray-800 dark:text-gray-200">{device.deviceId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('common.type')}:</span>
                        <span className="capitalize text-gray-800 dark:text-gray-200">{device.type}</span>
                      </div>
                      {device.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={device.description}>
                          {device.description}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                      <button
                        onClick={() => router.push(`/dashboard/sites/${siteId}/devices/${device.deviceId}/${device.type}`)}   
                        className="bg-blue-500 dark:bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors w-full"
                      >
                        {t('common.view')} {t('common.status')}
                      </button>
                      {canConfigure && (
                        <>
                          <button
                            onClick={() => openEditDeviceModal(device)}
                            className="bg-yellow-400 dark:bg-yellow-500 px-2 py-1 rounded text-xs hover:bg-yellow-500 dark:hover:bg-yellow-600 transition-colors w-full"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device.deviceId)}
                            className="bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-600 dark:hover:bg-red-700 transition-colors w-full"
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-lg font-medium mb-2 dark:text-gray-300">{t('devices.noDevices')}</div>
              <div className="text-sm dark:text-gray-400">{t('devices.noDevices')}</div>
            </div>
          )}
        </div>
      </div>
      <div className={`sidebar ${sidebarOpen ? 'block' : 'hidden'}`}>
        {/* Sidebar content */}
      </div>
      {!sidebarOpen && (
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(true)}
        >
          {/* Hamburger icon */}
        </button>
      )}
    </DashboardLayout>
  );
} 