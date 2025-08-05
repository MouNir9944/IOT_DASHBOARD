'use client';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon, BoltIcon, SunIcon, CloudIcon, FireIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { BarChart, PieChart } from '@mui/x-charts';
import { useSession } from 'next-auth/react';
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

const metricOptions = [
  { value: 'energy', label: 'Energy', icon: BoltIcon },
  { value: 'solar', label: 'Solar', icon: SunIcon },
  { value: 'water', label: 'Water', icon: CloudIcon },
  { value: 'gas', label: 'Gas', icon: FireIcon },
];
const periodOptions = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

export default function SiteAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params?.siteId as string;
  const { data: session } = useSession();
  const [siteName, setSiteName] = useState<string>('');
  const [metric, setMetric] = useState('energy');
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);          
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const API_URL = 'http://localhost:5000/api';
  // Fetch site name
  useEffect(() => {
    async function fetchSite() {
      try {
        const res = await fetch(`${API_URL}/sites/${siteId}`);
        if (!res.ok) throw new Error('Failed to fetch site');
        const data = await res.json();
        setSiteName(data.name || siteId);
      } catch {
        setSiteName(siteId);
      }
    }
    fetchSite();
  }, [siteId]);

  // Fetch devices by type when metric changes
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch(`${API_URL}/data/site/${siteId}/devices?type=${metric}`);
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
        const res = await fetch(`${API_URL}/data/site/${siteId}/${metric}/compare`, {
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
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium mr-4"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-1" />
            Back to Site
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Analytics for <span className="text-blue-700">{siteName}</span></h1>
        </div>
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Devices</InputLabel>
              <Select
                multiple
                value={selectedDevices}
                onChange={e => setSelectedDevices(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    input={<OutlinedInput label="Devices" />}
                renderValue={selected =>
                  deviceOptions.filter(s => selected.includes(s.deviceId)).map(s => s.name).join(', ')
                }
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
              <InputLabel>Metric</InputLabel>
              <Select value={metric} label="Metric" onChange={e => setMetric(e.target.value)}>
                {metricOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Period</InputLabel>
              <Select value={period} label="Period" onChange={e => setPeriod(e.target.value)}>
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
                  slotProps={{ textField: { size: 'small', sx: { minWidth: 140 } } }}
                />
                <DatePicker
                  label="To"
                  value={customTo}
                  onChange={setCustomTo}
                  slotProps={{ textField: { size: 'small', sx: { minWidth: 140 } } }}
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
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Bar Chart
                  </Typography>
                  <BarChart
                    xAxis={[{ data: periods, label: 'Period' }]}
                    series={barSeries}
                    height={350}
                  />
                  {/* Legend with percent change */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                    {compareData.map(device => {
                      const change = deviceChanges[device.deviceName];
                      let color = 'text.secondary';
                      if (change > 0) color = 'success.main';
                      else if (change < 0) color = 'error.main';
                      return (
                            <Box key={device.deviceName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight={500}>{device.deviceName}</Typography>
                          <Typography fontSize={14} sx={{ color }}>
                            {change === null ? 'N/A' : (change > 0 ? '+' : '') + change.toFixed(1) + '%'}
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
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Pie Chart
                  </Typography>
                  <PieChart
                    series={[{ data: pieData, innerRadius: 60 }]}
                    height={350}
                  />
                </Paper>
              </Box>
            )}
            {periods.length === 0 && (
              <Paper elevation={1} sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body1">
                  No data available for the selected options.<br />
                  Try changing the metric or period.
                </Typography>
              </Paper>
            )}
          </>
        )}
      </Box>
    </DashboardLayout>
  );
} 