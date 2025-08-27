'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { useSession } from 'next-auth/react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  ChartBarIcon, 
  BoltIcon, 
  SunIcon, 
  CloudIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FireIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { BarChart, PieChart } from '@mui/x-charts';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';




export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  
  const metricOptions = [
    { value: 'water', label: t('devices.water'), icon: CloudIcon },
  ];
  const periodOptions = [
    { value: 'month', label: t('analytics.monthlyConsumption') },
    { value: 'year', label: t('analytics.yearlyConsumption') },
    { value: 'custom', label: t('common.custom') },
  ];
  
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [metric, setMetric] = useState('water'); 
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any[]>([]);

  // Export functions
  const exportBarChartData = () => {
    if (!compareData || compareData.length === 0) {
      alert('No data available to export');
      return;
    }
    
    const csvData = [];
    const periods = Array.from(new Set(compareData.flatMap(site => site.values.map((v: any) => v.period))));
    periods.sort();
    
    // Header row
    csvData.push(['Period', ...compareData.map(site => site.siteName)]);
    
    // Data rows
    periods.forEach(period => {
      const row = [period];
      compareData.forEach(site => {
        const found = site.values.find((v: any) => v.period === period);
        row.push(found ? found.value.toFixed(3) : '0');
      });
      csvData.push(row);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `global_${metric}_bar_chart_${period}_${new Date().toISOString().split('T')[0]}.csv`);
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
    csvData.push(['Site', 'Total Value', 'Percentage']);
    
    const totalValue = compareData.reduce((sum, site) => 
      sum + site.values.reduce((siteSum: number, v: any) => siteSum + v.value, 0), 0
    );
    
    compareData.forEach(site => {
      const siteTotal = site.values.reduce((sum: number, v: any) => sum + v.value, 0);
      const percentage = totalValue > 0 ? (siteTotal / totalValue * 100) : 0;
      csvData.push([
        site.siteName,
        siteTotal.toFixed(3),
        percentage.toFixed(2) + '%'
      ]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `global_${metric}_pie_chart_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!session?.user) return;
    const fetchSites = async () => {
      try {
        let url = `${API_URL}`;
        if (session.user.role !== 'superadmin') {
          url = `${API_URL}/user/${session.user.id}`;
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
          setSelectedSites(data.map((s: any) => s._id)); // default: all sites
          console.log('Fetched sites:', data);
        } else {
          console.error('Sites API returned non-array data:', data);
          setSites([]);
          setSelectedSites([]);
        }
      } catch (error) {
        console.error('Error fetching sites:', error);
        setSites([]);
        setSelectedSites([]);
      }
    };
    fetchSites();
  }, [session]);

  const handleFetchCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      let granularity = period === 'year' ? 'year' : period === 'month' ? 'month' : 'day';
      let from = undefined, to = undefined;
      if (period === 'custom' && customFrom && customTo) {
        from = customFrom.toISOString();
        to = customTo.toISOString();
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/data/global/${metric}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds: selectedSites, from, to, granularity })
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
  };

  // Fetch compare data when selection changes
  useEffect(() => {
    if (selectedSites.length > 0) handleFetchCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSites, metric, period, customFrom, customTo]);

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

  // Calculate percent change for each site
  function calcPercentChange(values: any[]) {
    if (!values || values.length < 2) return null;
    const first = values[0]?.value ?? 0;
    const last = values[values.length - 1]?.value ?? 0;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }
  const siteChanges = Object.fromEntries(
    compareData.map(site => [site.siteName, calcPercentChange(site.values)])
  );

  // Prepare chart data
  const periods = Array.from(new Set(compareData.flatMap(site => site.values.map((v: any) => v.period))));
  periods.sort();
  const barSeries = compareData.map(site => ({
    label: site.siteName,
    data: periods.map((p: string) => {
      const found = site.values.find((v: any) => v.period === p);
      return found ? found.value : 0;
    })
  }));
  const pieData = compareData.map(site => ({
    id: site.siteName,
    value: site.values.reduce((sum: number, v: any) => sum + v.value, 0),
    label: site.siteName
  }));

  return (
    <DashboardLayout user={user}>
      <Box sx={{ p: { xs: 1, sm: 2, md: 4 }, maxWidth: '1100px', mx: 'auto' }}>
        <Typography variant="h4" fontWeight={700} mb={3} gutterBottom>
          Sites Comparison Analytics
        </Typography>
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <FormControl sx={{ minWidth: 200, flex: 1 }}>
              <InputLabel>Sites</InputLabel>
              <Select
                multiple
                value={selectedSites}
                onChange={e => setSelectedSites(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                input={<OutlinedInput label="Sites" />}
                renderValue={selected =>
                  sites.filter(s => selected.includes(s._id)).map(s => s.name || 'Unknown Site').join(', ')
                }
              >
                {sites.map(site => (
                  <MenuItem key={site._id} value={site._id}>
                    <Checkbox checked={selectedSites.indexOf(site._id) > -1} />
                    <ListItemText primary={site.name || 'Unknown Site'} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Metric</InputLabel>
              <Select 
                value={metric} 
                label="Metric" 
                onChange={e => setMetric(e.target.value)}
              >
                {metricOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Period</InputLabel>
              <Select 
                value={period} 
                label="Period" 
                onChange={e => setPeriod(e.target.value)}
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
                      sx: { minWidth: 140 } 
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
                      sx: { minWidth: 140 } 
                    } 
                  }}
                />
              </LocalizationProvider>
            )}
          </Box>
        </Paper>
        <Divider sx={{ mb: 4 }} />
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Bar Chart
                    </Typography>
                    {(session?.user?.role === 'superadmin' || session?.user?.role === 'admin' || session?.user?.role === 'user') && compareData.length > 0 && (
                      <button
                        onClick={exportBarChartData}
                        className="px-3 py-1 text-sm rounded-md bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-1"
                        title="Export bar chart data to CSV"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Bar Chart
                      </button>
                    )}
                  </Box>
                  <BarChart
                    xAxis={[{ data: periods, label: 'Period' }]}
                    series={barSeries}
                    height={350}
                  />
                  {/* Legend with percent change */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                    {compareData.map(site => {
                      const change = siteChanges[site.siteName];
                      let color = 'text.secondary';
                      if (change > 0) color = 'success.main';
                      else if (change < 0) color = 'error.main';
                      return (
                        <Box key={site.siteName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight={500}>{site.siteName}</Typography>
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Pie Chart
                    </Typography>
                    {(session?.user?.role === 'superadmin' || session?.user?.role === 'admin' || session?.user?.role === 'user') && compareData.length > 0 && (
                      <button
                        onClick={exportPieChartData}
                        className="px-3 py-1 text-sm rounded-md bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors flex items-center gap-1"
                        title="Export pie chart data to CSV"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Pie Chart
                      </button>
                    )}
                  </Box>
                  <PieChart
                    series={[{ data: pieData, innerRadius: 60 }]}
                    height={350}
                  />
                  {/* Pie chart legend with percent change */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                    {compareData.map(site => {
                      const change = siteChanges[site.siteName];
                      let color = 'text.secondary';
                      if (change > 0) color = 'success.main';
                      else if (change < 0) color = 'error.main';
                      return (
                        <Box key={site.siteName} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight={500}>{site.siteName}</Typography>
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
            {periods.length === 0 && (
              <Paper elevation={1} sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body1">
                  No data available for the selected options.<br />
                  Try changing the sites, metric, or period.
                </Typography>
              </Paper>
            )}
          </>
        )}
      </Box>
    </DashboardLayout>
  );
} 