"use client";
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapController({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      map.flyTo([coords.lat, coords.lng], 16);
    }
  }, [coords, map]);
  return null;
}

function LocationMarker({ onLocationSelect, setCoords }) {
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setCoords({ lat, lng });
      onLocationSelect(lat, lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  return null;
}

export default function MapPicker({ onLocationSelect }) {
  const [coords, setCoords] = useState({ lat: 28.6139, lng: 77.2090 }); // Default to Delhi
  const [address, setAddress] = useState('');
  const [L, setL] = useState(null);
  const [customIcon, setCustomIcon] = useState(null);

  useEffect(() => {
    import('leaflet').then(leaflet => {
      setL(leaflet);
      const icon = new leaflet.Icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41]
      });
      setCustomIcon(icon);
    });
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        if (onLocationSelect) onLocationSelect(latitude, longitude);
      }, (err) => {
        console.warn("Automatic geolocation failed or denied by user.", err);
      });
    }
  }, []); // Run once on mount

  const handleManualEntry = (e) => {
    const val = e.target.value;
    setAddress(val);
    if (val.includes(',')) {
      const parts = val.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lng)) {
          setCoords({ lat, lng });
          onLocationSelect(lat, lng);
        }
      }
    }
  };

  if (typeof window === 'undefined') return null;

  return (
    <div className="space-y-4">
      <div className="h-[350px] w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
        <MapContainer 
          center={[coords.lat, coords.lng]} 
          zoom={16} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%', background: '#0a0c14' }}
        >
          {/* Google Maps Tile Layer */}
          <TileLayer
            attribution='&copy; Google Maps'
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          {customIcon && <Marker position={[coords.lat, coords.lng]} icon={customIcon} />}
          <LocationMarker onLocationSelect={onLocationSelect} setCoords={setCoords} />
          <MapController coords={coords} />
        </MapContainer>

        
        {/* Map Overlays */}
        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3">
          <button 
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  const { latitude, longitude } = pos.coords;
                  setCoords({ lat: latitude, lng: longitude });
                  onLocationSelect(latitude, longitude);
                });
              }
            }}
            className="bg-primary text-white p-4 rounded-2xl shadow-2xl hover:bg-blue-600 transition-all flex items-center gap-2 pointer-events-auto border border-white/10"
          >
            <span className="material-symbols-outlined text-sm">my_location</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Locate Me</span>
          </button>
        </div>
        
        {/* Overlay Control */}
        <div className="absolute top-6 right-6 z-[1000] pointer-events-none">
          <div className="bg-[#141621]/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Interactive Node Selection</span>
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
        <div className="flex justify-between items-center mb-4">
          <label className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Precision Coordinates</label>
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">WGS84 Standard</span>
        </div>
        <div className="relative">
          <input 
            type="text"
            placeholder="Latitude, Longitude"
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-primary/50 text-white font-mono text-sm transition-all"
            value={address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
            onChange={handleManualEntry}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20 text-sm">pincode</span>
        </div>
        <p className="mt-3 text-[9px] text-white/30 font-bold uppercase tracking-widest text-center italic">Map click syncs coordinates automatically.</p>
      </div>
    </div>
  );
}
