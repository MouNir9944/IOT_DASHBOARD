'use client';
// ...your imports for map, react, etc. (no dynamic import of itself)
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Map as LeafletMap } from 'leaflet';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sites';
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

// Custom icons for each site type
const typeIcons: { [key: string]: L.Icon } = {
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
};

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
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
  const map = useMap();
  React.useEffect(() => {
    if (sites.length === 0) return;
    const bounds = L.latLngBounds(sites.map(site => [site.location.latitude, site.location.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [sites, map]);
  return null;
}

function CenterMapButton({ sites }: { sites: Site[] }) {
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
  const { data: session } = useSession();

  // Only allow admins to create sites
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';

  // Fetch sites on mount
  useEffect(() => {
    if (!session?.user) return;
    setLoading(true);
    let url = API_URL;
    if (session.user.role === 'admin') {
      url = `${API_URL}/user/${session.user.id}`;
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
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        name: siteName,
        location: { latitude: selectedPos[0], longitude: selectedPos[1] },
        type: siteType,
        address: address || undefined,
        description: description || undefined,
      };
      if (session?.user && session.user.role !== 'superadmin') {
        body.userId = session.user.id;
      }
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
      setError('Failed to update site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 lg:p-8 bg-gray-50 min-h-screen">
      {/* Left: Map and Form Section */}
      <div className="flex-1 flex flex-col items-stretch">
        <div className="rounded-xl shadow-lg border bg-white overflow-hidden mb-6">
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
        <div className="rounded-xl shadow-lg border bg-white p-6">
          <h2 className="text-2xl font-bold mb-4 text-blue-700">{editingId ? 'Edit Site' : 'Create Site'}</h2>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-semibold">Site Name<span className="text-red-500">*</span></label>
              <input
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                type="text"
                placeholder="Site Name"
                value={editingId ? editName : siteName}
                onChange={e => editingId ? setEditName(e.target.value) : setSiteName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-semibold">Type<span className="text-red-500">*</span></label>
              <select
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
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
              <label className="font-semibold">Address</label>
              <input
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                type="text"
                placeholder="Address (optional)"
                value={editingId ? editAddress : address}
                onChange={e => editingId ? setEditAddress(e.target.value) : setAddress(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-semibold">Description</label>
              <textarea
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Description (optional)"
                value={editingId ? editDescription : description}
                onChange={e => editingId ? setEditDescription(e.target.value) : setDescription(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-semibold">Location<span className="text-red-500">*</span></label>
              <span className="text-sm text-gray-600">Click on the map to select a location.</span>
              <span className="text-xs text-gray-500">Lat: {selectedPos ? selectedPos[0].toFixed(5) : '--'}, Lng: {selectedPos ? selectedPos[1].toFixed(5) : '--'}</span>
            </div>
            <div className="md:col-span-2 flex gap-2 mt-2">
              {editingId ? (
                <>
                  <button
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                    type="button"
                    onClick={handleUpdate}
                    disabled={!editName || !selectedPos || !editType || loading}
                  >
                    Update Site
                  </button>
                  <button
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
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
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  type="button"
                  onClick={handleCreate}
                  disabled={!isAdmin || !siteName || !selectedPos || !siteType || loading}
                >
                  Create Site
                </button>
              )}
            </div>
          </form>
          {error && <div className="text-red-500 mt-2">{error}</div>}
          {loading && <div className="text-blue-500 mt-2">Loading...</div>}
        </div>
      </div>
      {/* Right: Sites List */}
      <div className="w-full lg:w-96 flex-shrink-0">
        <div className="rounded-xl shadow-lg border bg-white p-6 flex flex-col">
          <h3 className="font-semibold text-lg mb-4 text-blue-700">Sites</h3>
          <ul className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
            {sites.map(site => (
              <li
                key={site._id}
                className="flex items-center gap-3 border p-3 rounded-lg hover:shadow transition-shadow bg-gray-50"
              >
                <span className="flex-shrink-0">
                  <img
                    src={typeIcons[String(site.type)]?.options.iconUrl as string}
                    alt={site.type}
                    className="w-8 h-8"
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{site.name}</div>
                  <div className="text-xs text-gray-500 truncate">{site.address || 'No address'}</div>
                  <div className="text-xs text-gray-400">Lat: {site.location.latitude.toFixed(4)}, Lng: {site.location.longitude.toFixed(4)}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-700`}>{site.type}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="bg-yellow-400 px-2 py-1 rounded hover:bg-yellow-500 text-xs"
                    onClick={() => handleEdit(site)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs"
                    onClick={() => handleDelete(site._id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {sites.length === 0 && <div className="text-gray-400 text-center mt-8">No sites found.</div>}
        </div>
      </div>
    </div>
  );
}
