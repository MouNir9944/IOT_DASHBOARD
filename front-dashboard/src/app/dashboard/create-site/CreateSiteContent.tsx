'use client';
// ...your imports for map, react, etc. (no dynamic import of itself)
import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { useSession } from 'next-auth/react';
import { useLanguage } from '../../../contexts/LanguageContext';

// Dynamic imports for client-side only
let MapContainer: any, TileLayer: any, Marker: any, useMapEvents: any, useMap: any, L: any, LeafletMap: any;

const loadLeafletComponents = async () => {
  if (typeof window === 'undefined') return;
  
  const reactLeaflet = await import('react-leaflet');
  const leaflet = await import('leaflet');
  
  MapContainer = reactLeaflet.MapContainer;
  TileLayer = reactLeaflet.TileLayer;
  Marker = reactLeaflet.Marker;
  useMapEvents = reactLeaflet.useMapEvents;
  useMap = reactLeaflet.useMap;
  L = leaflet.default;
  LeafletMap = leaflet.Map;
  
  // Fix default icon issue in Leaflet with React
  const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = DefaultIcon;
};

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites'; // TODO: change to /api/sites/user/{userId} 

// Custom icons for each site type - will be created after L is loaded
const getTypeIcons = (L: any): { [key: string]: any } => ({
  manufacturing: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/gear-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'leaflet-manufacturing-icon',
  }),
  farm: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/tree-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'leaflet-farm-icon',
  }),
  building: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/building.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'leaflet-building-icon',
  }),
  warehouse: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/box-seam.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'leaflet-warehouse-icon',
  }),
  office: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/briefcase-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: 'leaflet-office-icon',
  }),
});

const getDefaultIcon = (L: any) => L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  if (!useMapEvents) return null;
  
  useMapEvents({
    click(e: any) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

interface Site {
  _id: string;
  name: string;
  location: { latitude: number; longitude: number };
  address?: string;
  description?: string;
  devices?: any[];
  type?: string;
  status?: string;
}

function FitBounds({ sites }: { sites: Site[] }) {
  if (!useMap || !L) return null;
  
  const map = useMap();
  React.useEffect(() => {
    if (sites.length === 0) return;
    const bounds = L.latLngBounds(sites.map(site => [site.location.latitude, site.location.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [sites, map]);
  return null;
}

function CenterMapButton({ sites }: { sites: Site[] }) {
  if (!useMap || !L) return null;
  
  const map = useMap();
  const handleCenter = () => {
    const validSites = sites
      .map(site => [site.location.latitude, site.location.longitude] as [number, number])
      .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number');
    if (validSites.length > 0) {
      const bounds = L.latLngBounds(validSites);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([35.6892, 51.389], 13);
    }
  };
  return (
    <button
      className="absolute top-4 right-4 z-[1000] p-2 bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition flex items-center justify-center"
      onClick={handleCenter}
      title="Center Map"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-6 sm:h-6">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
      </svg>
    </button>
  );
}

export default function CreateSiteContent() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState('manufacturing');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('manufacturing');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Only allow admins and sous admins to create sites
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin' || session?.user?.role === 'sous admin';

  // Load Leaflet components on mount
  useEffect(() => {
    loadLeafletComponents().then(() => {
      setIsLoaded(true);
    });
  }, []);

  // Fetch sites on mount
  useEffect(() => {
    if (!session?.user) return;
    setLoading(true);
    let url = API_URL;
    
    // Add query parameters for filtering
    const params = new URLSearchParams();
    if (session.user.role) {
      params.append('role', session.user.role);
    }
    if ((session.user.role === 'admin' || session.user.role === 'sous admin') && session.user.id) {
      params.append('userId', session.user.id);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setSites(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch sites');
        setLoading(false);
      });
  }, [session]);

  const handleCreate = async () => {
    if (!siteName || !selectedPos || !siteType) return;
    if (status === 'loading') {
      setError('Session is still loading. Please wait and try again.');
      return;
    }
    if (!session?.user?.id) {
      setError('User session not available. Please refresh the page and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('Session user:', session?.user);
      console.log('User ID:', session?.user?.id);
      console.log('User role:', session?.user?.role);
      
      const body: any = {
        name: siteName,
        location: { latitude: selectedPos[0], longitude: selectedPos[1] },
        type: siteType,
        address: address || undefined,
        description: description || undefined,
        createdBy: session.user.id, // Use the user ID directly
      };
      if (session.user.role !== 'superadmin') {
        body.userId = session.user.id;
      }
      
      console.log('Request body:', body);
      
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create site');
      const newSite = await res.json();
      setSites([...sites, newSite]);
      setSiteName('');
      setSiteType('manufacturing');
      setAddress('');
      setDescription('');
      setSelectedPos(null);
    } catch (err) {
      console.error('Error creating site:', err);
      setError('Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete site');
      setSites(sites.filter(site => site._id !== id));
    } catch (err) {
      setError('Failed to delete site');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (site: Site) => {
    setEditingId(site._id);
    setEditName(site.name);
    setEditType(site.type || 'manufacturing');
    setEditAddress(site.address || '');
    setEditDescription(site.description || '');
    setSelectedPos([site.location.latitude, site.location.longitude]);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName || !selectedPos || !editType) return;
    if (status === 'loading') {
      setError('Session is still loading. Please wait and try again.');
      return;
    }
    if (!session?.user?.id) {
      setError('User session not available. Please refresh the page and try again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          location: { latitude: selectedPos[0], longitude: selectedPos[1] },
          type: editType,
          address: editAddress || undefined,
          description: editDescription || undefined,
          createdBy: session.user.id, // Use the user ID directly
        }),
      });
      if (!res.ok) throw new Error('Failed to update site');
      const updatedSite = await res.json();
      setSites(sites.map(site => (site._id === editingId ? updatedSite : site)));
      setEditingId(null);
      setEditName('');
      setEditType('manufacturing');
      setEditAddress('');
      setEditDescription('');
      setSelectedPos(null);
    } catch (err) {
      console.error('Error updating site:', err);
      setError('Failed to update site');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while components are loading
  if (!isLoaded || !MapContainer) {
    return (
      <div className="flex flex-col lg:flex-row gap-8 p-4 lg:p-8 bg-gray-50 min-h-screen">
        <div className="flex-1 flex flex-col items-stretch">
          <div className="rounded-xl shadow-lg border bg-white overflow-hidden mb-6">
            <div className="h-[350px] w-full flex items-center justify-center">
              <div className="text-gray-500">Loading map...</div>
            </div>
          </div>
          <div className="rounded-xl shadow-lg border bg-white p-6">
            <h2 className="text-2xl font-bold mb-4 text-blue-700">{t('sites.createSite')}</h2>
            <div className="text-gray-500">Loading form...</div>
          </div>
        </div>
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="rounded-xl shadow-lg border bg-white p-6">
            <h3 className="font-semibold text-lg mb-4 text-blue-700">{t('sites.title')}</h3>
            <div className="text-gray-500">Loading sites...</div>
          </div>
        </div>
      </div>
    );
  }

  const typeIcons = getTypeIcons(L);
  const DefaultIcon = getDefaultIcon(L);

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Left: Map and Form Section */}
      <div className="flex-1 flex flex-col items-stretch">
        <div className="rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
          <MapContainer
            center={[35.6892, 51.389]}
            zoom={13}
            minZoom={2}
            maxZoom={10}
            style={{ height: '350px', width: '100%', position: 'relative' }}
          >
            <CenterMapButton sites={sites} />
            <FitBounds sites={sites} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {sites.map(site => (
              <Marker
                key={site._id}
                position={[site.location.latitude, site.location.longitude]}
                icon={typeIcons[String(site.type)] ?? DefaultIcon}
              />
            ))}
            <LocationMarker position={selectedPos} setPosition={setSelectedPos} />
          </MapContainer>
        </div>
        <div className="rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-400">{editingId ? t('sites.editSite') : t('sites.createSite')}</h2>
          {status === 'loading' && (
            <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded">
              Loading user session...
            </div>
          )}
          {status === 'authenticated' && !session?.user?.id && (
            <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 rounded">
              Warning: User ID not found in session. This may cause issues with site creation.
              <br />
              <small>Session data: {JSON.stringify(session?.user)}</small>
            </div>
          )}
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">{t('sites.siteName')}<span className="text-red-500">*</span></label>
              <input
                className="border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                type="text"
                placeholder="Site Name"
                value={editingId ? editName : siteName}
                onChange={e => editingId ? setEditName(e.target.value) : setSiteName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">{t('common.type')}<span className="text-red-500">*</span></label>
              <select
                className="border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={editingId ? editType : siteType}
                onChange={e => editingId ? setEditType(e.target.value) : setSiteType(e.target.value)}
                required
              >
                <option value="manufacturing">Manufacturing</option>
                <option value="farm">Farm</option>
                <option value="building">Building</option>
                <option value="warehouse">Warehouse</option>
                <option value="office">Office</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">{t('sites.siteAddress')}</label>
              <input
                className="border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                type="text"
                placeholder="Address (optional)"
                value={editingId ? editAddress : address}
                onChange={e => editingId ? setEditAddress(e.target.value) : setAddress(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">Description</label>
              <textarea
                className="border border-gray-300 dark:border-gray-600 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Description (optional)"
                value={editingId ? editDescription : description}
                onChange={e => editingId ? setEditDescription(e.target.value) : setDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-semibold text-gray-900 dark:text-gray-100">Location<span className="text-red-500">*</span></label>
              <span className="text-sm text-gray-600 dark:text-gray-400">Click on the map to select a location.</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Lat: {selectedPos ? selectedPos[0].toFixed(5) : '--'}, Lng: {selectedPos ? selectedPos[1].toFixed(5) : '--'}</span>
            </div>
            <div className="md:col-span-2 flex gap-2 mt-2">
              {editingId ? (
                <>
                  <button
                    className="bg-green-500 dark:bg-green-600 text-white px-4 py-2 rounded hover:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50"
                    type="button"
                    onClick={handleUpdate}
                    disabled={!editName || !selectedPos || !editType || loading}
                  >
                    Update Site
                  </button>
                  <button
                    className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditName('');
                      setEditType('manufacturing');
                      setEditAddress('');
                      setEditDescription('');
                      setSelectedPos(null);
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
                  type="button"
                  onClick={handleCreate}
                  disabled={!isAdmin || !siteName || !selectedPos || !siteType || loading}
                >
                  Create Site
                </button>
              )}
            </div>
          </form>
          {error && <div className="text-red-500 dark:text-red-400 mt-2">{error}</div>}
          {loading && <div className="text-blue-500 dark:text-blue-400 mt-2">Loading...</div>}
        </div>
      </div>
      {/* Right: Sites List */}
      <div className="w-full lg:w-96 flex-shrink-0">
        <div className="rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex flex-col">
          <h3 className="font-semibold text-lg mb-4 text-blue-700 dark:text-blue-400">Sites</h3>
          <ul className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
            {sites.map(site => (
              <li
                key={site._id}
                className="flex items-center gap-3 border border-gray-200 dark:border-gray-600 p-3 rounded-lg hover:shadow transition-shadow bg-gray-50 dark:bg-gray-700"
              >
                <span className="flex-shrink-0">
                  <img
                    src={typeIcons[String(site.type)]?.options.iconUrl as string}
                    alt={site.type}
                    className="w-8 h-8"
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-gray-900 dark:text-gray-100">{site.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{site.address || 'No address'}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">Lat: {site.location.latitude.toFixed(4)}, Lng: {site.location.longitude.toFixed(4)}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200`}>{site.type}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="bg-yellow-400 dark:bg-yellow-500 px-2 py-1 rounded hover:bg-yellow-500 dark:hover:bg-yellow-600 text-xs transition"
                    onClick={() => handleEdit(site)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    className="bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded hover:bg-red-600 dark:hover:bg-red-700 text-xs transition"
                    onClick={() => handleDelete(site._id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {sites.length === 0 && <div className="text-gray-400 dark:text-gray-500 text-center mt-8">No sites found.</div>}
        </div>
      </div>
    </div>
  );
}
