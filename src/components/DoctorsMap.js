"use client";
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, zoom, map]);
  return null;
}

export default function DoctorsMap({ doctors, userCoords, centerRequest }) {
  const [isMounted, setIsMounted] = useState(false);
  const [L, setL] = useState(null);
  const [customIcon, setCustomIcon] = useState(null);
  const [userIcon, setUserIcon] = useState(null);

  // Default center (India)
  const defaultLat = 20.5937;
  const defaultLng = 78.9629;

  useEffect(() => {
    setIsMounted(true);
    import('leaflet').then(leaflet => {
      setL(leaflet);
      
      // Define custom icons: RED for Doctors, BLUE for User
      const doctorIcon = new leaflet.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        shadowSize: [41, 41]
      });

      const personIcon = new leaflet.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        shadowSize: [41, 41]
      });

      setCustomIcon(doctorIcon);
      setUserIcon(personIcon);
    });
  }, []);

  if (!isMounted || typeof window === 'undefined') {
    return (
      <div className="h-full w-full bg-[#0a0c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initializing Neural Map...</p>
        </div>
      </div>
    );
  }

  const centerLat = parseFloat(userCoords?.lat) || parseFloat(doctors[0]?.latitude) || defaultLat;
  const centerLng = parseFloat(userCoords?.lng) || parseFloat(doctors[0]?.longitude) || defaultLng;

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', background: '#0a0c14' }}
      >
        <MapController 
          center={centerRequest ? [centerRequest.lat, centerRequest.lng] : null} 
          zoom={18} 
        />
        {/* Google Maps Tile Layer */}
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />
        
        {/* User Location Marker */}
        {userCoords && userIcon && (
          <Marker position={[parseFloat(userCoords.lat), parseFloat(userCoords.lng)]} icon={userIcon}>
            <Popup>
              <div className="p-2 text-center">
                <p className="font-bold text-primary text-xs uppercase tracking-widest">Your Unit</p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Precision Sync Active</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Doctor Markers */}
        {doctors.map((doc, idx) => {
          const lat = parseFloat(doc.latitude);
          const lng = parseFloat(doc.longitude);
          
          if (!isNaN(lat) && !isNaN(lng) && customIcon) {
            return (
              <Marker key={idx} position={[lat, lng]} icon={customIcon}>
                <Popup>
                  <div className="p-4 min-w-[200px] bg-white rounded-xl">
                    <h3 className="font-black text-slate-900 tracking-tight text-lg">{doc.name}</h3>
                    <p className="text-primary font-bold text-[9px] uppercase tracking-widest mb-3">{doc.specialty}</p>
                    <p className="text-[11px] text-slate-500 mb-4 border-l-2 border-slate-100 pl-3 leading-relaxed">{doc.location}</p>
                    <button className="w-full py-3 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                      Book Review
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>


      {/* Map Legend Overlay */}
      <div className="absolute bottom-8 left-8 z-[1000] pointer-events-none">
        <div className="bg-[#141621]/90 backdrop-blur-xl p-6 rounded-[24px] border border-white/10 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Clinical Specialist Node</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Verified Facility</span>
          </div>
        </div>
      </div>
    </div>
  );
}
