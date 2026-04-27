'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const DoctorsMap = dynamic(() => import('@/components/DoctorsMap'), { ssr: false });

function DoctorsContent() {
  const searchParams = useSearchParams();
  const specialtyParam = searchParams.get('specialty');
  
  const [locationName, setLocationName] = useState('Detecting location...');
  const [userCoords, setUserCoords] = useState(null);
  const [centerRequest, setCenterRequest] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const locateUser = () => {
    setLocationName("Detecting location...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserCoords({ lat, lng });
          setCenterRequest({ lat, lng, t: Date.now() });

          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
              const city = data.address.city || data.address.town || data.address.village || 'Unknown Location';
              setLocationName(`${city}, ${data.address.country}`);
            })
            .catch(() => setLocationName("Your Current Location"));
        },
        (error) => {
          const fallback = { lat: 37.7749, lng: -122.4194 };
          setLocationName("San Francisco, CA");
          setUserCoords(fallback);
          setCenterRequest({ ...fallback, t: Date.now() });
        }
      );
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/doctors');
      const data = await res.json();
      if (res.ok) {
        let fetchedDoctors = data.doctors || [];
        setDoctors(fetchedDoctors);
      }
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    locateUser();
    fetchDoctors();
  }, []);

  useEffect(() => {
    let result = [...doctors];
    
    if (specialtyParam) {
      result = result.filter(d => 
        d.specialty.toLowerCase().includes(specialtyParam.toLowerCase()) ||
        specialtyParam.toLowerCase().includes(d.specialty.toLowerCase())
      );
    }

    if (userCoords) {
      result.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(parseFloat(a.latitude) - userCoords.lat, 2) + Math.pow(parseFloat(a.longitude) - userCoords.lng, 2));
        const distB = Math.sqrt(Math.pow(parseFloat(b.latitude) - userCoords.lat, 2) + Math.pow(parseFloat(b.longitude) - userCoords.lng, 2));
        return distA - distB;
      });
    }
    setFilteredDoctors(result);
  }, [doctors, userCoords, specialtyParam]);

  const handleCenterMap = () => {
    if (userCoords) {
      setCenterRequest({ lat: userCoords.lat, lng: userCoords.lng, t: Date.now() });
    } else {
      locateUser();
    }
  };

  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-[1600px] mx-auto h-screen flex flex-col overflow-y-auto md:overflow-hidden bg-background font-sans">
      <section className="mb-10 shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-block px-5 py-2 rounded-full bg-surface-container-highest text-primary text-[10px] font-bold uppercase tracking-[0.3em] border border-outline-variant">Specialist Matching Active</span>
              {specialtyParam && (
                <span className="inline-block px-5 py-2 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-[0.3em] shadow-lg shadow-blue-600/20">
                  Filtering: {specialtyParam}
                </span>
              )}
            </div>
            <h2 className="text-5xl md:text-6xl font-extrabold font-headline tracking-tighter text-on-background">Discover Specialists</h2>
            <p className="text-on-surface-variant mt-3 max-w-xl text-lg font-medium leading-relaxed">Qualified specialists matched to your clinical profile and recent symptoms.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-6 py-4 bg-surface-container-low rounded-full flex items-center gap-4 border border-outline-variant shadow-sm">
              <span className="material-symbols-outlined text-secondary">location_on</span>
              <span className="font-bold text-sm text-on-background uppercase tracking-widest">{locationName}</span>
            </div>
            {specialtyParam && (
              <button onClick={() => router.push('/doctors')} className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-lg border border-red-100 hover:bg-red-500 hover:text-white transition-all" title="Clear Filters">
                <span className="material-symbols-outlined text-2xl">filter_list_off</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex-1 flex flex-col md:flex-row gap-6 md:gap-10 min-h-0 mb-6">
        <div className="w-full md:w-2/5 md:overflow-y-auto pr-0 md:pr-4 custom-scrollbar space-y-6 md:space-y-8 pb-10">
          {loading ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-on-surface-variant font-bold uppercase tracking-widest text-[10px]">Matching Specialists...</p>
            </div>
          ) : filteredDoctors.length > 0 ? filteredDoctors.map((doc, idx) => (
            <div key={doc.id} className="group relative bg-surface-container-low rounded-3xl p-8 transition-all hover:bg-surface-container border border-outline-variant/30 shadow-sm overflow-hidden">
              {idx === 0 && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary px-6 py-2 rounded-bl-3xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 z-10">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Recommended
                </div>
              )}
              <div className="flex gap-6 mt-4">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg border border-outline-variant bg-surface-container-highest flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-primary/40">medical_services</span>
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md border-4 border-surface-container-low group-hover:border-surface-container transition-all">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-extrabold font-headline text-on-background tracking-tight leading-none">{doc.name}</h3>
                      <p className="text-primary font-bold text-[10px] mt-3 uppercase tracking-widest">{doc.specialty}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">payments</span>
                      Fee: {doc.price || 'Contact'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-between pt-6 border-t border-outline-variant/30">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-sm">distance</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {userCoords && doc.latitude && doc.longitude
                        ? `${(Math.sqrt(Math.pow(parseFloat(doc.latitude) - userCoords.lat, 2) + Math.pow(parseFloat(doc.longitude) - userCoords.lng, 2)) * 111.1).toFixed(1)} km`
                        : 'Nearby'}
                    </span>
                  </div>
                </div>
                <button className="px-8 py-3 neural-gradient text-on-primary text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md hover:scale-[1.05] active:scale-[0.95] transition-all">
                  Book Review
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
              <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">person_search</span>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No matches for "{specialtyParam}"</p>
              <button onClick={() => window.location.href='/doctors'} className="mt-6 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">View All Specialists</button>
            </div>
          )}
        </div>

        <div className="w-full md:w-3/5 h-[300px] md:h-full rounded-3xl overflow-hidden relative shadow-inner bg-surface-container-lowest border border-outline-variant shrink-0 md:shrink">
          <DoctorsMap doctors={filteredDoctors} userCoords={userCoords} centerRequest={centerRequest} />
          <div className="absolute top-8 left-8 z-[1000] bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-outline-variant shadow-xl max-w-xs flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full neural-gradient flex items-center justify-center text-on-primary shadow-sm">
                <span className="material-symbols-outlined">map</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Medical Hub</p>
                <p className="text-sm font-bold text-on-background tracking-tight">{locationName}</p>
              </div>
            </div>
            <button onClick={handleCenterMap} className="w-full py-3 bg-surface-container-highest rounded-xl text-primary font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors border border-outline-variant">
              <span className="material-symbols-outlined text-[16px]">my_location</span> Center Map
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DoctorsPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Clinical Hub...</div>}>
      <DoctorsContent />
    </Suspense>
  );
}
