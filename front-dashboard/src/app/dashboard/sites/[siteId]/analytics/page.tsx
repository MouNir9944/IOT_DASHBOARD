'use client';
// Water Analytics Page - Shows water consumption data for a specific site
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon, CloudIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { BarChart, PieChart } from '@mui/x-charts';
import { useSession } from 'next-auth/react';
import { useLanguage } from '../../../../../contexts/LanguageContext';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';

export default function SiteAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const siteId = params?.siteId as string;
  const { data: session } = useSession();
  
  const metricOptions = [
    { value: 'water', label: t('devices.water'), icon: CloudIcon },
  ];
  const periodOptions = [
    { value: 'month', label: t('analytics.monthlyConsumption') },
    { value: 'year', label: t('analytics.yearlyConsumption') },
    { value: 'custom', label: t('common.custom') },
  ];
  
  const [siteName, setSiteName] = useState<string>('');
  const [metric, setMetric] = useState('water');
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);          
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'; // TODO: change to /api/sites/data/site/{siteId}/devices?type={type}
  
  // Export functions
  const exportBarChartData = () => {
    if (!compareData || compareData.length === 0) {
      alert('No data available to export');
      return;
    }
    
    const csvData = [];
    const periods = Array.from(new Set(compareData.flatMap(device => device.values.map((v: any) => v.period))));
    periods.sort();
    
    // Header row
    csvData.push(['Period', ...compareData.map(device => device.deviceName)]);
    
    // Data rows
    periods.forEach(period => {
      const row = [period];
      compareData.forEach(device => {
        const found = device.values.find((v: any) => v.period === period);
        row.push(found ? found.value.toFixed(3) : '0');
      });
      csvData.push(row);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${siteName}_water_bar_chart_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPieChartData = () => {
    if (!compareData || compareData.length === 0) {
      alert('No data available to export');
      return;
    }
    
    const csvData = [];
    csvData.push(['Device', 'Total Value', 'Percentage']);
    
    const totalValue = compareData.reduce((sum, device) => 
      sum + device.values.reduce((deviceSum: number, v: any) => deviceSum + v.value, 0), 0
    );
    
    compareData.forEach(device => {
      const deviceTotal = device.values.reduce((sum: number, v: any) => sum + v.value, 0);
      const percentage = totalValue > 0 ? (deviceTotal / totalValue * 100) : 0;
      csvData.push([
        device.deviceName,
        deviceTotal.toFixed(3),
        percentage.toFixed(2) + '%'
      ]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${siteName}_water_pie_chart_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch site name
  useEffect(() => {
    async function fetchSite() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sites/${siteId}`);
        if (!res.ok) {
          console.error('Failed to fetch site:', res.status, res.statusText);
          throw new Error('Failed to fetch site');
        }
        const data = await res.json();
        console.log('Site data:', data);
        if (data && data.name) {
          setSiteName(data.name);
        } else {
          console.warn('No site name found in response, using siteId');
          setSiteName(siteId);
        }
      } catch (error) {
        console.error('Error fetching site:', error);
        setSiteName(siteId);
      }
    }
    fetchSite();
  }, [siteId]);

  // Fetch devices by type when metric changes
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/devices?type=${metric}`);
        if (!res.ok) throw new Error('Failed to fetch devices');
        const devices = await res.json();
        setDeviceOptions(devices.map((s: any) => ({
          deviceId: s.deviceId,
          name: s.name || s.deviceId
        })));
        setSelectedDevices([]);
      } catch {
        setDeviceOptions([]);
        setSelectedDevices([]);
      }
    }
    fetchDevices();
  }, [siteId, metric]);

  // Fetch comparison data from backend
  useEffect(() => {
    async function fetchCompare() {
      setLoading(true);
      setError(null);
      try {
        let from: string | undefined = undefined;
        let to: string | undefined = undefined;
        if (period === 'custom' && customFrom && customTo) {
          from = customFrom.toISOString();
          to = customTo.toISOString();
        }
        const granularity = period === 'year' ? 'year' : period === 'month' ? 'month' : 'day';
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/site/${siteId}/${metric}/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to, granularity, deviceIds: selectedDevices })
        });
        if (!res.ok) throw new Error('Failed to fetch comparison data');
        const data = await res.json();
        setCompareData(data);
      } catch (e: any) {
        setError(e.message || 'Unknown error');
        setCompareData([]);
      } finally {
        setLoading(false);
      }
    }
    if (selectedDevices.length > 0) fetchCompare();
    else setCompareData([]);
  }, [siteId, metric, period, customFrom, customTo, selectedDevices]);

  // Prepare chart data
  const periods = Array.from(new Set(compareData.flatMap(device => device.values.map((v: any) => v.period))));
  periods.sort();
  const barSeries = compareData.map(device => ({
    label: device.deviceName,
    data: periods.map((p: string) => {
      const found = device.values.find((v: any) => v.period === p);
      return found ? found.value : 0;
    })
  }));
  const pieData = compareData.map(device => ({
    id: device.deviceName,
    value: device.values.reduce((sum: number, v: any) => sum + v.value, 0),
    label: device.deviceName
  }));

  // Calculate percent change for each device
      function calcPercentChange(values: any[]) {
    if (!values || values.length < 2) return null;
    const first = values[0]?.value ?? 0;
    const last = values[values.length - 1]?.value ?? 0;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }
  const deviceChanges = Object.fromEntries(
    compareData.map(device => [device.deviceName, calcPercentChange(device.values)])
  );

  return (
    <DashboardLayout user={session?.user || {}}>
      <Box sx={{ p: { xs: 1, sm: 2, md: 4 }, maxWidth: '1100px', mx: 'auto' }}>
        <div className="flex items-center mb-6">
                      <button
              onClick={() => router.push(`/dashboard/sites/${siteId}`)}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium mr-4"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-1" />
              {t('common.back')} {t('sites.title')}
            </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('analytics.title')} {t('devices.water')} {t('common.for')} <span className="text-blue-700 dark:text-blue-400">{siteName}</span></h1>
        </div>
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 3, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: 'text.primary' }}>{t('devices.title')}</InputLabel>
              <Select
                multiple
                value={selectedDevices}
                onChange={e => setSelectedDevices(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    input={<OutlinedInput label={t('devices.title')} sx={{ color: 'text.primary' }} />}
                renderValue={selected =>
                  deviceOptions.filter(s => selected.includes(s.deviceId)).map(s => s.name).join(', ')
                }
                sx={{
                  '& .MuiSelect-icon': { color: 'text.primary' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                }}
              >
                {deviceOptions.map(device => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    <Checkbox checked={selectedDevices.indexOf(device.deviceId) > -1} />
                    <ListItemText primary={device.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel sx={{ color: 'text.primary' }}>{t('devices.water')} {t('common.metric')}</InputLabel>
              <Select 
                value={metric} 
                label={t('devices.water') + ' ' + t('common.metric')} 
                onChange={e => setMetric(e.target.value)}
                sx={{
                  '& .MuiSelect-icon': { color: 'text.primary' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                }}
              >
                {metricOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel sx={{ color: 'text.primary' }}>{t('common.period')}</InputLabel>
              <Select 
                value={period} 
                label={t('common.period')} 
                onChange={e => setPeriod(e.target.value)}
                sx={{
                  '& .MuiSelect-icon': { color: 'text.primary' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                }}
              >
                {periodOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {period === 'custom' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From"
                  value={customFrom}
                  onChange={setCustomFrom}
                  slotProps={{ 
                    textField: { 
                      size: 'small', 
                      sx: { 
                        minWidth: 140,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '& .MuiInputLabel-root': { color: 'text.primary' },
                        '& .MuiInputBase-input': { color: 'text.primary' },
                      } 
                    } 
                  }}
                />
                <DatePicker
                  label="To"
                  value={customTo}
                  onChange={setCustomTo}
                  slotProps={{ 
                    textField: { 
                      size: 'small', 
                      sx: { 
                        minWidth: 140,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                        '& .MuiInputLabel-root': { color: 'text.primary' },
                        '& .MuiInputBase-input': { color: 'text.primary' },
                      } 
                    } 
                  }}
                />
              </LocalizationProvider>
            )}
          </Box>
        </Paper>
        {error && <Typography color="error" mb={2}>{error}</Typography>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {periods.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>
                      Water Consumption Bar Chart
                    </Typography>
                    {(session?.user?.role === 'superadmin' || session?.user?.role === 'admin' || session?.user?.role === 'user') && compareData.length > 0 && (
                      <button
                        onClick={exportBarChartData}
                        className="px-3 py-1 text-sm rounded-md bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-1"
                        title="Export water consumption data to CSV"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Water Data
                      </button>
                    )}
                  </Box>
                  <BarChart
                    xAxis={[{ data: periods, label: 'Period' }]}
                    series={barSeries}
                    height={350}
                    sx={{
                      '& .MuiChartsAxis-line': {
                        stroke: 'divider',
                      },
                      '& .MuiChartsAxis-tick': {
                        stroke: 'divider',
                      },
                      '& .MuiChartsAxis-label': {
                        fill: 'text.primary',
                      },
                      '& .MuiChartsAxis-tickLabel': {
                        fill: 'text.secondary',
                      },
                    }}
                  />
                  {/* Legend with water consumption change */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                    {compareData.map(device => {
                      const change = deviceChanges[device.deviceName];
                      let color = 'text.secondary';
                      if (change > 0) color = 'success.main';
                      else if (change < 0) color = 'error.main';
                      return (
                            <Box key={device.deviceName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight={500} sx={{ color: 'text.primary' }}>{device.deviceName}</Typography>
                          <Typography fontSize={14} sx={{ color }}>
                            {change === null ? 'N/A' : (change > 0 ? '+' : '') + change.toFixed(1) + '%'} change
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Box>
            )}
            {pieData.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>
                      Water Consumption Distribution
                    </Typography>
                    {(session?.user?.role === 'superadmin' || session?.user?.role === 'admin' || session?.user?.role === 'user') && compareData.length > 0 && (
                      <button
                        onClick={exportPieChartData}
                        className="px-3 py-1 text-sm rounded-md bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors flex items-center gap-1"
                        title="Export water consumption distribution to CSV"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Water Distribution
                      </button>
                    )}
                  </Box>
                  <PieChart
                    series={[{ data: pieData, innerRadius: 60 }]}
                    height={350}
                    sx={{
                      '& .MuiChartsPie-label': {
                        fill: 'text.primary',
                      },
                      '& .MuiChartsPie-labelLine': {
                        stroke: 'divider',
                      },
                    }}
                  />
                </Paper>
              </Box>
            )}
            {periods.length === 0 && (
              <Paper elevation={1} sx={{ p: 4, textAlign: 'center', color: 'text.secondary', bgcolor: 'background.paper' }}>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  No water consumption data available for the selected period.<br />
                  Try changing the period or ensure water devices are connected.
                </Typography>
              </Paper>
            )}
          </>
        )}
      </Box>
    </DashboardLayout>
  );
} 