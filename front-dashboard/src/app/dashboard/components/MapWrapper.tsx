'use client';

import Map from './Map';


export default function MapWrapper({ sites }: { sites: any[] }) {
  return (
    <div className="h-full">
      <Map sites={sites} />
    </div>
  );
} 