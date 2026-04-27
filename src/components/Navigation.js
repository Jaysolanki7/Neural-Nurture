'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { secureStorage } from '../lib/storage';
import { useStore } from '../lib/store';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('U');
  const location = useStore(state => state.location);
  const setStoreLocation = useStore(state => state.setLocation);
  const [role, setRole] = useState('patient');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Analysis Complete', desc: 'Symptom triage node processed.', time: '2m ago', icon: 'auto_awesome' },
    { id: 2, title: 'Profile Synced', desc: 'Identity data updated in mesh.', time: '1h ago', icon: 'sync' },
    { id: 3, title: 'Cloud Health', desc: 'Storage capacity at 12%.', time: '5h ago', icon: 'cloud_done' }
  ]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      secureStorage.clear();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const storedRole = secureStorage.getItem('user_role') || 'patient';
      setRole(storedRole);

      if (user) {
        const name = user.user_metadata?.first_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'U';
        const email = user.email;
        setUserName(name[0].toUpperCase());
        secureStorage.setItem('user_name', name);
        secureStorage.setItem('user_email', email);
      } else {
        const name = secureStorage.getItem('user_name');
        if (name) setUserName(name[0].toUpperCase());
      }
    };
    fetchUser();

    // Geolocation - Only run if location is still 'Detecting...'
    if (location === 'Detecting...' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
          const data = await res.json();
          const city = data.address.city || data.address.town || data.address.village || 'Unknown';
          setStoreLocation(`${city}, ${data.address.country}`);
        } catch (e) {
          setStoreLocation('Location Unavailable');
        }
      }, () => {
        setStoreLocation('Permission Denied');
      });
    }

    // Close notifications on outside click
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const getNavItems = () => {
    if (role === 'admin') {
      return [
        { name: 'Dashboard', icon: 'home', href: '/admin/dashboard' },
        { name: 'Chat', icon: 'chat_bubble', href: '/chat' },
      ];
    }
    
    return [
      { name: 'Home', icon: 'home', href: '/dashboard' },
      { name: 'Chat', icon: 'chat_bubble', href: '/chat' },
      { name: 'Doctors', icon: 'medical_services', href: '/doctors' },
      { name: 'My File', icon: 'folder_shared', href: '/medical-file' },
      { name: 'Wellness', icon: 'self_care', href: '/wellness' },
    ];
  };

  const navItems = getNavItems();

  const noNavPages = ['/', '/login', '/register'];
  if (noNavPages.includes(pathname)) return null;

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[100] flex justify-between items-center px-4 md:px-10 py-5 bg-white/40 backdrop-blur-3xl border-b border-white/20 lg:pl-32 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-4">
          <button
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant text-on-background"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMenuOpen ? 'close' : 'menu'}</span>
          </button>
          <Link href={role === 'admin' ? '/admin/dashboard' : role === 'doctor' ? '/doctor/dashboard' : '/dashboard'}>
            <span className="text-2xl font-extrabold tracking-tighter text-primary font-headline cursor-pointer">MediAI</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full border border-outline-variant">
            <span className="material-symbols-outlined text-secondary text-sm">location_on</span>
            <span className="text-xs font-bold text-on-surface-variant">{location}</span>
          </div>

          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all relative ${isNotificationsOpen ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-surface-container-low border-outline-variant text-on-background hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {!isNotificationsOpen && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>
            
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-4 w-[320px] md:w-[380px] bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_20px_70px_rgba(0,0,0,0.15)] border border-slate-100 p-6 animate-in fade-in slide-in-from-top-4 duration-300 z-50 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Notifications</h3>
                    <button onClick={() => setNotifications([])} className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline">Clear All</button>
                  </div>
                  
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {notifications.length > 0 ? notifications.map((n) => (
                      <div key={n.id} className="flex gap-5 p-4 rounded-3xl hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-100">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <span className="material-symbols-outlined text-[20px]">{n.icon}</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-black text-slate-900">{n.title}</p>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{n.desc}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center space-y-4">
                        <span className="material-symbols-outlined text-5xl text-slate-100">notifications_off</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Clinical Log Clear</p>
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-50">
                      <button className="w-full py-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors">
                        View Audit Log
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <nav className="absolute left-0 top-0 h-full w-[280px] bg-surface-container-lowest shadow-2xl flex flex-col p-6 pt-24 animate-in slide-in-from-left duration-300 border-r border-outline-variant">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive ? 'neural-gradient text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                      {item.icon}
                    </span>
                    <span className="font-bold">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto flex flex-col gap-4">
              <Link
                href="/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-high text-on-background border border-outline-variant"
              >
                <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">
                  {userName}
                </div>
                <span className="font-bold uppercase tracking-widest text-xs">Profile</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 p-4 rounded-2xl bg-error-container/10 text-error-container border border-error-container/20 hover:bg-error-container/20 transition-all"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="font-bold uppercase tracking-widest text-xs">Sign Out</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 h-full w-24 bg-surface-container-lowest border-r border-outline-variant flex flex-col items-center py-10 z-[5] hidden lg:flex shadow-2xl">
        <div className="flex flex-col gap-8 flex-1 mt-20">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className="relative group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'neural-gradient text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'}`}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                </div>
                <div className="absolute left-full ml-4 px-3 py-1 bg-surface-container-highest text-on-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-outline-variant">
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col items-center gap-6">
          <Link href="/profile" className="relative group">
            <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center text-primary font-bold text-lg hover:scale-105 transition-transform shadow-lg border border-outline-variant">
              {userName}
            </div>
            <div className="absolute left-full ml-4 px-3 py-1 bg-surface-container-highest text-on-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-outline-variant">
              Profile
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-all relative group"
          >
            <span className="material-symbols-outlined">logout</span>
            <div className="absolute left-full ml-4 px-3 py-1 bg-surface-container-highest text-on-background text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-outline-variant">
              Sign Out
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
