'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TextField from '@mui/material/TextField';
import { BarChart } from '@mui/x-charts/BarChart';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';

const timePeriods = [
  { label: '7d', value: '7d', granularity: 'day' },
  { label: '30d', value: '30d', granularity: 'day' },
  { label: 'Custom', value: 'custom', granularity: 'day' }
];

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = params?.siteId as string;
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

  // Get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const to = now.toISOString();
    let from: string;
    switch (selectedPeriod) {
      case '7d':
        from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'custom':
        if (customFrom && customTo) {
          return { from: customFrom.toISOString(), to: customTo.toISOString() };
        }
        from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    }
    return { from, to };
  };
  // Get granularity
  const getGranularity = () => {
    const period = timePeriods.find(p => p.value === selectedPeriod);
    return period?.granularity || 'day';
  };

  // Helper to generate a list of periods (labels) between two dates
  function generatePeriodLabels(from: string, to: string, granularity: string) {
    const start = new Date(from);
    const end = new Date(to);
    const labels: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      if (granularity === 'day') {
        labels.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'month') {
        labels.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
      } else if (granularity === 'year') {
        labels.push(current.getFullYear().toString());
        current.setFullYear(current.getFullYear() + 1);
      } else {
        labels.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
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
      const url = `${API_URL}/data/site/${siteId}/${type}/stats`;
      const body = JSON.stringify({
        from,
        to,
        granularity
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (!res.ok) { setData(Array(periodLabels.length).fill(0)); setLabels(periodLabels); return; }
      const data = await res.json();
      console.log(`[fetchStats] type: ${type}, raw response:`, data);
      const filled = Array.isArray(data)
        ? data
        : data.values || [];
      console.log(`[fetchStats] type: ${type}, filled:`, filled);
      // Map period to value
      const valueMap = new Map(filled.map((v: any) => [v.period, v.totalIndex ?? v.total ?? v.value ?? 0]));
      setData(periodLabels.map(label => valueMap.get(label) ?? 0));
      setLabels(periodLabels);
    };
    fetchStats('energy', setEnergyData, setEnergyLabels);
    fetchStats('solar', setSolarData, setSolarLabels);
    fetchStats('water', setWaterData, setWaterLabels);
    fetchStats('gas', setGasData, setGasLabels);
    // Fetch index values
    const fetchIndex = async (type: string, setter: any) => {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/site/${siteId}/${type}/index`;
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!site) return null;

  // Prepare user object for DashboardLayout
  const user = {
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    role: session?.user?.role || '',
  };
  const canConfigure = user.role === 'superadmin' || user.role === 'admin' || user.role === 'installator';

  // Helper function to check if data has meaningful values (non-zero)
  const hasData = (data: number[]) => {
    return data.length > 0 && data.some(value => value > 0);
  };

  // Compute stats
  const energyChange = calcChange(energyData);
  const solarChange = calcChange(solarData);
  const waterChange = calcChange(waterData);
  const gasChange = calcChange(gasData);

  // Time period selector component
  const TimePeriodSelector = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Time Period:</span>
        </div>
        <div className="flex flex-1 items-center">
          <div className="flex flex-wrap gap-2 items-center">
            {timePeriods.map((period) => (
              <button
                key={period.value}
                onClick={() => {
                  setSelectedPeriod(period.value);
                  setShowCustomPicker(period.value === 'custom');
                }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => router.push(`/dashboard/sites/${siteId}/analytics`)}
            className="px-3 py-1 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors ml-4"
          >
            Analytics for this Site
          </button>
        </div>
        {showCustomPicker && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="From"
              value={customFrom}
              onChange={setCustomFrom}
              slotProps={{ textField: { size: 'small' } }}
            />
            <span className="text-gray-500">to</span>
            <DateTimePicker
              label="To"
              value={customTo}
              onChange={setCustomTo}
              slotProps={{ textField: { size: 'small' } }}
            />
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
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{site.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Location Information</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>
                  Latitude: {site.location?.latitude !== undefined ? site.location.latitude.toFixed(6) : 'N/A'},&nbsp;
                  </div>
                  <div>
                  Longitude: {site.location?.longitude !== undefined ? site.location.longitude.toFixed(6) : 'N/A'}
                </div>
                {site.address && <div>Address: {site.address}</div>}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Site Information</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Type: {site.type}</div>
                <div>Status: {site.status || 'Active'}</div>
                <div>Devices: {site.devices?.length || 0}</div> 
              </div>
            </div>
          </div>
        </div>
        {/* Time Period Selector */}
        <TimePeriodSelector />
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {/* Energy Stats - Only show if it has data */}
          {hasData(energyData) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-lg bg-blue-500">
                  <BoltIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Energy Consumption</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
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
                  energyChange.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {energyChange.change}
                </span>
                <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last period</span>
              </div>
            </div>
          )}

          {/* Solar Stats - Only show if it has data */}
          {hasData(solarData) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-lg bg-green-500">
                  <SunIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Solar Production</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
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
                  solarChange.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {solarChange.change}
                </span>
                <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last period</span>
              </div>
            </div>
          )}

          {/* Water Stats - Only show if it has data */}
          {hasData(waterData) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-lg bg-purple-500">
                  <CloudIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Water Usage</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
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
                  waterChange.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {waterChange.change}
                </span>
                <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last period</span>
              </div>
            </div>
          )}

          {/* Gas Stats - Only show if it has data */}
          {hasData(gasData) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 rounded-lg bg-red-500">
                  <FireIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Gas Usage</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
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
                  gasChange.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {gasChange.change}
                </span>
                <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last period</span>
              </div>
            </div>
          )}

          {/* Show message when no stats have data */}
          {!hasData(energyData) && !hasData(solarData) && !hasData(waterData) && !hasData(gasData) && (
            <div className="col-span-full bg-white rounded-lg shadow p-8 text-center">
              <BoltIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Devices Connected</h3>
              <p className="text-gray-500">
                No devices are currently connected. Please check your device connections and ensure they are properly configured.
              </p>
            </div>
          )}
        </div>
        {/* Charts */}
        {(() => {
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
            gridClasses = 'grid grid-cols-1 lg:grid-cols-2'; // Two charts side by side on large screens
          } else if (chartsWithData === 3) {
            gridClasses = 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'; // Three charts responsive
          } else if (chartsWithData === 4) {
            gridClasses = 'grid grid-cols-1 lg:grid-cols-2'; // Four charts in a 2x2 grid
          } else {
            gridClasses = 'grid grid-cols-1'; // Default case
          }

          return (
            <div className={`${gridClasses} gap-4 sm:gap-6`}>
              {/* Energy Chart - Only show if it has data */}
              {hasData(energyData) && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h4 className="text-sm font-semibold mb-2">Energy Consumption (kWh)</h4>
                  <BarChart
                    xAxis={[{ data: energyLabels.map(d => {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }), label: 'Date' }]}
                    series={[{ data: energyData, label: 'Energy', color: '#3B82F6' }]}
                    height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                  />
                </div>
              )}

              {/* Solar Chart - Only show if it has data */}
              {hasData(solarData) && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h4 className="text-sm font-semibold mb-2">Solar Production (kWh)</h4>
                  <BarChart
                    xAxis={[{ data: solarLabels.map(d => {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }), label: 'Date' }]}
                    series={[{ data: solarData, label: 'Solar', color: '#22C55E' }]}
                    height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                  />
                </div>
              )}

              {/* Water Chart - Only show if it has data */}
              {hasData(waterData) && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h4 className="text-sm font-semibold mb-2">Water Usage (m³)</h4>
                  <BarChart
                    xAxis={[{ data: waterLabels.map(d => {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }), label: 'Date' }]}
                    series={[{ data: waterData, label: 'Water', color: '#9333EA' }]}
                    height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                  />
                </div>
              )}

              {/* Gas Chart - Only show if it has data */}
              {hasData(gasData) && (
                <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                  <h4 className="text-sm font-semibold mb-2">Gas Usage (m³)</h4>
                  <BarChart
                    xAxis={[{ data: gasLabels.map(d => {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }), label: 'Date' }]}
                    series={[{ data: gasData, label: 'Gas', color: '#EF4444' }]}
                    height={chartsWithData === 1 ? 350 : 220} // Taller chart when it's the only one
                  />
                </div>
              )}

              {/* Show message when no charts have data */}
              {!hasData(energyData) && !hasData(solarData) && !hasData(waterData) && !hasData(gasData) && (
                <div className="col-span-full bg-white rounded-lg shadow p-8 text-center">
                  <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Device Data Available</h3>
                  <p className="text-gray-500">
                    No devices are currently sending data for the selected time period. Charts will appear here when devices are connected and transmitting data.
                  </p>
                </div>
              )}
            </div>
          );
        })()}
        {/* Device Modal */}
        {isDeviceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-lg relative">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
                onClick={() => setIsDeviceModalOpen(false)}
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold mb-6 text-blue-700">
                    {deviceModalMode === 'edit' ? 'Edit Device' : 'Create New Device'}
              </h2>
                <form className="space-y-4" onSubmit={handleDeviceSubmit}>
                <div>
                  <label className="block font-semibold mb-1">Device ID</label> 
                  <input
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    type="text"
                    value={deviceForm.deviceId}
                    onChange={e => setDeviceForm({...deviceForm, deviceId: e.target.value})}
                    required
                    placeholder="e.g., DEVICE_001"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Name</label>
                  <input
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    type="text"
                    value={deviceForm.name}
                    onChange={e => setDeviceForm({...deviceForm, name: e.target.value})}
                    required
                    placeholder="Device name"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={deviceForm.type}
                    onChange={e => setDeviceForm({...deviceForm, type: e.target.value})}
                    required
                  >
                    <option value="energy">Energy</option>
                    <option value="solar">Solar</option>
                    <option value="water">Water</option>
                    <option value="gas">Gas</option>
                    <option value="temperature">Temperature</option>
                    <option value="humidity">Humidity</option>
                    <option value="pressure">Pressure</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={deviceForm.status}
                    onChange={e => setDeviceForm({...deviceForm, status: e.target.value})}
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Description</label>
                  <textarea
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={deviceForm.description}
                    onChange={e => setDeviceForm({...deviceForm, description: e.target.value})}
                    placeholder="Device description (optional)"
                    rows={3}
                  />
                </div>
                <button
                  className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? deviceModalMode === 'edit'
                      ? 'Updating...'
                      : 'Creating...'
                    : deviceModalMode === 'edit'
                    ? 'Update Device'
                    : 'Create Device'}
                </button>
              </form>
                    {error && <div className="text-red-600 mt-4">{error}</div>}
            </div>
          </div>
        )}
        {/* Devices Section */}  
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Devices</h3>
            {/* Floating Plus Button for Add Device (only for canConfigure) */}
            {canConfigure && (
              <button
                onClick={openCreateDeviceModal}
                className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors text-2xl"
                title="Add Device"
                style={{ position: 'absolute', right: '2rem', bottom: '2rem', zIndex: 10 }}
              >
                <span className="sr-only">Add Device</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>
          {site.devices && site.devices.length > 0 ? (
            <div className="relative max-h-[32rem] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 album-grid">
                {site.devices.map((device: any) => (
                  <div key={device.deviceId} className="border rounded-xl p-4 bg-white shadow hover:shadow-lg transition-all flex flex-col items-center album-card">
                    <div className="flex items-center justify-between w-full mb-2">
                      <h4 
                        className="font-medium text-gray-900 text-sm truncate cursor-pointer hover:text-blue-600"
                        onClick={() => router.push(`/dashboard/sites/${siteId}/devices/${device.deviceId}`)}
                        title="Click to view device details"
                      >
                        {device.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        device.status === 'active' ? 'bg-green-100 text-green-800' :
                        device.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 w-full">
                      <div className="flex justify-between">
                        <span>ID:</span>
                        <span className="font-mono text-gray-800">{device.deviceId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="capitalize text-gray-800">{device.type}</span>
                      </div>
                      {device.description && (
                        <div className="text-xs text-gray-500 truncate" title={device.description}>
                          {device.description}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full">
                      <button
                        onClick={() => router.push(`/dashboard/sites/${siteId}/devices/${device.deviceId}`)}   
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors w-full"
                      >
                        View Details
                      </button>
                      {canConfigure && (
                        <>
                          <button
                            onClick={() => openEditDeviceModal(device)}
                            className="bg-yellow-400 px-2 py-1 rounded text-xs hover:bg-yellow-500 transition-colors w-full"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device.deviceId)}
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors w-full"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg font-medium mb-2">No devices assigned</div>
              <div className="text-sm">This site doesn't have any devices yet.</div>
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