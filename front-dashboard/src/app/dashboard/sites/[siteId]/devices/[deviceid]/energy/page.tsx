'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../../../../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { 
  ChartBarIcon, 
  BoltIcon, 
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  PlayIcon,
  PauseIcon,
  CogIcon,
  PencilIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  BellIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';

const timePeriods = [
  { label: '7d', value: '7d', granularity: 'day' },
  { label: '30d', value: '30d', granularity: 'day' },
  { label: 'Custom', value: 'custom', granularity: 'day' }
];

interface LastReading {
  value: number;
  unit: string;
  timestamp: string;
  power?: number;
}

interface Device {
  _id: string;
  deviceId: string;
  type: 'energy' | 'solar' | 'water' | 'gas' | 'temperature' | 'humidity' | 'pressure';
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'maintenance';
  siteId: string;
  lastReading: LastReading;
  threshold: number;
  readingInterval: number;
  alertEnabled: boolean;
  maintenanceSchedule: string;
  createdAt: string;
  updatedAt: string;
}

interface Site {
  _id: string;
  name: string;
  devices: Device[];
  address?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  type: string;
  description?: string;
  status: string;
}

interface HistoricalDataPoint {
  timestamp: string;
  value: number;
  period: string;
}

interface DeviceStatsDataPoint {
  period: string;
  totalIndex: number;
}

interface DeviceStatsResponse {
  deviceId: string;
  siteId: string;
  granularity: string;
  data: DeviceStatsDataPoint[];
}

export default function EnergyDeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.siteId as string;
  const rawDeviceId = params?.deviceid as string;
  const deviceId = rawDeviceId ? decodeURIComponent(rawDeviceId) : '';
  
  const [site, setSite] = useState<Site | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configMode, setConfigMode] = useState(false);
  const [configData, setConfigData] = useState<Partial<Device>>({});
  
  // Period selection state
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  
  // Real-time data states
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Real-time chart data states
  const [realtimeChartData, setRealtimeChartData] = useState<{ timestamp: Date; value: number }[]>([]);
  const [realtimeChartLabels, setRealtimeChartLabels] = useState<Date[]>([]);
  const [realtimeChartValues, setRealtimeChartValues] = useState<number[]>([]);
  const [maxDataPoints, setMaxDataPoints] = useState(50);
  
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch initial device data
  useEffect(() => {
    console.log('🔍 Energy Device Detail useEffect triggered with:', { siteId, deviceId });
    
    if (!siteId || !deviceId) {
      console.log('❌ Missing siteId or deviceId:', { siteId, deviceId });
      return;
    }
    
    setLoading(true);
    setError('');
    
    console.log('📡 Fetching site data from:', `${API_URL}/${siteId}`);
    
    fetch(`${API_URL}/${siteId}`)
      .then(res => {
        console.log('📥 Site API Response status:', res.status);
        if (!res.ok) throw new Error(`Site not found: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('✅ Site data received:', data);
        setSite(data);
        
        const foundDevice = data.devices?.find((d: Device) => d.deviceId === deviceId);  
        console.log('🔍 Looking for device with ID:', deviceId);
        console.log('📋 Available devices:', data.devices?.map((d: Device) => ({ id: d.deviceId, name: d.name })));
        console.log('🎯 Found device:', foundDevice);
        
        if (!foundDevice) {
          console.log('⚠️ Device not found in site data, trying direct fetch...');
          // Try direct device fetch as fallback
          const directUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/site/${siteId}/${deviceId}`;
          console.log('📡 Fetching device directly from:', directUrl);
          
          return fetch(directUrl)
            .then(res => {
              console.log('📥 Direct device API Response status:', res.status);
              if (!res.ok) throw new Error(`Device not found: ${res.status}`);
              return res.json();
            })
            .then(deviceData => {
              console.log('✅ Device data received directly:', deviceData);
              setDevice(deviceData);
              setConfigData(deviceData);
              // Fetch device stats
              fetchDeviceStats(deviceData.type);
              setLoading(false);
            });
        }
        
        console.log('✅ Using device from site data');
        setDevice(foundDevice); 
        setConfigData(foundDevice);
        // Fetch device stats
        fetchDeviceStats(foundDevice.type);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Error fetching site/device data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [siteId, deviceId]);

  // Fetch device stats
  const fetchDeviceStats = async (deviceType: string) => {
    if (!deviceId || !siteId) return;
    
    setStatsLoading(true);
    const { from, to } = getDateRange();
    const granularity = getGranularity();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/stats/${deviceId}/${siteId}?from=${from}&to=${to}&granularity=${granularity}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch device stats: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Device stats received:', data);
      setDeviceStats(data);
    } catch (error) {
      console.error('❌ Error fetching device stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch historical data
  const fetchHistoricalData = async (deviceType: string) => {
    if (!deviceId || !siteId) return;
    
    const { from, to } = getDateRange();
    const granularity = getGranularity();
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/device/historical/${deviceId}/${siteId}?from=${from}&to=${to}&granularity=${granularity}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch historical data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📈 Historical data received:', data);
      setHistoricalData(data);
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
    }
  };

  // Get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    let from: Date;
    
    switch (selectedPeriod) {
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        from = customFrom || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const to = customTo || now;
        return { from: from.toISOString(), to: to.toISOString() };
      default:
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return { from: from.toISOString(), to: now.toISOString() };
  };

  // Get granularity based on selected period
  const getGranularity = () => {
    switch (selectedPeriod) {
      case '7d':
        return 'day';
      case '30d':
        return 'day';
      case 'custom':
        return 'day';
      default:
        return 'day';
    }
  };

  // Calculate change percentage
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

  // Export chart data
  const exportChartData = () => {
    if (!deviceStats?.data || !deviceStats.data.length) return;
    
    const csvData = [
      ['Period', 'Total Index']
    ];
    
    deviceStats.data.forEach(point => {
      csvData.push([point.period, point.totalIndex.toString()]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy-device-${deviceId}-stats.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Export historical data
  const exportHistoricalData = () => {
    if (!historicalData || !historicalData.length) return;
    
    const csvData = [
      ['Timestamp', 'Value', 'Period']
    ];
    
    historicalData.forEach(point => {
      csvData.push([point.timestamp, point.value.toString(), point.period]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `energy-device-${deviceId}-historical.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Generate period labels
  function generatePeriodLabels(from: string, to: string, granularity: string) {
    const labels: string[] = [];
    const startDate = new Date(from);
    const endDate = new Date(to);
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      if (granularity === 'day') {
        labels.push(currentDate.toLocaleDateString());
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (granularity === 'hour') {
        labels.push(currentDate.toLocaleTimeString());
        currentDate.setHours(currentDate.getHours() + 1);
      }
    }
    
    return labels;
  }

  // Check if data has values
  const hasData = (data: number[]) => {
    return data && data.length > 0 && data.some(val => val > 0);
  };

  // Format value with unit
  function formatValue(type: string, value: number | null | undefined, showUnit = true) {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'water':
        return showUnit ? `${value.toFixed(2)} L` : value.toFixed(2);
      case 'energy':
        return showUnit ? `${value.toFixed(2)} kWh` : value.toFixed(2);
      case 'gas':
        return showUnit ? `${value.toFixed(2)} m³` : value.toFixed(2);
      case 'solar':
        return showUnit ? `${value.toFixed(2)} W` : value.toFixed(2);
      default:
        return showUnit ? `${value.toFixed(2)}` : value.toFixed(2);
    }
  }

  // Get type icon
  const getTypeIcon = (type: string, className = "w-6 h-6") => {
    switch (type) {
      case 'water':
        return <BoltIcon className={className} />;
      case 'energy':
        return <BoltIcon className={className} />;
      case 'gas':
        return <BoltIcon className={className} />;
      case 'solar':
        return <BoltIcon className={className} />;
      default:
        return <SignalIcon className={className} />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'inactive':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'maintenance':
        return <CogIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <SignalIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout user={session?.user || {}}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading device details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout user={session?.user || {}}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Device</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!device) {
    return (
      <DashboardLayout user={session?.user || {}}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Device Not Found</h2>
            <p className="text-gray-600 mb-4">The requested device could not be found.</p>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={session?.user || {}}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
              <p className="text-gray-600">Energy Device • {device.deviceId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(device.status)}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              device.status === 'active' ? 'bg-green-100 text-green-800' :
              device.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {device.status}
            </span>
          </div>
        </div>

        {/* Device Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Reading</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatValue('energy', device.lastReading?.value)}
                </p>
              </div>
              <BoltIcon className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {device.lastReading?.timestamp ? new Date(device.lastReading.timestamp).toLocaleString() : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Threshold</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatValue('energy', device.threshold)}
                </p>
              </div>
              <BellIcon className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Alert threshold</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reading Interval</p>
                <p className="text-2xl font-bold text-gray-900">
                  {device.readingInterval}s
                </p>
              </div>
              <ClockIcon className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Update frequency</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alerts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {device.alertEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <BellIcon className={`w-8 h-8 ${device.alertEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Notification status</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Device Stats Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Device Statistics</h3>
              <button
                onClick={exportChartData}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Export Data"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            </div>
            
            {deviceStats && deviceStats.data && deviceStats.data.length > 0 ? (
              <div className="h-64">
                <BarChart
                  dataset={deviceStats.data as any}
                  xAxis={[{ scaleType: 'band', dataKey: 'period' }]}
                  series={[{ dataKey: 'totalIndex', label: 'Total Index' }]}
                  height={250}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <ChartBarIcon className="w-12 h-12 mx-auto mb-2" />
                  <p>No data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Historical Data Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Historical Data</h3>
              <button
                onClick={exportHistoricalData}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Export Data"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            </div>
            
            {historicalData && historicalData.length > 0 ? (
              <div className="h-64">
                <LineChart
                  dataset={historicalData as any}
                  xAxis={[{ scaleType: 'band', dataKey: 'timestamp' }]}
                  series={[{ dataKey: 'value', label: 'Value' }]}
                  height={250}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <ChartBarIcon className="w-12 h-12 mx-auto mb-2" />
                  <p>No data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Device Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device ID</label>
              <input
                type="text"
                value={device.deviceId}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device Type</label>
              <input
                type="text"
                value={device.type}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={device.name}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <input
                type="text"
                value={device.status}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
            </div>
            {device.description && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={device.description}
                  readOnly
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 