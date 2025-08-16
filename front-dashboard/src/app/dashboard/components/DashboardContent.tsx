'use client';

import { 
  ChartBarIcon, 
  BoltIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import MapWrapper from './MapWrapper';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TextField from '@mui/material/TextField';
import { API_CONFIG, buildApiUrl } from '../../../config/api';

const SITES_API_URL = buildApiUrl('/api/sites');
const DATA_API_URL = buildApiUrl('/api/data');

console.log('API URLs:', { SITES_API_URL, DATA_API_URL, BACKEND_URL: API_CONFIG.BACKEND_URL });

async function fetchGlobalStats({
  siteIds,
  from,
  to,
  granularity,
  type,
  field
}: {
  siteIds: string[],
  from: string,
  to: string,
  granularity: string,
  type: string,
  field: string
}) {
  const res = await fetch(`${DATA_API_URL}/global/${type}/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Pass the selected window and granularity so backend aggregates correctly
    body: JSON.stringify({ siteIds, from, to, granularity })
  });
  if (!res.ok) throw new Error('Failed to fetch global stats');
  return res.json();
}

// Time period options
const timePeriods = [
  { label: '7d', value: '7d', granularity: 'day' },
  { label: '30d', value: '30d', granularity: 'day' },
  { label: 'Custom', value: 'custom', granularity: 'day' }
];

export default function DashboardContent() {
  const { data: session, status } = useSession();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [energyData, setEnergyData] = useState<number[]>([]);
  const [waterData, setWaterData] = useState<number[]>([]);
  const [gasData, setGasData] = useState<number[]>([]);
  
  // Chart labels state
  const [energyLabels, setEnergyLabels] = useState<string[]>([]);
  const [waterLabels, setWaterLabels] = useState<string[]>([]);
  const [gasLabels, setGasLabels] = useState<string[]>([]);

  // Time period state
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState(''); // used for fetching
  const [customTo, setCustomTo] = useState('');     // used for fetching
  // Add draft states for the date pickers (now as Date | null)
  const [draftCustomFrom, setDraftCustomFrom] = useState<Date | null>(null);
  const [draftCustomTo, setDraftCustomTo] = useState<Date | null>(null);

  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);

  // Add state for latest index values
  const [energyIndex, setEnergyIndex] = useState<number | null>(null);
  const [waterIndex, setWaterIndex] = useState<number | null>(null);
  const [gasIndex, setGasIndex] = useState<number | null>(null);

  // Helper to format values
  function formatValue(type: string, value: number) {
    switch (type) {
      case 'energy':
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
    if (!data || data.length < 2) return { change: '0%', changeType: 'increase' };
    const prev = data[data.length - 2];
    const curr = data[data.length - 1];
    if (prev === 0) return { change: '+0%', changeType: 'increase' };
    const percent = ((curr - prev) / Math.abs(prev)) * 100;
    return {
      change: (percent >= 0 ? '+' : '') + percent.toFixed(1) + '%',
      changeType: percent >= 0 ? 'increase' : 'decrease',
    };
  }

  // Compute real stats
  const energyTotal = energyData.reduce((a, b) => a + b, 0);
  const waterTotal = waterData.reduce((a, b) => a + b, 0);
  const gasTotal = gasData.reduce((a, b) => a + b, 0);

  const energyChange = calcChange(energyData);
  const waterChange = calcChange(waterData);
  const gasChange = calcChange(gasData);

  // Helper function to check if data has meaningful values (non-zero)
  const hasData = (data: number[]) => {
    return data.length > 0 && data.some(value => value > 0);
  };

  // Get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    
    // Adjust for timezone offset to get local midnight
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;
    
    // Set to end of current day for consistent period boundaries (local time)
    const to = new Date(now.getTime() - timezoneOffset + 24 * 60 * 60 * 1000 - 1).toISOString();
    let from: string;

    switch (selectedPeriod) {
      case '7d':
        // Calculate exactly 7 days ago, starting from beginning of that day (local time)
        // Add one day to compensate for timezone shift that causes data to appear on wrong day
        const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        from = new Date(sevenDaysAgo.getTime() - timezoneOffset).toISOString();
        break;
      case '30d':
        // Add one day to compensate for timezone shift
        const thirtyDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        from = new Date(thirtyDaysAgo.getTime() - timezoneOffset).toISOString();
        break;
      case 'custom':
        if (customFrom && customTo) {
          return { from: customFrom, to: customTo };
        }
        // Fallback to 7d if custom dates not set
        const fallbackDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        from = new Date(fallbackDate.getTime() - timezoneOffset).toISOString();
        break;
      default:
        const defaultDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        from = new Date(defaultDate.getTime() - timezoneOffset).toISOString();
    }

    return { from, to };
  };

  // Get granularity based on selected period
  const getGranularity = () => {
    const period = timePeriods.find(p => p.value === selectedPeriod);
    return period?.granularity || 'day';
  };

  // Helper function to fill missing periods with zeros
  const fillMissingPeriods = (data: any[], fromDate: string, toDate: string, granularity: string) => {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const periods: { [key: string]: number } = {};
    const labels: string[] = [];
    
    console.log('fillMissingPeriods called with:', { fromDate, toDate, granularity, dataLength: data.length });
    console.log('Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });
    
    // Initialize all periods with zero
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      let periodKey: string;
      let label: string;
      
      switch (granularity) {
        case 'day':
          // Use consistent date format that matches backend expectations
          // For daily data, we want to match the backend's date format exactly
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
    
    console.log('Initialized periods:', periods);
    console.log('Initialized labels:', labels);
    
    // Fill in actual data - handle both period and date formats from backend
    data.forEach(item => {
      let key = item.period;
      
      // If the backend returns a date instead of period, convert it to our period format
      if (item.date) {
        const itemDate = new Date(item.date);
        key = itemDate.toISOString().slice(0, 10);
      }
      
      console.log('Processing item:', item, 'key:', key, 'periods has key:', periods.hasOwnProperty(key));
      
      // Also handle cases where the backend might return the period in a different format
      if (periods.hasOwnProperty(key)) {
        periods[key] = item.total || item.value || 0;
      }
    });
    
    console.log('After filling data, periods:', periods);
    
    // Convert to sorted array
    const sortedEntries = Object.entries(periods)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
    
    const result = {
      values: sortedEntries.map(([_, total]) => total),
      labels: labels
    };
    
    console.log('Final result:', result);
    return result;
  };

  // Helper function to make data responsive
  const makeDataResponsive = (values: number[], labels: string[]) => {
    // For now, return all data points - we'll handle responsiveness in the chart component
    return { values, labels };
  };

  // Helper function to export chart data as CSV
  const exportChartData = (data: number[], labels: string[], chartType: string) => {
    if (!data || !labels || data.length === 0) {
      alert('No data available to export');
      return;
    }

    // Create CSV content
    const csvContent = [
      ['Date', `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Value`],
      ...labels.map((label, index) => [label, data[index]?.toString() || '0'])
    ].map(row => row.join(',')).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${chartType}_data_${selectedPeriod}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export button component
  const ExportButton = ({ 
    onClick, 
    disabled = false 
  }: { 
    onClick: () => void, 
    disabled?: boolean 
  }) => (
    <button
      className={`absolute top-2 right-12 z-10 bg-white rounded-full p-1 shadow hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Export chart data"
      type="button"
    >
      <ArrowDownTrayIcon className="w-5 h-5 text-gray-500" />
    </button>
  );

  // Time period selector component
  const TimePeriodSelector = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Time Period:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {timePeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => {
                setSelectedPeriod(period.value);
                if (period.value === 'custom') {
                  // When switching to custom, initialize drafts from current values
                  setDraftCustomFrom(customFrom ? new Date(customFrom) : null);
                  setDraftCustomTo(customTo ? new Date(customTo) : null);
                }
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
        {selectedPeriod === 'custom' && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
              <DateTimePicker
                label="From"
                value={draftCustomFrom}
                onChange={(date: Date | null) => setDraftCustomFrom(date)}
                slotProps={{
                  textField: { size: "small" }
                }}
                format="yyyy-MM-dd HH:mm"
              />
              <span className="text-gray-500">to</span>
              <DateTimePicker
                label="To"
                value={draftCustomTo}
                onChange={(date: Date | null) => setDraftCustomTo(date)}
                slotProps={{
                  textField: { size: "small" }
                }}
                format="yyyy-MM-dd HH:mm"
              />
              <button
                className={`ml-2 px-3 py-1 text-sm rounded-md bg-blue-500 text-white disabled:bg-gray-300 disabled:text-gray-500`}
                disabled={
                  !draftCustomFrom || !draftCustomTo ||
                  (customFrom === (draftCustomFrom ? draftCustomFrom.toISOString() : '') &&
                   customTo === (draftCustomTo ? draftCustomTo.toISOString() : ''))
                }
                onClick={() => {
                  setCustomFrom(draftCustomFrom ? draftCustomFrom.toISOString() : '');
                  setCustomTo(draftCustomTo ? draftCustomTo.toISOString() : '');
                }}
                type="button"
              >
                Apply
              </button>
            </div>
          </LocalizationProvider>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (!session?.user) return;

    const fetchSites = async () => {
      setLoading(true);
      try {
        let url = `${SITES_API_URL}`;
        if (session.user.role !== 'superadmin') {
          url = `${SITES_API_URL}/user/${session.user.id}`;
        }
        console.log('Fetching sites from URL:', url);
        const res = await fetch(url);
        console.log('Sites API response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Sites API error response:', errorText);
          throw new Error(`Failed to fetch sites: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        console.log('Sites API raw response:', data);
        // Ensure data is an array
        if (Array.isArray(data)) {
          setSites(data);
          console.log('Fetched sites:', data);
        } else {
          console.error('Sites API returned non-array data:', data);
          setSites([]);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        setSites([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [session]);

  useEffect(() => {
    if (!session?.user || !Array.isArray(sites) || sites.length === 0) return;

    const siteIds = sites.map((site: any) => site._id);
    const { from, to } = getDateRange();
    const granularity = getGranularity();

    console.log('Fetching stats with:', { siteIds, from, to, granularity, selectedPeriod });
    console.log('Date range details:', { 
      from: new Date(from).toISOString(), 
      to: new Date(to).toISOString(),
      fromLocal: new Date(from).toLocaleDateString(),
      toLocal: new Date(to).toLocaleDateString(),
      fromUTC: new Date(from).toUTCString(),
      toUTC: new Date(to).toUTCString(),
      timezoneOffset: new Date().getTimezoneOffset()
    });

    // Energy
    console.log('Fetching energy stats', { siteIds, from, to, granularity });
    fetchGlobalStats({
      siteIds,
      from,
      to,
      granularity,
      type: 'energy',
      field: 'value'
    }).then(data => {
      console.log('Energy raw data from backend:', data);
      const filledData = fillMissingPeriods(data, from, to, granularity);
      console.log('Energy filled data:', filledData);
      const responsiveData = makeDataResponsive(filledData.values, filledData.labels);
      setEnergyData(responsiveData.values);
      setEnergyLabels(responsiveData.labels);
    }).catch(error => {
      console.error('Error fetching energy stats:', error);
      setEnergyData([]);
      setEnergyLabels([]);
    });



    // Water
    console.log('Fetching water stats', { siteIds, from, to, granularity });
    fetchGlobalStats({
      siteIds,
      from,
      to,
      granularity,
      type: 'water',
      field: 'value'
    }).then(data => {
      console.log('Water raw data from backend:', data);
      const filledData = fillMissingPeriods(data, from, to, granularity);
      console.log('Water filled data:', filledData);
      const responsiveData = makeDataResponsive(filledData.values, filledData.labels);
      setWaterData(responsiveData.values);
      setWaterLabels(responsiveData.labels);
    }).catch(error => {
      console.error('Error fetching water stats:', error);
      setWaterData([]);
      setWaterLabels([]);
    });

    // Gas
    console.log('Fetching gas stats', { siteIds, from, to, granularity });
    fetchGlobalStats({
      siteIds,
      from,
      to,
      granularity,
      type: 'gas',
      field: 'value'
    }).then(data => {
      console.log('Gas raw data from backend:', data);
      const filledData = fillMissingPeriods(data, from, to, granularity);
      console.log('Gas filled data:', filledData);
      const responsiveData = makeDataResponsive(filledData.values, filledData.labels);
      setGasData(responsiveData.values);
      setGasLabels(responsiveData.labels);
    }).catch(error => {
      console.error('Error fetching gas stats:', error);
      setGasData([]);
      setGasLabels([]);
    });

    // Fetch latest index values for each type
    const fetchIndex = async (type: string, setter: (v: number) => void) => {
      try {
        const res = await fetch(`${DATA_API_URL}/global/${type}/index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteIds })
        });
        if (!res.ok) throw new Error('Failed to fetch index');
        const data = await res.json();
        // Use data.totalIndex as per your API response
        setter(data.totalIndex ?? data.value ?? data);
      } catch (e) {
        setter(0);
      }
    };
    fetchIndex('energy', setEnergyIndex);
    fetchIndex('water', setWaterIndex);
    fetchIndex('gas', setGasIndex);

  }, [session, sites, selectedPeriod, customFrom, customTo]);

  // Maximize button SVG
  const MaximizeButton = ({ onClick }: { onClick: () => void }) => (
    <button
      className="absolute top-2 right-2 z-10 bg-white rounded-full p-1 shadow hover:bg-gray-100"
      onClick={onClick}
      aria-label="Maximize chart"
      type="button"
    >
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4m12-4v4h-4" />
      </svg>
    </button>
  );

  // Modal for maximized chart
  const MaximizedChartModal = ({ energyMinLen, waterMinLen, gasMinLen }: { energyMinLen: number, waterMinLen: number, gasMinLen: number }) => {
    if (!maximizedChart) return null;
    let xAxis, series, chartTitle, chartType;
    if (maximizedChart === 'energy') {
      xAxis = [{ data: energyLabels.slice(0, energyMinLen) }];
      series = [{ data: energyData.slice(0, energyMinLen), label: 'Energy', color: '#3B82F6' }];
      chartTitle = 'Energy Consumption (kWh)';
      chartType = 'energy';
    } else if (maximizedChart === 'water') {
      xAxis = [{ data: waterLabels.slice(0, waterMinLen) }];
      series = [{ data: waterData.slice(0, waterMinLen), label: 'Water', color: '#9333EA' }];
      chartTitle = 'Water Usage (m³)';
      chartType = 'water';
    } else if (maximizedChart === 'gas') {
      xAxis = [{ data: gasLabels.slice(0, gasMinLen) }];
      series = [{ data: gasData.slice(0, gasMinLen), label: 'Gas', color: '#EF4444' }];
      chartTitle = 'Gas Usage (m³)';
      chartType = 'gas';
    } else {
      return null;
    }
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 w-[95vw] max-w-6xl h-[80vh] relative flex flex-col">
          <button
            className="absolute top-2 right-2 z-10 bg-white rounded-full p-1 shadow hover:bg-gray-100"
            onClick={() => setMaximizedChart(null)}
            aria-label="Close"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            className="absolute top-2 right-12 z-10 bg-white rounded-full p-1 shadow hover:bg-gray-100"
            onClick={() => {
              if (chartType === 'energy') {
                exportChartData(energyData.slice(0, energyMinLen), energyLabels.slice(0, energyMinLen), 'energy');
              } else if (chartType === 'water') {
                exportChartData(waterData.slice(0, waterMinLen), waterLabels.slice(0, waterMinLen), 'water');
              } else if (chartType === 'gas') {
                exportChartData(gasData.slice(0, gasMinLen), gasLabels.slice(0, gasMinLen), 'gas');
              }
            }}
            aria-label="Export chart data"
            type="button"
          >
            <ArrowDownTrayIcon className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-semibold text-center mb-4">{chartTitle}</h2>
          <div className="flex-1 flex items-center justify-center">
            <BarChart xAxis={xAxis} series={series} height={500} />
          </div>
        </div>
      </div>
    );
  };

  // Helper function to calculate statistics for a dataset
  const calculateStats = (data: number[]) => {
    if (!data || data.length === 0) {
      return {
        total: 0,
        average: 0,
        peak: 0,
        dataPoints: 0
      };
    }

    const nonZeroData = data.filter(value => value > 0);
    const total = data.reduce((sum, value) => sum + value, 0);
    const average = data.length > 0 ? total / data.length : 0;
    const peak = Math.max(...data);
    const dataPoints = nonZeroData.length;

    return { total, average, peak, dataPoints };
  };

  // Statistics cards component
  const StatisticsCards = ({ 
    data, 
    type, 
    unit 
  }: { 
    data: number[], 
    type: string, 
    unit: string 
  }) => {
    const stats = calculateStats(data);
    
    const formatValue = (value: number) => {
      if (type === 'energy') {
        return value.toFixed(1) + ' kWh';
      } else if (type === 'water') {
        return value.toFixed(3) + ' m³';
      } else if (type === 'gas') {
        return value.toFixed(1) + ' m³';
      }
      return value.toFixed(2) + ' ' + unit;
    };

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {/* Total Consumption */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center">
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-green-800">Total Consumption</p>
              <p className="text-sm font-bold text-green-900">{formatValue(stats.total)}</p>
              <p className="text-xs text-green-600">Selected period</p>
            </div>
          </div>
        </div>

        {/* Average per day */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center">
            <ChartBarIcon className="w-5 h-5 text-blue-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-blue-800">Average per day</p>
              <p className="text-sm font-bold text-blue-900">{formatValue(stats.average)}</p>
              <p className="text-xs text-blue-600">Average consumption</p>
            </div>
          </div>
        </div>

        {/* Peak Consumption */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center">
            <BoltIcon className="w-5 h-5 text-purple-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-purple-800">Peak Consumption</p>
              <p className="text-sm font-bold text-purple-900">{formatValue(stats.peak)}</p>
              <p className="text-xs text-purple-600">Highest daily usage</p>
            </div>
          </div>
        </div>

        {/* Data Points */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center">
            <CalendarIcon className="w-5 h-5 text-yellow-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-yellow-800">Data Points</p>
              <p className="text-sm font-bold text-yellow-900">{stats.dataPoints}</p>
              <p className="text-xs text-yellow-600">Data periods</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div>Loading sites...</div>;

  // Calculate minLen for each chart to ensure xAxis and series data lengths match
  const energyMinLen = Math.min(energyLabels.length, energyData.length);
  const waterMinLen = Math.min(waterLabels.length, waterData.length);
  const gasMinLen = Math.min(gasLabels.length, gasData.length);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
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
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Energy Consumption</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                  {formatValue('energy', energyIndex !== null ? energyIndex : energyTotal)}
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
              <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last hour</span>
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
                  {formatValue('water', waterIndex !== null ? waterIndex : waterTotal)}
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
              <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last hour</span>
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
                  {formatValue('gas', gasIndex !== null ? gasIndex : gasTotal)}
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
              <span className="ml-2 text-xs sm:text-sm text-gray-500 hidden sm:inline">from last hour</span>
            </div>
          </div>
        )}

        {/* Show message when no stats have data */}
        {!hasData(energyData) && !hasData(waterData) && !hasData(gasData) && (
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
        } else {
          gridClasses = 'grid grid-cols-1'; // Default case
        }

        return (
          <div className={`${gridClasses} gap-4 sm:gap-6`}>
            {/* Energy Chart - Only show if it has data */}
            {hasData(energyData) && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
                <MaximizeButton onClick={() => setMaximizedChart('energy')} />
                <ExportButton 
                  onClick={() => exportChartData(energyData.slice(0, energyMinLen), energyLabels.slice(0, energyMinLen), 'energy')}
                  disabled={!hasData(energyData)}
                />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Energy Consumption (kWh)</h3>
                <BarChart
                  xAxis={[{ data: energyLabels.slice(0, energyMinLen) }]}
                  series={[{ data: energyData.slice(0, energyMinLen), label: 'Energy', color: '#3B82F6' }]}
                  height={chartsWithData === 1 ? 400 : 300} // Taller chart when it's the only one
                />
                <StatisticsCards data={energyData} type="energy" unit="kWh" />
              </div>
            )}

            {/* Water Chart - Only show if it has data */}
            {hasData(waterData) && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
                <MaximizeButton onClick={() => setMaximizedChart('water')} />
                <ExportButton 
                  onClick={() => exportChartData(waterData.slice(0, waterMinLen), waterLabels.slice(0, waterMinLen), 'water')}
                  disabled={!hasData(waterData)}
                />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Water Usage (m³)</h3>
                <BarChart
                  xAxis={[{ data: waterLabels.slice(0, waterMinLen) }]}
                  series={[{ data: waterData.slice(0, waterMinLen), label: 'Water', color: '#9333EA' }]}
                  height={chartsWithData === 1 ? 400 : 300} // Taller chart when it's the only one
                />
                <StatisticsCards data={waterData} type="water" unit="m³" />
              </div>
            )}

            {/* Gas Chart - Only show if it has data */}
            {hasData(gasData) && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
                <MaximizeButton onClick={() => setMaximizedChart('gas')} />
                <ExportButton 
                  onClick={() => exportChartData(gasData.slice(0, gasMinLen), gasLabels.slice(0, gasMinLen), 'gas')}
                  disabled={!hasData(gasData)}
                />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Gas Usage (m³)</h3>
                <BarChart
                  xAxis={[{ data: gasLabels.slice(0, gasMinLen) }]}
                  series={[{ data: gasData.slice(0, gasMinLen), label: 'Gas', color: '#EF4444' }]}
                  height={chartsWithData === 1 ? 400 : 300} // Taller chart when it's one
                />
                <StatisticsCards data={gasData} type="gas" unit="m³" />
              </div>
            )}

            {/* Show message when no charts have data */}
            {!hasData(energyData) && !hasData(waterData) && !hasData(gasData) && (
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

      {/* Map */}
      <div className="bg-white rounded-lg shadow">
        <div className="h-64 sm:h-80 md:h-96">
          <MapWrapper sites={sites} />
        </div>
      </div>

      {/* Maximized Chart Modal */}
      <MaximizedChartModal 
        energyMinLen={energyMinLen}
        waterMinLen={waterMinLen}
        gasMinLen={gasMinLen}
      />
    </div>
  );
} 