'use client';

import React, { useRef, useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './Map.css';

type Site = {
  _id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location?: { latitude: number; longitude: number };
  type: string;
  address?: string;
  // ...other fields
};

// Dynamic imports for client-side only
let MapContainer: any, TileLayer: any, Marker: any, Popup: any, useMap: any, L: any;

const loadLeafletComponents = async () => {
  if (typeof window === 'undefined') return;
  
  const reactLeaflet = await import('react-leaflet');
  const leaflet = await import('leaflet');
  
  MapContainer = reactLeaflet.MapContainer;
  TileLayer = reactLeaflet.TileLayer;
  Marker = reactLeaflet.Marker;
  Popup = reactLeaflet.Popup;
  useMap = reactLeaflet.useMap;
  L = leaflet.default;
  
  // Fix for default marker icons
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

// Type-to-icon mapping using SVG/CDN URLs (no local imports)
const getIconMap = (L: any): Record<string, any> => ({
  manufacturing: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/gear-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  farm: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/tree-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  building: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/building.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  warehouse: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/box-seam.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  office: L.icon({
    iconUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/briefcase-fill.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
});

// Fallback default icon (Leaflet blue marker from CDN)
const getDefaultIcon = (L: any) => L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

function CenterMapButton({ sites }: { sites: Site[] }) {
  const map = useMap();
  const handleCenter = () => {
    if (!L) return;
    const validSites = sites
      .map(site => [site.latitude ?? site.location?.latitude, site.longitude ?? site.location?.longitude] as [number | undefined, number | undefined])
      .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number') as [number, number][];
    if (validSites.length > 0) {
      const bounds = L.latLngBounds(validSites);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([0, 0], 2);
    }
  };
  return (
    <button
      className="absolute top-4 right-4 z-[1000] p-2 bg-blue-600 text-white rounded-full shadow hover:bg-blue-700 transition flex items-center justify-center"
      onClick={handleCenter}
      title="Center Map"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="sm:w-6 sm:h-6"
      >
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
      </svg>
    </button>
  );
}

export default function Map({ sites }: { sites: Site[] }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const center: [number, number] = sites.length > 0
    ? [
        sites[0]?.latitude ?? sites[0]?.location?.latitude ?? 0,
        sites[0]?.longitude ?? sites[0]?.location?.longitude ?? 0,
      ]
    : [0, 0];

  // Track if initial auto-center has occurred
  const hasAutoCenteredRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    loadLeafletComponents().then(() => {
      setIsLoaded(true);
    });
  }, []);

  // Auto-center map to fit all sites only on first load
  useEffect(() => {
    if (!isClient || !isLoaded || !mapRef.current || hasAutoCenteredRef.current || !L) return;
    const map = mapRef.current;
    const validSites = sites
      .map(site => [site.latitude ?? site.location?.latitude, site.longitude ?? site.location?.longitude] as [number | undefined, number | undefined])
      .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number') as [number, number][];
    if (validSites.length > 0) {
      const bounds = L.latLngBounds(validSites);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([0, 0], 7);
    }
    hasAutoCenteredRef.current = true;
  }, [isClient, isLoaded, sites]);

  const handleCenterMap = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(center as [number, number], 10);
    }
  };

  // Show loading state while components are loading
  if (!isClient || !isLoaded || !MapContainer) {
    return (
      <div className="relative w-full h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 p-3 sm:p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 sm:mb-0">Sites Locations</h2>
          <div className="flex gap-2">
            <button 
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              title="Center Map"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="sm:w-6 sm:h-6"
              >
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="relative bg-white rounded-lg shadow-lg overflow-hidden h-full flex items-center justify-center">
          <div className="text-gray-500">Loading map...</div>
        </div>
      </div>
    );
  }

  const iconMap = getIconMap(L);
  const defaultIcon = getDefaultIcon(L);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="relative w-full h-full">
        <MapContainer center={center} zoom={7} minZoom={2} maxZoom={10} style={{ height: '100%', width: '100%' }} ref={mapRef}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CenterMapButton sites={sites} />
          {/* Render a marker for each site */}
          {sites && sites.length > 0 ? (
            sites.map(site => {
              const lat = site.latitude ?? site.location?.latitude;
              const lng = site.longitude ?? site.location?.longitude;
              if (lat == null || lng == null) return null;
              const icon = iconMap[site.type] || defaultIcon;
              return (
                <Marker key={site._id} position={[lat, lng]} icon={icon}>
                  <Popup>
                    <div className="font-semibold text-base mb-1">{site.name}</div>
                    <div className="text-sm mb-1">Type: <span className="font-medium">{site.type}</span></div>
                    {site.address && (
                      <div className="text-sm mb-1">Address: <span className="font-medium">{site.address}</span></div>
                    )}
                    <div className="text-xs text-gray-500">
                      Lat: {lat?.toFixed(5)}, Lng: {lng?.toFixed(5)}
                    </div>
                  </Popup>
                </Marker>
              );
            })
          ) : (
            <Marker position={center} icon={defaultIcon}>
              <Popup>No sites to display</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
} 