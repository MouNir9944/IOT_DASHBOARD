'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../../../../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  PlayIcon,
  PauseIcon,
  CogIcon,
  PencilIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// TypeScript interfaces
interface LastReading {
  value: number;
  unit: string;
  timestamp: string;
  flowRate?: number;
  pressure?: number;
  temperature?: number;
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

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'; // TODO: change to /api/sites/data/site/{siteId}/devices?type={type}

const timePeriods = [
  { label: '7d', value: '7d', granularity: 'day' },
  { label: '30d', value: '30d', granularity: 'day' },
  { label: 'Custom', value: 'custom', granularity: 'day' }
];
const SITES_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';

// Add debugging info
console.log('🔧 API Configuration:', { API_URL, SITES_API_URL });

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.siteId as string;
  const rawDeviceId = params?.deviceid as string; // Note: lowercase 'deviceid' to match folder name  
  const deviceId = rawDeviceId ? decodeURIComponent(rawDeviceId) : ''; // Decode URL-encoded device ID
  
  // Debug URL parameters
  console.log('🔍 URL Parameters extracted:', { 
    params, 
    siteId, 
    rawDeviceId,
    deviceId: deviceId,
    allParamsKeys: Object.keys(params || {})
  });
  
  const [site, setSite] = useState<Site | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configMode, setConfigMode] = useState(false);
  const [configData, setConfigData] = useState<Partial<Device>>({});
  
  // Period selection state (matching site page)
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
  const [maxDataPoints, setMaxDataPoints] = useState(50); // Keep last 50 data points
  
  // Chart data states
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  
  // Additional metrics chart data
  const [flowRateData, setFlowRateData] = useState<number[]>([]);
  const [pressureData, setPressureData] = useState<number[]>([]);
  const [temperatureData, setTemperatureData] = useState<number[]>([]);
  
  // Timestamps for historical data charts
  const [flowRateTimestamps, setFlowRateTimestamps] = useState<Date[]>([]);
  const [pressureTimestamps, setPressureTimestamps] = useState<Date[]>([]);
  const [temperatureTimestamps, setTemperatureTimestamps] = useState<Date[]>([]);
  
  // Combined chart state
  const [selectedMetric, setSelectedMetric] = useState<'flowRate' | 'pressure' | 'temperature'>('flowRate');
  const [combinedChartData, setCombinedChartData] = useState<{
    flowRate: { data: number[], timestamps: Date[] },
    pressure: { data: number[], timestamps: Date[] },
    temperature: { data: number[], timestamps: Date[] }
  }>({
    flowRate: { data: [], timestamps: [] },
    pressure: { data: [], timestamps: [] },
    temperature: { data: [], timestamps: [] }
  });
  
  // Real-time chart state
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null);
  const [realtimeDataPoints, setRealtimeDataPoints] = useState<{
    flowRate: { data: number[], timestamps: Date[] },
    pressure: { data: number[], timestamps: Date[] },
    temperature: { data: number[], timestamps: Date[] }
  }>({
    flowRate: { data: [], timestamps: [] },
    pressure: { data: [], timestamps: [] },
    temperature: { data: [], timestamps: [] }
  });
  
  // Period labels for time-based charts
  const [periodLabels, setPeriodLabels] = useState<string[]>([]);
  
  // Chart type state
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  
  // Water metrics time range selection state (always in real-time mode)
  const [waterMetricsPeriod, setWaterMetricsPeriod] = useState('24h');
  const [waterMetricsCustomFrom, setWaterMetricsCustomFrom] = useState<Date | null>(null);
  const [waterMetricsCustomTo, setWaterMetricsCustomTo] = useState<Date | null>(null);
  const [showWaterMetricsCustomPicker, setShowWaterMetricsCustomPicker] = useState(false);
  const [waterMetricsRealtimeMode, setWaterMetricsRealtimeMode] = useState(true); // Always true for real-time mode
  
  // Water metrics time periods
  const waterMetricsTimePeriods = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '12h', value: '12h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: 'Custom', value: 'custom' }
  ];
  
  // Zoom state management
  const [zoomLevel, setZoomLevel] = useState(1);
  const [chartZoom, setChartZoom] = useState({
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1
  });
  
  const { data: session } = useSession();
  
  // Zoom functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10)); // Max 10x zoom
    console.log('🔍 Zoom In - Level:', Math.min(zoomLevel * 1.5, 10));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1)); // Min 0.1x zoom
    console.log('🔍 Zoom Out - Level:', Math.max(zoomLevel / 1.5, 0.1));
  };
  
  const handleResetZoom = () => {
    setZoomLevel(1);
    setChartZoom({
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1
    });
    console.log('🔄 Reset Zoom');
  };
  
  // Function to get zoomed data based on zoom level
  const getZoomedData = (data: number[], timestamps: Date[]) => {
    if (zoomLevel === 1) {
      return { data, timestamps };
    }
    
    // Calculate how many data points to show based on zoom level
    const totalPoints = data.length;
    const visiblePoints = Math.max(Math.floor(totalPoints / zoomLevel), 10); // Minimum 10 points
    
    // Take the most recent data points
    const startIndex = Math.max(0, totalPoints - visiblePoints);
    const zoomedData = data.slice(startIndex);
    const zoomedTimestamps = timestamps.slice(startIndex);
    
    console.log('🔍 Zoom calculation:', {
      zoomLevel,
      totalPoints,
      visiblePoints,
      startIndex,
      zoomedDataLength: zoomedData.length
    });
    
    return { data: zoomedData, timestamps: zoomedTimestamps };
  };
  
  // Function to ensure data continuity between historical and real-time data
  const ensureDataContinuity = (historicalData: any, realtimeData: any) => {
    if (!historicalData || !realtimeData || realtimeData.data.length === 0) {
      return { historicalData, realtimeData };
    }
    
    const lastHistoricalTimestamp = historicalData.timestamps[historicalData.timestamps.length - 1];
    const firstRealtimeTimestamp = realtimeData.timestamps[0];
    
    console.log('🔗 Checking data continuity:', {
      lastHistoricalTimestamp,
      firstRealtimeTimestamp,
      timeDiff: firstRealtimeTimestamp - lastHistoricalTimestamp
    });
    
    // If there's a significant gap, we might need to adjust the data
    const timeDiff = firstRealtimeTimestamp - lastHistoricalTimestamp;
    const maxGap = 2 * 60 * 1000; // 2 minutes in milliseconds (reduced threshold)
    
    if (timeDiff > maxGap) {
      console.log('⚠️ Large gap detected between historical and real-time data:', timeDiff / 1000, 'seconds');
      
      // Try to bridge the gap by using the last historical value as a bridge point
      if (historicalData.data.length > 0 && realtimeData.data.length > 0) {
        const lastHistoricalValue = historicalData.data[historicalData.data.length - 1];
        const firstRealtimeValue = realtimeData.data[0];
        
        // Create multiple bridge points for smoother transition
        const numBridgePoints = Math.min(3, Math.floor(timeDiff / (30 * 1000))); // Max 3 points, 30s apart
        const bridgePoints = [];
        
        for (let i = 1; i <= numBridgePoints; i++) {
          const progress = i / (numBridgePoints + 1);
          const bridgeTimestamp = new Date(lastHistoricalTimestamp.getTime() + timeDiff * progress);
          const bridgeValue = lastHistoricalValue + (firstRealtimeValue - lastHistoricalValue) * progress;
          
          bridgePoints.push({
            timestamp: bridgeTimestamp,
            value: bridgeValue
          });
        }
        
        console.log('🔗 Creating bridge points:', bridgePoints);
        
        // Add bridge points to historical data
        const bridgedHistorical = {
          data: [...historicalData.data, ...bridgePoints.map(p => p.value)],
          timestamps: [...historicalData.timestamps, ...bridgePoints.map(p => p.timestamp)]
        };
        
        return { historicalData: bridgedHistorical, realtimeData };
      }
    }
    
    return { historicalData, realtimeData };
  };

  // Get date range based on selected period (matching site page)
  const getDateRange = () => {
    const now = new Date();
    // Set 'to' to end of current day to include all data for today
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const to = endOfDay.toISOString();
    
    let from: string;
    switch (selectedPeriod) {
      case '7d':
        // For 7 days, we want to include today + 6 previous days
        const startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0); // Start of day
        from = startDate.toISOString();
        break;
      case '30d':
        // For 30 days, we want to include today + 29 previous days
        const start30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start30.setHours(0, 0, 0, 0); // Start of day
        from = start30.toISOString();
        break;
      case 'custom':
        if (customFrom && customTo) {
          const customToEndOfDay = new Date(customTo);
          customToEndOfDay.setHours(23, 59, 59, 999);
          const customFromStartOfDay = new Date(customFrom);
          customFromStartOfDay.setHours(0, 0, 0, 0);
          return { 
            from: customFromStartOfDay.toISOString(), 
            to: customToEndOfDay.toISOString() 
          };
        }
        const defaultStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        defaultStart.setHours(0, 0, 0, 0);
        from = defaultStart.toISOString();
        break;
      default:
        const defaultStart2 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        defaultStart2.setHours(0, 0, 0, 0);
        from = defaultStart2.toISOString();
    }
    
    const fromDate = new Date(from).toLocaleDateString();
    const toDate = new Date(to).toLocaleDateString();
    console.log('📅 Date range calculated:', { 
      from, 
      to, 
      fromDate, 
      toDate, 
      selectedPeriod,
      today: now.toLocaleDateString(),
      todayISO: now.toISOString().slice(0, 10),
      expectingAPIData: ['2025-08-04', '2025-08-05']
    });
    return { from, to };
  };

  // Get granularity (matching site page)
  const getGranularity = () => {
    const period = timePeriods.find(p => p.value === selectedPeriod);
    return period?.granularity || 'day';
  };

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

  // Export chart data to CSV
  const exportChartData = () => {
    if (!chartData || chartData.length === 0) {
      alert('No chart data available to export');
      return;
    }

    const csvData = [];
    csvData.push(['Date', 'Time', `${device?.type === 'energy' ? 'Energy' : device?.type === 'solar' ? 'Solar' : device?.type === 'water' ? 'Water' : device?.type === 'gas' ? 'Gas' : 'Consumption'} (${device?.type === 'energy' || device?.type === 'solar' ? 'kWh' : device?.type === 'water' || device?.type === 'gas' ? 'm³' : 'units'})`, 'Total Consumption']);
    
    let totalConsumption = 0;
    for (let i = 0; i < chartLabels.length; i++) {
      const date = chartLabels[i];
      const value = chartData[i] || 0;
      totalConsumption += value;
      
      const dateObj = new Date(date);
      const dateStr = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
      });
      const timeStr = getGranularity() === 'hour' ? 
        dateObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }) : '';
      
      csvData.push([
        dateStr,
        timeStr,
        value.toFixed(3),
        totalConsumption.toFixed(3)
      ]);
    }
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${device?.name || device?.deviceId}_chart_data_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export historical data to CSV
  const exportHistoricalData = () => {
    if (!device || device.type !== 'water') {
      alert('Historical data export is only available for water devices');
      return;
    }

    const csvData = [];
    csvData.push(['Date', 'Time', 'Flow Rate (L/min)', 'Pressure (bar)', 'Temperature (°C)']);
    
    // Get the maximum length of all data arrays
    const maxLength = Math.max(
      combinedChartData.flowRate.data.length,
      combinedChartData.pressure.data.length,
      combinedChartData.temperature.data.length
    );
    
    for (let i = 0; i < maxLength; i++) {
      const flowRate = combinedChartData.flowRate.data[i] || 0;
      const pressure = combinedChartData.pressure.data[i] || 0;
      const temperature = combinedChartData.temperature.data[i] || 0;
      
      let timestamp = null;
      if (combinedChartData.flowRate.timestamps[i]) {
        timestamp = new Date(combinedChartData.flowRate.timestamps[i]);
      } else if (combinedChartData.pressure.timestamps[i]) {
        timestamp = new Date(combinedChartData.pressure.timestamps[i]);
      } else if (combinedChartData.temperature.timestamps[i]) {
        timestamp = new Date(combinedChartData.temperature.timestamps[i]);
      }
      
      if (timestamp) {
        const dateStr = timestamp.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const timeStr = timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        csvData.push([
          dateStr,
          timeStr,
          flowRate.toFixed(3),
          pressure.toFixed(3),
          temperature.toFixed(3)
        ]);
      }
    }
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${device?.name || device?.deviceId}_historical_data_${waterMetricsPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to generate period labels between two dates
  function generatePeriodLabels(from: string, to: string, granularity: string) {
    const start = new Date(from);
    const end = new Date(to);
    const labels: string[] = [];
    let current = new Date(start);
    
    // Set current to start of day to ensure consistent comparison
    if (granularity === 'day') {
      current.setHours(0, 0, 0, 0);
    }
    
    // Get just the date parts for comparison (YYYY-MM-DD format)
    const endDateStr = granularity === 'day' ? end.toISOString().slice(0, 10) : end.toISOString();
    
    console.log('🔍 Starting period generation:', {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      endDateStr,
      granularity,
      today: new Date().toISOString().slice(0, 10)
    });
    
    while (true) {
      if (granularity === 'hour') {
        labels.push(current.toISOString().slice(0, 13) + ':00:00.000Z');
        current.setHours(current.getHours() + 1);
        if (current > end) break;
      } else if (granularity === 'day') {
        const currentDateStr = current.toISOString().slice(0, 10);
        labels.push(currentDateStr);
        
        console.log('🔍 Processing day:', {
          currentDateStr,
          endDateStr,
          isEqual: currentDateStr === endDateStr,
          shouldBreak: currentDateStr === endDateStr
        });
        
        // Break if we've reached the end date
        if (currentDateStr === endDateStr) break;
        
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'week') {
        labels.push(current.toISOString().slice(0, 10));
        if (current >= end) break;
        current.setDate(current.getDate() + 7);
      } else if (granularity === 'month') {
        labels.push(current.toISOString().slice(0, 7));
        if (current >= end) break;
        current.setMonth(current.getMonth() + 1);
      } else {
        labels.push(current.toISOString().slice(0, 10));
        if (current >= end) break;
        current.setDate(current.getDate() + 1);
      }
    }
    console.log('📊 Period labels generated:', {
      from, 
      to, 
      granularity, 
      endDateStr,
      labelsCount: labels.length,
      firstLabel: labels[0],
      lastLabel: labels[labels.length - 1],
      allLabels: labels,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      todayExpected: new Date().toISOString().slice(0, 10)
    });
    return labels;
  }

  // Helper to check if data has meaningful values
  const hasData = (data: number[]) => {
    return data.length > 0 && data.some(value => value > 0);
  };

  // Test API connectivity
  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log('🔍 Testing API connectivity...');
        
        // Test main backend health
        const mainHealthResponse = await fetch(`${API_URL}/health`);
        const mainHealthData = await mainHealthResponse.json();
        console.log('🌐 Main backend health:', mainHealthResponse.status, mainHealthData);
        
        // MQTT is now integrated into main backend
        
      } catch (error) {
        console.error('❌ API connectivity test failed:', error);
      }
    };
    
    testAPI();
  }, []);

  // Helper to format values based on device type
  function formatValue(type: string, value: number | null | undefined, showUnit = true) {
    // Handle null, undefined, or NaN values
    if (value === null || value === undefined || isNaN(value)) {
      return showUnit ? 'N/A' : '0';
    }
    
    let formattedValue = '';
    let unit = '';
    
    switch (type) {
      case 'energy':
      case 'solar':
        formattedValue = value.toFixed(1);
        unit = ' kWh';
        break;
      case 'water':
        formattedValue = value.toFixed(3);
        unit = ' m³';
        break;
      case 'gas':
        formattedValue = value.toFixed(1);
        unit = ' m³';
        break;
      case 'temperature':
        formattedValue = value.toFixed(1);
        unit = ' °C';
        break;
      case 'humidity':
        formattedValue = value.toFixed(0);
        unit = ' %';
        break;
      case 'pressure':
        formattedValue = value.toFixed(2);
        unit = ' bar';
        break;
      default:
        formattedValue = value.toString();
    }
    
    return showUnit ? formattedValue + unit : formattedValue;
  }

  // Get device type icon
  const getTypeIcon = (type: string, className = "w-6 h-6") => {
    switch (type) {
      case 'energy': return <BoltIcon className={`${className} text-blue-500`} />;
      case 'solar': return <SunIcon className={`${className} text-yellow-500`} />;
      case 'water': return <CloudIcon className={`${className} text-blue-400`} />;
      case 'gas': return <FireIcon className={`${className} text-red-500`} />;
      default: return <ChartBarIcon className={`${className} text-gray-500`} />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'maintenance': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'inactive': return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default: return <ExclamationTriangleIcon className="w-5 h-5 text-gray-500" />;
    }
  };



  // Fetch device stats using site page pattern
  const fetchDeviceStats = async (deviceType: string) => {
    if (!siteId || !deviceId) {
      console.warn('❌ Missing siteId or deviceId for stats fetch:', { siteId, deviceId });
      return;
    }
    
    const { from, to } = getDateRange();
    const granularity = getGranularity();
    const periodLabels = generatePeriodLabels(from, to, granularity);
    
    console.log('📊 Fetching device stats for:', { siteId, deviceId, deviceType, selectedPeriod, granularity });
    setStatsLoading(true);
    setChartLoading(true);
    
    try {
      let url: string;
      let response: Response;
      
      // Use GET request with query parameters for daily consumption
      const queryParams = new URLSearchParams({
        granularity,
        from,
        to
      });
      
      const statsUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/${deviceType}/device/${deviceId}/stats?${queryParams}`;
      
      console.log('🌐 Making daily consumption request to:', statsUrl);
      console.log('🔧 Request params:', { from, to, granularity });
      
      response = await fetch(statsUrl);
      
      console.log('📥 API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Device stats response:', data);
        
        // Handle daily consumption data
        console.log('📊 Raw response data array:', data);
        console.log('📊 Response data length:', data?.length);
        if (data && data.length > 0) {
          console.log('📊 First data item:', data[0]);
          console.log('📊 Sample totalIndex values:', data.map((d: DeviceStatsDataPoint) => d.totalIndex));
        }
        setDeviceStats({ data: data, deviceId, siteId, granularity });
        
        // Process data using site page pattern
        console.log('📊 Raw API response:', data);
        const filled = Array.isArray(data) ? data : [];
        console.log('📊 Filled data:', filled);
        
        // Map period to value using site page approach
        const valueMap = new Map(filled.map((v: any) => [v.period, v.totalIndex ?? v.consumption ?? v.total ?? v.value ?? 0]));
        const chartDataArray = periodLabels.map(label => valueMap.get(label) ?? 0);
      
      console.log('🔍 Period matching debug:');
      console.log('- Generated labels:', periodLabels);
      console.log('- API periods:', filled.map(d => d.period));
      console.log('- Value map:', Array.from(valueMap.entries()));
      console.log('- Chart data after mapping:', chartDataArray);
      console.log('- Non-zero values count:', chartDataArray.filter(v => v > 0).length);
      console.log('- 🎯 EXPECTED: Chart should show data for dates that match API periods');
      
      // Detailed label vs API period comparison
      console.log('🔍 DETAILED PERIOD COMPARISON:');
      periodLabels.forEach((label, index) => {
        const apiMatch = filled.find(d => d.period === label);
        const mappedValue = valueMap.get(label);
        console.log(`  Label[${index}]: "${label}" | API Match: ${apiMatch ? 'YES' : 'NO'} | Value: ${mappedValue || 0}`);
      });
      
      console.log('🔍 API DATA DETAILS:');
      filled.forEach((item, index) => {
        console.log(`  API[${index}]: period="${item.period}" | totalIndex=${item.totalIndex}`);
      });
      
      // Additional debug for debugging empty data
      if (chartDataArray.filter(v => v > 0).length === 0 && filled.length > 0) {
        console.log('⚠️ WARNING: API has data but chart shows zeros!');
        console.log('- API data count:', filled.length);
        console.log('- First API item:', filled[0]);
        console.log('- Label format test:', periodLabels[0], 'vs', filled[0]?.period);
      }
      
      setChartData(chartDataArray);
      setChartLabels(periodLabels);
      console.log('📊 Chart data prepared:', chartDataArray.length, 'data points');
      
      // Also convert to historical data format for backward compatibility
      const historicalPoints: HistoricalDataPoint[] = filled.map((item) => ({
        timestamp: item.period,
        value: item.totalIndex || item.lastReading || item.consumption || 0,
        period: granularity === 'hour' ? 
          new Date(item.period).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) :
          new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
      
      setHistoricalData(historicalPoints);
      console.log('✅ Device stats loaded:', filled.length, 'data points');
      } else {
        // Handle error response like site page
        console.error('❌ Failed to fetch device stats:', response.status);
        setChartData(Array(periodLabels.length).fill(0));
        setChartLabels(periodLabels);
        setDeviceStats(null);
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('❌ Error fetching device stats:', error);
      setDeviceStats(null);
      setHistoricalData([]);
      setChartData([]);
      setChartLabels([]);
    } finally {
      setStatsLoading(false);
      setChartLoading(false);
    }
  };

  // Legacy function for backward compatibility
  const fetchHistoricalData = async (deviceType: string) => {
    await fetchDeviceStats(deviceType);
  };

  // Fetch additional metrics data (Flow Rate, Pressure, Temperature)
  // Helper function to get 24-hour date range for flow rate
  const get24HourDateRange = () => {
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  };

  // Helper function to get water metrics date range based on selected period
  const getWaterMetricsDateRange = () => {
    const now = new Date();
    const to = now.toISOString();
    let from: string;
    
    switch (waterMetricsPeriod) {
      case '1h':
        from = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
        break;
      case '6h':
        from = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
        break;
      case '12h':
        from = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'custom':
        if (waterMetricsCustomFrom && waterMetricsCustomTo) {
          const customToEndOfDay = new Date(waterMetricsCustomTo);
          customToEndOfDay.setHours(23, 59, 59, 999);
          const customFromStartOfDay = new Date(waterMetricsCustomFrom);
          customFromStartOfDay.setHours(0, 0, 0, 0);
          return { 
            from: customFromStartOfDay.toISOString(), 
            to: customToEndOfDay.toISOString() 
          };
        }
        // Fallback to 24h if custom dates not set
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }
    
    console.log('🌊 Water metrics date range:', { 
      period: waterMetricsPeriod, 
      from: new Date(from).toLocaleString(), 
      to: new Date(to).toLocaleString() 
    });
    
    return { from, to };
  };

  const fetchAdditionalMetrics = async (deviceType: string) => {
    if (!siteId || !deviceId || deviceType !== 'water') {
      console.warn('❌ Skipping additional metrics - not a water device or missing IDs');
      return;
    }
    
    // Use water metrics specific date range
    const { from, to } = getWaterMetricsDateRange();
    const granularity = 'hour'; // Always use hour granularity for water metrics
    const generatedPeriodLabels = generatePeriodLabels(from, to, granularity);
    
    // Set period labels for time-based charts
    setPeriodLabels(generatedPeriodLabels);
    
    console.log('🌊 Fetching additional metrics for water device:', { 
      siteId, 
      deviceId, 
      deviceType,
      from,
      to,
      granularity,
      periodLabelsCount: generatedPeriodLabels.length,
      selectedPeriod: waterMetricsPeriod
    });
    
    try {
      // Use the water metrics date range
      let metricFrom = from;
      let metricTo = to;
      
      console.log(`🌊 Using water metrics data range:`, { metricFrom, metricTo, period: waterMetricsPeriod });
      
      // Use the new historical API endpoint for simple raw data
      const queryParams = new URLSearchParams({
        from: metricFrom,
        to: metricTo,
        limit: '100000' // Get up to 1000 data points
      });
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/device/${deviceId}/historical?${queryParams}`;
      console.log(`🌐 Historical API Request URL:`, url);
      
      try {
        const response = await fetch(url);
        console.log(`📥 Historical API Response status:`, response.status);
        
        if (response.ok) {
          const historicalData = await response.json();
          console.log(`✅ Historical API data received:`, {
            dataPoints: historicalData.data?.length || 0,
            sampleData: historicalData.data?.slice(0, 3)
          });
          
          if (historicalData.data && historicalData.data.length > 0) {
            // Process all metrics from the same historical data
            const metrics = ['flowRate', 'pressure', 'temperature'];
            const processedData: any = {
              flowRate: { data: [], timestamps: [] },
              pressure: { data: [], timestamps: [] },
              temperature: { data: [], timestamps: [] }
            };
            
            // Extract data for each metric
            metrics.forEach(metric => {
              const metricData = historicalData.data
                .filter((item: any) => item[metric] !== undefined && item[metric] !== null)
                .map((item: any) => ({
                  timestamp: item.timestamp,
                  value: item[metric]
                }))
                .sort((a: any, b: any) => a.timestamp - b.timestamp);
              
              console.log(`📊 ${metric} extracted data:`, {
                totalRecords: historicalData.data.length,
                metricRecords: metricData.length,
                sampleMetricData: metricData.slice(0, 3)
              });
              
              if (metricData.length > 0) {
                // Create time-based labels for the chart
                const timeLabels = metricData.map((item: any) => {
                  const date = new Date(item.timestamp);
                  return date.toISOString();
                });
                
                // Extract values for the chart
                const chartDataArray = metricData.map((item: any) => {
                  const value = typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0;
                  return Math.round(value * 100) / 100; // Round to 2 decimal places
                });
                
                console.log(`🔍 ${metric} Chart data:`, {
                  timeLabels: timeLabels.length,
                  chartData: chartDataArray.length,
                  nonZeroValues: chartDataArray.filter((v: number) => v > 0).length,
                  dataRange: chartDataArray.length > 0 ? {
                    min: Math.min(...chartDataArray),
                    max: Math.max(...chartDataArray)
                  } : null
                });
                
                // Store in combined structure
                processedData[metric] = {
                  data: chartDataArray,
                  timestamps: timeLabels.map((d: string) => new Date(d))
                };
                
                // Also update individual state for backward compatibility
                switch(metric) {
                  case 'flowRate':
                    setFlowRateData(chartDataArray);
                    setFlowRateTimestamps(timeLabels.map((d: string) => new Date(d)));
                    break;
                  case 'pressure':
                    setPressureData(chartDataArray);
                    setPressureTimestamps(timeLabels.map((d: string) => new Date(d)));
                    break;
                  case 'temperature':
                    setTemperatureData(chartDataArray);
                    setTemperatureTimestamps(timeLabels.map((d: string) => new Date(d)));
                    break;
                }
                
                console.log(`✅ ${metric} historical data loaded:`, chartDataArray.length, 'points');
                
              } else {
                console.warn(`⚠️ ${metric} No valid data found in historical response`);
                const fallbackData = Array(generatedPeriodLabels.length).fill(0);
                processedData[metric] = {
                  data: fallbackData,
                  timestamps: []
                };
                
                // Also update individual state
                switch(metric) {
                  case 'flowRate':
                    setFlowRateData(fallbackData);
                    setFlowRateTimestamps([]);
                    break;
                  case 'pressure':
                    setPressureData(fallbackData);
                    setPressureTimestamps([]);
                    break;
                  case 'temperature':
                    setTemperatureData(fallbackData);
                    setTemperatureTimestamps([]);
                    break;
                }
              }
            });
            
            // Update combined chart data
            setCombinedChartData(processedData);
            
          } else {
            console.warn(`⚠️ No data found in historical response`);
            const fallbackData = Array(generatedPeriodLabels.length).fill(0);
            const emptyData = {
              flowRate: { data: fallbackData, timestamps: [] },
              pressure: { data: fallbackData, timestamps: [] },
              temperature: { data: fallbackData, timestamps: [] }
            };
            setCombinedChartData(emptyData);
            
            // Also update individual state
            setFlowRateData(fallbackData);
            setPressureData(fallbackData);
            setTemperatureData(fallbackData);
            setFlowRateTimestamps([]);
            setPressureTimestamps([]);
            setTemperatureTimestamps([]);
          }
          
        } else {
          console.error(`❌ Historical API Error:`, response.status, await response.text());
          // Fallback to zeros if API fails
          const fallbackData = Array(generatedPeriodLabels.length).fill(0);
          const emptyData = {
            flowRate: { data: fallbackData, timestamps: [] },
            pressure: { data: fallbackData, timestamps: [] },
            temperature: { data: fallbackData, timestamps: [] }
          };
          setCombinedChartData(emptyData);
          
          setFlowRateData(fallbackData);
          setPressureData(fallbackData);
          setTemperatureData(fallbackData);
          setFlowRateTimestamps([]);
          setPressureTimestamps([]);
          setTemperatureTimestamps([]);
        }
      } catch (fetchError) {
        console.error(`❌ Historical API Fetch Error:`, fetchError);
        // Fallback to zeros if fetch fails
        const fallbackData = Array(generatedPeriodLabels.length).fill(0);
        const emptyData = {
          flowRate: { data: fallbackData, timestamps: [] },
          pressure: { data: fallbackData, timestamps: [] },
          temperature: { data: fallbackData, timestamps: [] }
        };
        setCombinedChartData(emptyData);
        
        setFlowRateData(fallbackData);
        setPressureData(fallbackData);
        setTemperatureData(fallbackData);
        setFlowRateTimestamps([]);
        setPressureTimestamps([]);
        setTemperatureTimestamps([]);
      }
      
    } catch (error) {
      console.error('❌ Error fetching additional metrics:', error);
      setFlowRateData([]);
      setPressureData([]);
      setTemperatureData([]);
      setCombinedChartData({
        flowRate: { data: [], timestamps: [] },
        pressure: { data: [], timestamps: [] },
        temperature: { data: [], timestamps: [] }
      });
    }
  };

  // Fetch initial device data
  useEffect(() => {
    console.log('🔍 Device Detail useEffect triggered with:', { siteId, deviceId });
    
    if (!siteId || !deviceId) {
      console.log('❌ Missing siteId or deviceId:', { siteId, deviceId });
      return;
    }
    
    setLoading(true);
    setError('');
    
    console.log('📡 Fetching site data from:', `${SITES_API_URL}/${siteId}`);
    
    fetch(`${SITES_API_URL}/${siteId}`)
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
        
        // Debug: Check if we're comparing the right values
        if (data.devices && data.devices.length > 0) {
          console.log('🔍 Device ID comparison:');
          data.devices.forEach((d: Device, index: number) => {
            console.log(`  Device ${index}: '${d.deviceId}' === '${deviceId}' ? ${d.deviceId === deviceId}`);
          });
        }
        
        if (!foundDevice) {
          console.log('⚠️ Device not found in site data, trying direct fetch...');
          // Try direct device fetch as fallback
          const directUrl = `${API_URL}/device/site/${siteId}/${deviceId}`;
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
              // Fetch additional metrics for water devices (with delay)
              setTimeout(() => fetchAdditionalMetrics(deviceData.type), 1000);
              setLoading(false);
            });
        }
        
        console.log('✅ Using device from site data');
        setDevice(foundDevice); 
        setConfigData(foundDevice);
        // Fetch device stats
        fetchDeviceStats(foundDevice.type);
        // Fetch additional metrics for water devices (with delay to ensure chartLabels are set)
        setTimeout(() => fetchAdditionalMetrics(foundDevice.type), 1000);
        setLoading(false);
        
        // Auto-debug after 2 seconds
        setTimeout(() => {
          console.log('🔧 AUTO-DEBUG INFO:');
          console.log('- Current selectedPeriod:', selectedPeriod);
          console.log('- Current granularity:', getGranularity());
          console.log('- Device type:', foundDevice.type);
          console.log('- Site ID:', siteId);
          console.log('- Device ID:', deviceId);
          const { from, to } = getDateRange();
          console.log('- Date range from:', from);
          console.log('- Date range to:', to);
          const testUrl = `${API_URL}/data/site/${siteId}/${foundDevice.type}/device/${deviceId}/stats`;
          console.log('- Expected API URL:', testUrl);
          console.log('- Request body:', { from, to, granularity: getGranularity() });
        }, 2000);
      })
      .catch((err) => {
        console.error('❌ Error fetching device:', err);
        setError(err.message || 'Device not found');
        setLoading(false);
      });
  }, [siteId, deviceId]);

  // Refetch stats when period selection changes (matching site page)
  useEffect(() => {
    if (device && device.type) {
      console.log('🔄 Refetching stats due to parameter change:', {
        selectedPeriod,
        granularity: getGranularity(),
        deviceType: device.type,
        deviceId,
        siteId
      });
      fetchDeviceStats(device.type);
      setTimeout(() => fetchAdditionalMetrics(device.type), 500);
    }
  }, [selectedPeriod, customFrom, customTo]);

  // Refetch water metrics when water metrics period selection changes
  useEffect(() => {
    if (device && device.type === 'water') {
      console.log('🌊 Refetching water metrics due to period change:', {
        waterMetricsPeriod,
        deviceType: device.type,
        deviceId,
        siteId
      });
      fetchAdditionalMetrics(device.type);
    }
  }, [waterMetricsPeriod, waterMetricsCustomFrom, waterMetricsCustomTo]);

  // Always fetch historical data for real-time mode
  useEffect(() => {
    if (device && device.type === 'water') {
      console.log('🌊 Fetching historical data for real-time mode');
      fetchAdditionalMetrics(device.type);
    }
  }, [waterMetricsPeriod, waterMetricsCustomFrom, waterMetricsCustomTo]);

  // Manual real-time data processing event listener
  useEffect(() => {
    const handleManualDeviceData = (event: CustomEvent) => {
      const data = event.detail;
      console.log('🔧 Manual device data received:', data);
      
      if (device?.type === 'water' && data.flowRate !== undefined && data.pressure !== undefined && data.temperature !== undefined) {
        const newTimestamp = new Date(data.timestamp);
        const maxRealtimePoints = 100000;
        
        // Update real-time data points
        setRealtimeDataPoints(prev => {
          const updated = { ...prev };
          
          updated.flowRate.data = [...updated.flowRate.data, data.flowRate || 0];
          updated.flowRate.timestamps = [...updated.flowRate.timestamps, newTimestamp];
          if (updated.flowRate.data.length > maxRealtimePoints) {
            updated.flowRate.data = updated.flowRate.data.slice(-maxRealtimePoints);
            updated.flowRate.timestamps = updated.flowRate.timestamps.slice(-maxRealtimePoints);
          }
          
          updated.pressure.data = [...updated.pressure.data, data.pressure || 0];
          updated.pressure.timestamps = [...updated.pressure.timestamps, newTimestamp];
          if (updated.pressure.data.length > maxRealtimePoints) {
            updated.pressure.data = updated.pressure.data.slice(-maxRealtimePoints);
            updated.pressure.timestamps = updated.pressure.timestamps.slice(-maxRealtimePoints);
          }
          
          updated.temperature.data = [...updated.temperature.data, data.temperature || 0];
          updated.temperature.timestamps = [...updated.temperature.timestamps, newTimestamp];
          if (updated.temperature.data.length > maxRealtimePoints) {
            updated.temperature.data = updated.temperature.data.slice(-maxRealtimePoints);
            updated.temperature.timestamps = updated.temperature.timestamps.slice(-maxRealtimePoints);
          }
          
          console.log('🔧 Manual real-time data points updated:', {
            flowRate: updated.flowRate.data.length,
            pressure: updated.pressure.data.length,
            temperature: updated.temperature.data.length
          });
          
          return updated;
        });
        
        // Also update the historical chart data
        setCombinedChartData(prev => {
          const updated = { ...prev };
          
          updated.flowRate.data = [...updated.flowRate.data, data.flowRate || 0];
          updated.flowRate.timestamps = [...updated.flowRate.timestamps, newTimestamp];
          if (updated.flowRate.data.length > maxRealtimePoints) {
            updated.flowRate.data = updated.flowRate.data.slice(-maxRealtimePoints);
            updated.flowRate.timestamps = updated.flowRate.timestamps.slice(-maxRealtimePoints);
          }
          
          updated.pressure.data = [...updated.pressure.data, data.pressure || 0];
          updated.pressure.timestamps = [...updated.pressure.timestamps, newTimestamp];
          if (updated.pressure.data.length > maxRealtimePoints) {
            updated.pressure.data = updated.pressure.data.slice(-maxRealtimePoints);
            updated.pressure.timestamps = updated.pressure.timestamps.slice(-maxRealtimePoints);
          }
          
          updated.temperature.data = [...updated.temperature.data, data.temperature || 0];
          updated.temperature.timestamps = [...updated.temperature.timestamps, newTimestamp];
          if (updated.temperature.data.length > maxRealtimePoints) {
            updated.temperature.data = updated.temperature.data.slice(-maxRealtimePoints);
            updated.temperature.timestamps = updated.temperature.timestamps.slice(-maxRealtimePoints);
          }
          
          console.log('🔧 Manual historical chart data updated:', {
            flowRate: updated.flowRate.data.length,
            pressure: updated.pressure.data.length,
            temperature: updated.temperature.data.length
          });
          
          return updated;
        });
        
        setLastRealtimeUpdate(new Date());
      }
    };
    
    window.addEventListener('manual-device-data', handleManualDeviceData as EventListener);
    
    return () => {
      window.removeEventListener('manual-device-data', handleManualDeviceData as EventListener);
    };
  }, [device]);

  // WebSocket connection for real-time data
  useEffect(() => {
    if (!deviceId) {
      console.warn('❌ No deviceId for WebSocket subscription');
      return;
    }

    console.log('🔌 Initializing WebSocket connection for device:', deviceId);

    // Initialize WebSocket connection
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔌 WebSocket connected, subscribing to device:', deviceId);
      setIsConnected(true);
      // Subscribe to device-specific data
      newSocket.emit('subscribe-device', deviceId);
    });

    newSocket.on('subscription-confirmed', (data) => {
      console.log('📡 ✅ Subscription confirmed for device:', data.deviceId);
    });

    newSocket.on('device-data', (data) => {
      console.log('📊 Real-time data received:', data);
      console.log('🔍 Device ID match check:', { received: data.deviceId, expected: deviceId, match: data.deviceId === deviceId });
      console.log('🔍 Current device type:', device?.type);
      console.log('🔍 Water metrics data present:', {
        flowRate: data.flowRate,
        pressure: data.pressure,
        temperature: data.temperature,
        hasWaterData: data.flowRate !== undefined && data.pressure !== undefined && data.temperature !== undefined
      });
      
      if (data.deviceId === deviceId) {
        console.log('✅ Setting real-time data for device');
        setRealtimeData(data);
        
        // Debug: Check if water metrics data is present
        const deviceType = device?.type || data.type;
        if (deviceType === 'water') {
          console.log('🌊 Water device real-time data check:', {
            hasFlowRate: data.flowRate !== undefined,
            hasPressure: data.pressure !== undefined,
            hasTemperature: data.temperature !== undefined,
            flowRate: data.flowRate,
            pressure: data.pressure,
            temperature: data.temperature,
            deviceType: deviceType
          });
        }
        
        // Update real-time chart data
        const timestamp = new Date(data.timestamp);
        const value = data.value || data.consumption || 0;
        
        setRealtimeChartData(prev => {
          const newData = [...prev, { timestamp, value }];
          // Keep only the last maxDataPoints
          if (newData.length > maxDataPoints) {
            return newData.slice(-maxDataPoints);
          }
          return newData;
        });
        
        setRealtimeChartLabels(prev => {
          const newLabels = [...prev, timestamp];
          if (newLabels.length > maxDataPoints) {
            return newLabels.slice(-maxDataPoints);
          }
          return newLabels;
        });
        
        setRealtimeChartValues(prev => {
          const newValues = [...prev, value];
          if (newValues.length > maxDataPoints) {
            return newValues.slice(-maxDataPoints);
          }
          return newValues;
        });
        
        // Update metrics charts with real-time data
        if (data.type === 'water' && data.flowRate !== undefined && data.pressure !== undefined && data.temperature !== undefined) {
          console.log('🌊 Updating metrics charts with real-time data:', {
            flowRate: data.flowRate,
            pressure: data.pressure,
            temperature: data.temperature,
            timestamp: data.timestamp
          });
          
          const newTimestamp = new Date(data.timestamp);
          const maxRealtimePoints = 100000; // Keep last 100,000 real-time data points for smooth charting
          
          // Update real-time data points with new values (add new points instead of just updating last)
          console.log('🔄 Starting real-time data points update...');
          setRealtimeDataPoints(prev => {
            const updated = { ...prev };
            
            console.log('🔄 Previous real-time data points:', {
              flowRate: prev.flowRate.data.length,
              pressure: prev.pressure.data.length,
              temperature: prev.temperature.data.length
            });
            
            // Add new flow rate data point
            updated.flowRate.data = [...updated.flowRate.data, data.flowRate || 0];
            updated.flowRate.timestamps = [...updated.flowRate.timestamps, newTimestamp];
            if (updated.flowRate.data.length > maxRealtimePoints) {
              updated.flowRate.data = updated.flowRate.data.slice(-maxRealtimePoints);
              updated.flowRate.timestamps = updated.flowRate.timestamps.slice(-maxRealtimePoints);
            }
            
            // Add new pressure data point
            updated.pressure.data = [...updated.pressure.data, data.pressure || 0];
            updated.pressure.timestamps = [...updated.pressure.timestamps, newTimestamp];
            if (updated.pressure.data.length > maxRealtimePoints) {
              updated.pressure.data = updated.pressure.data.slice(-maxRealtimePoints);
              updated.pressure.timestamps = updated.pressure.timestamps.slice(-maxRealtimePoints);
            }
            
            // Add new temperature data point
            updated.temperature.data = [...updated.temperature.data, data.temperature || 0];
            updated.temperature.timestamps = [...updated.temperature.timestamps, newTimestamp];
            if (updated.temperature.data.length > maxRealtimePoints) {
              updated.temperature.data = updated.temperature.data.slice(-maxRealtimePoints);
              updated.temperature.timestamps = updated.temperature.timestamps.slice(-maxRealtimePoints);
            }
            
            console.log('🔄 Updated real-time data points:', {
              flowRate: updated.flowRate.data.length,
              pressure: updated.pressure.data.length,
              temperature: updated.temperature.data.length,
              latestFlowRate: data.flowRate,
              latestPressure: data.pressure,
              latestTemperature: data.temperature,
              timestamp: newTimestamp,
              sampleFlowRateData: updated.flowRate.data.slice(-3),
              samplePressureData: updated.pressure.data.slice(-3),
              sampleTemperatureData: updated.temperature.data.slice(-3)
            });
            
            return updated;
          });
          
          // Update the combined chart data (historical data) with new real-time points
          setCombinedChartData(prev => {
            const updated = { ...prev };
            
            // Add new points to historical chart data for real-time updates
            // For flow rate
            updated.flowRate.data = [...updated.flowRate.data, data.flowRate || 0];
            updated.flowRate.timestamps = [...updated.flowRate.timestamps, newTimestamp];
            if (updated.flowRate.data.length > maxRealtimePoints) {
              updated.flowRate.data = updated.flowRate.data.slice(-maxRealtimePoints);
              updated.flowRate.timestamps = updated.flowRate.timestamps.slice(-maxRealtimePoints);
            }
            
            // For pressure
            updated.pressure.data = [...updated.pressure.data, data.pressure || 0];
            updated.pressure.timestamps = [...updated.pressure.timestamps, newTimestamp];
            if (updated.pressure.data.length > maxRealtimePoints) {
              updated.pressure.data = updated.pressure.data.slice(-maxRealtimePoints);
              updated.pressure.timestamps = updated.pressure.timestamps.slice(-maxRealtimePoints);
            }
            
            // For temperature
            updated.temperature.data = [...updated.temperature.data, data.temperature || 0];
            updated.temperature.timestamps = [...updated.temperature.timestamps, newTimestamp];
            if (updated.temperature.data.length > maxRealtimePoints) {
              updated.temperature.data = updated.temperature.data.slice(-maxRealtimePoints);
              updated.temperature.timestamps = updated.temperature.timestamps.slice(-maxRealtimePoints);
            }
            
            console.log('🔄 Updated historical chart data with real-time points:', {
              flowRate: updated.flowRate.data.length,
              pressure: updated.pressure.data.length,
              temperature: updated.temperature.data.length,
              latestFlowRate: data.flowRate,
              latestPressure: data.pressure,
              latestTemperature: data.temperature
            });
            
            return updated;
          });
          
          // Update individual metric arrays for backward compatibility
          setFlowRateData(prev => {
            const newData = [...prev, data.flowRate || 0];
            return newData.length > maxRealtimePoints ? newData.slice(-maxRealtimePoints) : newData;
          });
          
          setPressureData(prev => {
            const newData = [...prev, data.pressure || 0];
            return newData.length > maxRealtimePoints ? newData.slice(-maxRealtimePoints) : newData;
          });
          
          setTemperatureData(prev => {
            const newData = [...prev, data.temperature || 0];
            return newData.length > maxRealtimePoints ? newData.slice(-maxRealtimePoints) : newData;
          });
          
          // Update timestamps for individual metrics
          setFlowRateTimestamps(prev => {
            const newTimestamps = [...prev, newTimestamp];
            return newTimestamps.length > maxRealtimePoints ? newTimestamps.slice(-maxRealtimePoints) : newTimestamps;
          });
          
          setPressureTimestamps(prev => {
            const newTimestamps = [...prev, newTimestamp];
            return newTimestamps.length > maxRealtimePoints ? newTimestamps.slice(-maxRealtimePoints) : newTimestamps;
          });
          
          setTemperatureTimestamps(prev => {
            const newTimestamps = [...prev, newTimestamp];
            return newTimestamps.length > maxRealtimePoints ? newTimestamps.slice(-maxRealtimePoints) : newTimestamps;
          });
          
          // Update last real-time update timestamp
          setLastRealtimeUpdate(new Date());
          
          // Force chart re-render by updating a key
          const chartUpdateKey = Date.now();
          console.log('✅ Real-time chart data updated successfully, chart key:', chartUpdateKey);
        }
        
        // Refresh stats data every few minutes when receiving real-time data
        const lastRefresh = sessionStorage.getItem(`stats-refresh-${deviceId}`);
        const now = Date.now();
        const refreshInterval = 5 * 60 * 1000; // 5 minutes
        
        if (!lastRefresh || now - parseInt(lastRefresh) > refreshInterval) {
          console.log('🔄 Refreshing stats due to real-time data');
          if (device && device.type) {
            fetchDeviceStats(device.type);
          }
          sessionStorage.setItem(`stats-refresh-${deviceId}`, now.toString());
        }
      } else {
        console.warn('⚠️ Received data for different device:', data.deviceId, 'expected:', deviceId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection for device:', deviceId);
      if (newSocket) {
        newSocket.emit('unsubscribe-device', deviceId);
        newSocket.disconnect();
      }
    };
  }, [deviceId]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/device/site/${siteId}/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      if (!res.ok) throw new Error('Failed to update device');
      
      // No need to reinitialize MQTT - it's handled by main backend now
      
      // Refresh device data
      const siteRes = await fetch(`${SITES_API_URL}/${siteId}`);
      const siteData = await siteRes.json();
      setSite(siteData);
      const updatedDevice = siteData.devices?.find((d: Device) => d.deviceId === deviceId);
      if (updatedDevice) {
        setDevice(updatedDevice);
        // Refresh device stats
        fetchDeviceStats(updatedDevice.type);
      }
      
      setConfigMode(false);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to update device');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/device/site/${siteId}/${deviceId}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to delete device');
      
      // No need to reinitialize MQTT - it's handled by main backend now
      
      // Redirect back to site page
      router.push(`/dashboard/sites/${siteId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete device');
      setLoading(false);
    }
  };

  console.log('🔍 Current state:', { loading, error, device: !!device, site: !!site, siteId, deviceId });

  if (loading) return (
    <DashboardLayout user={{
      name: session?.user?.name || '',
      email: session?.user?.email || '',
      role: session?.user?.role || '',
    }}>
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading device details...</p>
          <p className="text-sm text-gray-500 mt-2">Site ID: {siteId}</p>
          <p className="text-sm text-gray-500">Device ID: {deviceId}</p>
        </div>
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout user={{
      name: session?.user?.name || '',
      email: session?.user?.email || '',
      role: session?.user?.role || '',
    }}>
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Device</h3>
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Site ID: {siteId}</p>
          <p className="text-sm text-gray-500">Device ID: {deviceId}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    </DashboardLayout>
  );

  if (!device) {
    console.log('❌ Device is null, showing error state');
    return (
      <DashboardLayout user={{
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        role: session?.user?.role || '',
      }}>
        <div className="p-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">Device Not Found</h3>
            <p className="text-yellow-600">The requested device could not be loaded.</p>
            <p className="text-sm text-gray-500 mt-2">Site ID: {siteId}</p>
            <p className="text-sm text-gray-500">Device ID: {deviceId}</p>
            <button
              onClick={() => router.push(`/dashboard/sites/${siteId}`)}
              className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
            >
              Back to Site
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const user = {
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    role: session?.user?.role || '',
  };

  return (
    <DashboardLayout user={user}>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex gap-3 mb-4">

            <button
              onClick={() => router.push(`/dashboard/sites/${siteId}`)}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Site
            </button>

            <button
              onClick={() => setConfigMode(!configMode)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <CogIcon className="w-4 h-4" />
              {configMode ? 'Cancel' : 'Configure'}
            </button>
          </div>
                      {/* Historical Data Export Button for Water Devices */}
          {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && device?.type === 'water' && (
              <div className="flex items-center justify-between">

                <button
                  onClick={exportHistoricalData}
                  className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                  title="Export historical data to CSV"
                >
                  <ArrowDownTrayIcon className="w-3 h-3" />
                  Export Historical Data
                </button>
              </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getTypeIcon(device.type)}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{device.name}</h1>
                <p className="text-gray-600">Site: {site?.name}</p>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Device ID:</span>
              <span className="ml-2 font-mono text-gray-900">{device.deviceId}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 capitalize text-gray-900">{device.type}</span>
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>
              <span className="ml-2 text-gray-900">
                {device.lastReading ? new Date(device.lastReading.timestamp).toLocaleString() : 'Never'}  
              </span>
            </div>
          </div>
          

        {/* Device Info Summary */}
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Reading Interval</label>
              <p className="text-lg font-semibold text-gray-900">{device.readingInterval} s</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Threshold</label>
              <p className="text-lg font-semibold text-gray-900">{formatValue(device.type, device.threshold)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Maintenance Schedule</label>
              <p className="text-lg font-semibold text-gray-900 capitalize">{device.maintenanceSchedule || 'Not set'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Alerts</label>
              <p className="text-lg font-semibold text-gray-900">{device.alertEnabled !== false ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="text-lg font-semibold text-gray-900">{new Date(device.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Updated</label>
              <p className="text-lg font-semibold text-gray-900">{new Date(device.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
    
        </div>



        {/* Real-time Data Display */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Real-time Data</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {realtimeData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Main Value */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  {getTypeIcon(device?.type || 'unknown', 'w-6 h-6')}
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {device?.type === 'water' ? 'Consumption' : 
                     device?.type === 'energy' ? 'Energy' :
                     device?.type === 'gas' ? 'Gas Usage' :
                     device?.type === 'solar' ? 'Production' : 'Value'}
                  </h4>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatValue(device?.type || 'unknown', realtimeData.value || realtimeData.consumption)}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(realtimeData.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Flow Rate */}
              {realtimeData.flowRate !== null && realtimeData.flowRate !== undefined && (
                <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">↔</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Flow Rate</h4>
                  </div>
                  <div className="text-2xl font-bold text-cyan-600">
                    {(realtimeData.flowRate || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">L/min</div>
                </div>
              )}

              {/* Pressure */}
              {realtimeData.pressure !== null && realtimeData.pressure !== undefined && (
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Pressure</h4>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {(realtimeData.pressure || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">bar</div>
                </div>
              )}

              {/* Temperature */}
              {realtimeData.temperature !== null && realtimeData.temperature !== undefined && (
                <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">°C</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Temperature</h4>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {(realtimeData.temperature || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">°C</div>
                </div>
              )}

              {/* Power (for energy/solar devices) */}
              {realtimeData.power !== null && realtimeData.power !== undefined && (
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <BoltIcon className="w-6 h-6 text-yellow-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">Power</h4>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {(realtimeData.power || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">kW</div>
                </div>
              )}

              {/* Humidity */}
              {realtimeData.humidity !== null && realtimeData.humidity !== undefined && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">%</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Humidity</h4>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {realtimeData.humidity.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">%</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <SignalIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Waiting for real-time data...</p>
              <p className="text-sm">
                {isConnected ? 'Connected - waiting for device data' : 'Connecting to real-time feed...'}
              </p>
            </div>
          )}
        </div>


        {/* Configuration Mode */}
        {configMode && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Configuration</h2>
            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                  <input
                    type="text"
                    value={configData.name || ''}
                    onChange={(e) => setConfigData({...configData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={configData.status || 'active'}
                    onChange={(e) => setConfigData({...configData, status: e.target.value as 'active' | 'inactive' | 'maintenance'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configData.threshold || 0}
                    onChange={(e) => setConfigData({...configData, threshold: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reading Interval (minutes)</label>
                  <input
                    type="number"
                    value={configData.readingInterval || 5}
                    onChange={(e) => setConfigData({...configData, readingInterval: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={configData.description || ''}
                  onChange={(e) => setConfigData({...configData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Device description..."
                />
              </div>
              <div className="flex justify-between">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDevice}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2 ml-auto"
                  disabled={loading}
                >
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Delete Device
                </button>
              </div>
            </form>
          </div>
        )}











        {device.type === 'energy' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3 mb-3">
                <BoltIcon className="w-8 h-8 text-blue-500" />
                <h3 className="text-lg font-semibold">Energy Monitor</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Consumption:</span>
                  <span className="font-medium">{device.lastReading ? formatValue('energy', device.lastReading.value) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Power:</span>
                  <span className="font-medium">{device.lastReading?.power ? `${device.lastReading.power} kW` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {device.type === 'gas' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3 mb-3">
                <FireIcon className="w-8 h-8 text-red-500" />
                <h3 className="text-lg font-semibold">Gas Monitor</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Consumption:</span>
                  <span className="font-medium">{device.lastReading ? formatValue('gas', device.lastReading.value) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Flow Rate:</span>
                  <span className="font-medium">{device.lastReading?.flowRate ? `${device.lastReading.flowRate} m³/h` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {device.type === 'solar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3 mb-3">
                <SunIcon className="w-8 h-8 text-yellow-500" />
                <h3 className="text-lg font-semibold">Solar Monitor</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Production:</span>
                  <span className="font-medium">{device.lastReading ? formatValue('solar', device.lastReading.value) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Output:</span>
                  <span className="font-medium">{device.lastReading?.power ? `${device.lastReading.power} kW` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Water Metrics Chart - Only for Water Devices */}
        {device?.type === 'water' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-lg">🌊</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Water Metrics</h3>
                  <p className="text-sm text-gray-500">Real-time monitoring of water system parameters</p>
                </div>
                
                {/* Enhanced Real-time indicator with timestamp */}
                {lastRealtimeUpdate && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-700 font-semibold">LIVE</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Last update: {lastRealtimeUpdate.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Enhanced Metric Selector with current values */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Select Metric:</span>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value as 'flowRate' | 'pressure' | 'temperature')}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  >
                    <option value="flowRate">Flow Rate (L/min)</option>
                    <option value="pressure">Pressure (bar)</option>
                    <option value="temperature">Temperature (°C)</option>
                  </select>
                </div>
                
                                  {/* Current Value Display */}
                  {(() => {
                    // Use real-time data from WebSocket if available
                    let currentValue = null;
                    let currentTimestamp = null;
                    
                                         if (realtimeData) {
                       // Use the real-time data from WebSocket
                       switch(selectedMetric) {
                         case 'flowRate':
                           currentValue = realtimeData.flowRate;
                           break;
                         case 'pressure':
                           currentValue = realtimeData.pressure;
                           break;
                         case 'temperature':
                           currentValue = realtimeData.temperature;
                           break;
                       }
                       currentTimestamp = realtimeData.timestamp;
                     } else {
                       // Use the real-time data points from state
                       const currentRealtimeData = realtimeDataPoints[selectedMetric];
                       if (currentRealtimeData && currentRealtimeData.data.length > 0) {
                         currentValue = currentRealtimeData.data[currentRealtimeData.data.length - 1];
                         currentTimestamp = currentRealtimeData.timestamps[currentRealtimeData.timestamps.length - 1];
                       }
                     }
                    
                    if (currentValue !== null && currentValue !== undefined) {
                      const getMetricUnit = (metric: string) => {
                        switch(metric) {
                          case 'flowRate': return 'L/min';
                          case 'pressure': return 'bar';
                          case 'temperature': return '°C';
                          default: return 'L/min';
                        }
                      };
                      

                    }
                    return null;
                  })()}
              </div>
            </div>
            
            {/* Time Range Selection for Water Metrics */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Real-time Mode</span>
                </div>
                
                {/* Connection Status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  {isConnected && (
                    <span className="text-xs text-blue-600">
                      • {deviceId}
                    </span>
                  )}
                  {lastRealtimeUpdate && (
                    <span className="text-xs text-gray-500">
                      • Last: {lastRealtimeUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                
                {/* Time Range Selection */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Time Range:</span>
                </div>
                    
                <div className="flex flex-wrap items-center gap-2">
                  {waterMetricsTimePeriods.map((period) => (
                    <button
                      key={period.value}
                      onClick={() => {
                        setWaterMetricsPeriod(period.value);
                        setShowWaterMetricsCustomPicker(period.value === 'custom');
                      }}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        waterMetricsPeriod === period.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
                
                {showWaterMetricsCustomPicker && (
                  <div className="flex items-center gap-2">
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateTimePicker
                        label="From"
                        value={waterMetricsCustomFrom}
                        onChange={setWaterMetricsCustomFrom}
                        slotProps={{ 
                          textField: { 
                            size: 'small',
                            className: 'w-32'
                          } 
                        }}
                      />
                      <span className="text-gray-500">to</span>
                      <DateTimePicker
                        label="To"
                        value={waterMetricsCustomTo}
                        onChange={setWaterMetricsCustomTo}
                        slotProps={{ 
                          textField: { 
                            size: 'small',
                            className: 'w-32'
                          } 
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      console.log('🌊 Refreshing water metrics data...');
                      fetchAdditionalMetrics(device.type);
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Refresh
                  </button>
                  <div className="text-xs text-gray-500">
                    {(() => {
                      const { from, to } = getWaterMetricsDateRange();
                      const fromDate = new Date(from).toLocaleString();
                      const toDate = new Date(to).toLocaleString();
                      return `${fromDate} - ${toDate}`;
                    })()}
                  </div>
                </div>
                

              </div>
            </div>
            
            {(() => {
              // Use only historical data, ignore real-time data
              const historicalData = combinedChartData[selectedMetric];
              const realtimeData = realtimeDataPoints[selectedMetric];
              

              
              // Use only historical data, ignore real-time data
              let currentData = { ...historicalData };
              let isUsingRealtimeData = false;
              
              // Comment out the real-time data combination logic
              /*
              if (realtimeData && realtimeData.data.length > 0) {
                // Check data continuity
                const { historicalData: checkedHistorical, realtimeData: checkedRealtime } = ensureDataContinuity(historicalData, realtimeData);
                
                // Combine historical data with real-time data
                console.log('🔗 Combining historical and real-time data:', {
                  historicalLength: checkedHistorical?.data?.length || 0,
                  realtimeLength: checkedRealtime.data.length,
                  lastHistorical: checkedHistorical?.data?.slice(-1),
                  firstRealtime: checkedRealtime.data.slice(0, 1),
                  lastHistoricalTimestamp: checkedHistorical?.timestamps?.slice(-1),
                  firstRealtimeTimestamp: checkedRealtime.timestamps.slice(0, 1)
                });
                
                // Ensure smooth transition by checking if we need to adjust real-time data
                let adjustedRealtimeData = checkedRealtime;
                if (checkedHistorical && checkedHistorical.data.length > 0 && checkedRealtime.data.length > 0) {
                  const lastHistoricalValue = checkedHistorical.data[checkedHistorical.data.length - 1];
                  const firstRealtimeValue = checkedRealtime.data[0];
                  const valueDiff = Math.abs(firstRealtimeValue - lastHistoricalValue);
                  
                  // If there's a large value jump, create a smoother transition
                  if (valueDiff > 0.5) { // Threshold for value discontinuity
                    console.log('⚠️ Large value jump detected:', {
                      lastHistoricalValue,
                      firstRealtimeValue,
                      valueDiff
                    });
                    
                    // Create a transition point
                    const transitionValue = (lastHistoricalValue + firstRealtimeValue) / 2;
                    const transitionTimestamp = new Date(checkedRealtime.timestamps[0].getTime() - 1000); // 1 second before
                    
                    adjustedRealtimeData = {
                      data: [transitionValue, ...checkedRealtime.data],
                      timestamps: [transitionTimestamp, ...checkedRealtime.timestamps]
                    };
                    
                    console.log('🔗 Added transition point:', {
                      transitionValue,
                      transitionTimestamp
                    });
                  }
                }
                
                currentData = {
                  data: [...checkedHistorical.data, ...adjustedRealtimeData.data],
                  timestamps: [...checkedHistorical.timestamps, ...adjustedRealtimeData.timestamps]
                };
                isUsingRealtimeData = true;
              }
              */
              
              // Apply zoom to the data
              const zoomedData = getZoomedData(currentData.data, currentData.timestamps);
              currentData = zoomedData;
              
              const hasDataForMetric = currentData && currentData.data.length > 0 && currentData.data.some((v: number) => v > 0);
              
              if (hasDataForMetric) {
                const getMetricColor = (metric: string) => {
                  switch(metric) {
                    case 'flowRate': return '#0891b2';
                    case 'pressure': return '#9333ea';
                    case 'temperature': return '#dc2626';
                    default: return '#0891b2';
                  }
                };
                
                const getMetricLabel = (metric: string) => {
                  switch(metric) {
                    case 'flowRate': return 'Flow Rate';
                    case 'pressure': return 'Pressure';
                    case 'temperature': return 'Temperature';
                    default: return 'Flow Rate';
                  }
                };
                
                const getMetricUnit = (metric: string) => {
                  switch(metric) {
                    case 'flowRate': return 'L/min';
                    case 'pressure': return 'bar';
                    case 'temperature': return '°C';
                    default: return 'L/min';
                  }
                };
                
                return (
                  <div>
                    {/* Data Source Indicator */}

                    
                    <div className="relative">
                      <LineChart
                        key={`${selectedMetric}-${lastRealtimeUpdate?.getTime() || Date.now()}`}
                        xAxis={[{ 
                          data: currentData.timestamps.length > 0 ? currentData.timestamps : periodLabels.map(d => new Date(d)), 
                          label: 'Time',
                          valueFormatter: (value: any) => {
                            const date = value instanceof Date ? value : new Date(value);
                            if (isNaN(date.getTime())) {
                              return 'Invalid Date';
                            }
                            return date.toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          },
                          tickLabelStyle: {
                            fontSize: 12,
                            fill: '#6b7280'
                          },
                          labelStyle: {
                            fontSize: 14,
                            fontWeight: 600,
                            fill: '#374151'
                          }
                        }]}
                        yAxis={[{
                          label: `${getMetricLabel(selectedMetric)} (${getMetricUnit(selectedMetric)})`,
                          tickLabelStyle: {
                            fontSize: 12,
                            fill: '#6b7280'
                          },
                          labelStyle: {
                            fontSize: 14,
                            fontWeight: 600,
                            fill: '#374151'
                          }
                        }]}
                                              series={[{ 
                        data: currentData.data, 
                        label: getMetricLabel(selectedMetric),
                        color: getMetricColor(selectedMetric),
                        curve: 'monotoneX',
                        area: false,
                        showMark: false // Remove dots to show only the line
                      }]}
                        height={350}
                        grid={{ 
                          vertical: true, 
                          horizontal: true
                        }}
                        margin={{
                          left: 80,
                          right: 40,
                          top: 40,
                          bottom: 60
                        }}
                        axisHighlight={{
                          x: 'line',
                          y: 'line'
                        }}
                      />
                      
                      {/* Zoom Controls */}
                      <div className="absolute top-2 right-2 flex gap-2">
                        {/* Zoom Level Indicator */}
                        <div className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-600 font-mono">
                          {zoomLevel.toFixed(1)}x
                        </div>
                        <button
                          onClick={handleZoomIn}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center"
                          title={`Zoom In (${zoomLevel.toFixed(1)}x)`}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={handleZoomOut}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center"
                          title={`Zoom Out (${zoomLevel.toFixed(1)}x)`}
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h6" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={handleResetZoom}
                          className="w-8 h-8 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center"
                          title="Reset Zoom"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>


                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 text-2xl">🌊</span>
                    </div>
                    <p className="text-lg font-medium mb-2">No {selectedMetric} data available</p>
                    <p className="text-sm text-gray-400">Try selecting a different metric or check if data is being collected</p>
                  </div>
                );
              }
            })()}
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Unit:</span>
                    <span className="text-sm text-gray-900 font-semibold">{(() => {
                      switch(selectedMetric) {
                        case 'flowRate': return 'L/min';
                        case 'pressure': return 'bar';
                        case 'temperature': return '°C';
                        default: return 'L/min';
                      }
                    })()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Data Points:</span>
                    <span className="text-sm text-gray-900 font-semibold">{(() => {
                      const realtimeData = realtimeDataPoints[selectedMetric];
                      const historicalData = combinedChartData[selectedMetric];
                      const currentData = (realtimeData && realtimeData.data.length > 0) ? realtimeData : historicalData;
                      return currentData?.data?.length || 0;
                    })()}</span>
                  </div>
                  {(() => {
                    const realtimeData = realtimeDataPoints[selectedMetric];
                    return realtimeData && realtimeData.data.length > 0;
                  })() && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-700 font-semibold">Real-time</span>
                    </div>
                  )}
                  
                  {/* Enhanced Connection Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Connection:</span>
                    {isConnected ? (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-700 font-semibold">Connected</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm text-red-700 font-semibold">Disconnected</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-gray-600">{(() => {
                      const realtimeData = realtimeDataPoints[selectedMetric];
                      return realtimeData && realtimeData.data.length > 0 ? 'Historical + Real-time data' : 'Historical data (waiting for real-time)';
                    })()}</span>
                    {lastRealtimeUpdate && (
                      <span className="text-xs text-gray-500">
                        Updated: {lastRealtimeUpdate.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Device Consumption Charts - Moved below Water Metrics */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          {/* Time Period Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mb-4">
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

          {/* Chart Display */}
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Daily Consumption Chart
            </h3>
            {(user.role === 'superadmin' || user.role === 'admin' || user.role === 'user') && chartData && chartData.length > 0 && (
              <button
                onClick={exportChartData}
                className="px-3 py-1 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                title="Export chart data to CSV"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export Chart Data
              </button>
            )}
          </div>
          {chartType === 'line' ? (
            <LineChart
              xAxis={[{ 
                data: chartLabels.map(d => new Date(d)), 
                label: 'Date',
                valueFormatter: (value: any) => {
                  // Ensure we have a valid Date object
                  const date = value instanceof Date ? value : new Date(value);
                  if (isNaN(date.getTime())) {
                    return 'Invalid Date';
                  }
                  return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: getGranularity() === 'hour' ? '2-digit' : undefined,
                    minute: getGranularity() === 'hour' ? '2-digit' : undefined
                  });
                }
              }]}
              series={[{ 
                data: chartData, 
                label: device?.type === 'energy' ? 'Energy' :
                       device?.type === 'solar' ? 'Solar' :
                       device?.type === 'water' ? 'Water' :
                       device?.type === 'gas' ? 'Gas' : 'Consumption',
                color: device?.type === 'energy' ? '#3B82F6' :
                       device?.type === 'solar' ? '#22C55E' :
                       device?.type === 'water' ? '#9333EA' :
                       device?.type === 'gas' ? '#EF4444' : '#6366F1',
                curve: 'linear',
                area: true
              }]}
              height={350}
              grid={{ vertical: true, horizontal: true }}
            />
          ) : (
            <BarChart
              xAxis={[{ 
                data: chartLabels.map(d => {
                  const date = new Date(d);
                  return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: getGranularity() === 'hour' ? '2-digit' : undefined,
                    minute: getGranularity() === 'hour' ? '2-digit' : undefined
                  });
                }), 
                label: 'Date' 
              }]}
              series={[{ 
                data: chartData, 
                label: device?.type === 'energy' ? 'Energy' :
                       device?.type === 'solar' ? 'Solar' :
                       device?.type === 'water' ? 'Water' :
                       device?.type === 'gas' ? 'Gas' : 'Consumption',
                color: device?.type === 'energy' ? '#3B82F6' :
                       device?.type === 'solar' ? '#22C55E' :
                       device?.type === 'water' ? '#9333EA' :
                       device?.type === 'gas' ? '#EF4444' : '#6366F1'
              }]}
              height={350}
            />
          )}
          
          {/* Device Statistics with Consumption Analysis */}
          {deviceStats && deviceStats.data.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Device Statistics ({getGranularity() === 'hour' ? 'Hourly' : getGranularity() === 'day' ? 'Daily' : getGranularity() === 'week' ? 'Weekly' : 'Monthly'} Data)
                </h3>
                <div className="text-sm text-gray-500">
                  {deviceStats.data.length} data points
                </div>
              </div>
              
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowTrendingUpIcon className="w-6 h-6 text-green-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">Total Consumption</h4>
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    {formatValue(device.type, deviceStats.data.reduce((sum, d: DeviceStatsDataPoint) => sum + (d.totalIndex || 0), 0))}
                  </div>
                  <div className="text-xs text-gray-500">Selected period</div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <ChartBarIcon className="w-6 h-6 text-blue-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">Average per {getGranularity()}</h4>
                  </div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatValue(device.type, deviceStats.data.length > 0 ? deviceStats.data.reduce((sum, d: DeviceStatsDataPoint) => sum + (d.totalIndex || 0), 0) / deviceStats.data.length : 0)}
                  </div>
                  <div className="text-xs text-gray-500">Average consumption</div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowTrendingUpIcon className="w-6 h-6 text-purple-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">Peak Consumption</h4>
                  </div>
                  <div className="text-xl font-bold text-purple-600">
                    {formatValue(device.type, deviceStats.data.length > 0 ? Math.max(...deviceStats.data.map((d: DeviceStatsDataPoint) => d.totalIndex || 0)) : 0)}
                  </div>
                  <div className="text-xs text-gray-500">Highest {getGranularity()}ly usage</div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <ClockIcon className="w-6 h-6 text-yellow-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">Data Points</h4>
                  </div>
                  <div className="text-xl font-bold text-yellow-600">
                    {deviceStats.data.length}
                  </div>
                  <div className="text-xs text-gray-500">Data periods</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}