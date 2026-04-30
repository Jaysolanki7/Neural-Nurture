"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export default function DashboardPage() {
  const [userName, setUserName] = useState('User');
  const [metrics, setMetrics] = useState({
    bmi: '22.4',
    heartRate: '72',
    steps: '8,432',
    calories: 0,
    water: 0
  });
  const [latestTriage, setLatestTriage] = useState({
    assessment: "Your clinical data is being synthesized. Complete a chat triage for a detailed assessment.",
    recommendation: "Stay active and hydrated",
    status: "Neural Link Pending"
  });
  const [loading, setLoading] = useState(true);
  const storeLocation = useStore(state => state.location);
  const setStoreLocation = useStore(state => state.setLocation);
  const [isEditingMapLocation, setIsEditingMapLocation] = useState(false);
  const [mapInput, setMapInput] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role === 'admin') {
      window.location.href = '/admin/dashboard';
      return;
    }
    if (role === 'doctor') {
      window.location.href = '/doctor/dashboard';
      return;
    }
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Profile & BMI
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          if (profile.full_name) setUserName(profile.full_name);
          
          const weight = parseFloat(profile.weight);
          const height = parseFloat(profile.height) / 100; // cm to m
          if (weight && height) {
            const bmiValue = (weight / (height * height)).toFixed(1);
            setMetrics(prev => ({ ...prev, bmi: bmiValue }));
          }
        }

        // 2. Fetch Daily Wellness (Calories & Water)
        const today = new Date().toISOString().split('T')[0];
        
        const { data: wellnessLog } = await supabase
          .from('wellness_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .single();

        const { data: foodScans } = await supabase
          .from('food_scans')
          .select('calories')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00Z`);

        const totalCals = foodScans?.reduce((sum, f) => sum + (f.calories || 0), 0) || 0;

        setMetrics(prev => ({ 
          ...prev, 
          water: wellnessLog?.water_intake || 0,
          calories: totalCals 
        }));

        // 3. Fetch Latest Triage Summary
        const { data: latestChat } = await supabase
          .from('chat_messages')
          .select('content')
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1);

        if (latestChat?.[0]?.content) {
          let content = latestChat[0].content;
          if (content.includes('||TRIAGE_DATA||')) {
            const parts = content.split('||TRIAGE_DATA||');
            try {
              const triageData = JSON.parse(parts[1]);
              setLatestTriage({
                assessment: triageData.assessment,
                recommendation: triageData.home_care?.[0] || "Follow clinical guidance",
                status: "Analysis Complete"
              });
            } catch (e) {
              setLatestTriage(prev => ({ ...prev, assessment: parts[0].substring(0, 200) + "..." }));
            }
          } else {
            setLatestTriage(prev => ({ ...prev, assessment: content.substring(0, 200) + "..." }));
          }
        }

      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <main className="pt-20 pb-24 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 md:space-y-12 min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Patient Intelligence Node</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-slate-900 leading-tight">
              Welcome back,<br className="sm:hidden" /> {userName}
            </h1>
            <p className="text-slate-900/80 max-w-md text-sm md:text-base lg:text-lg font-medium leading-relaxed">Your clinical data is ready for review. Monitor your vital signs and recent diagnostics below.</p>
          </div>
          <div className="shrink-0">
            <Link href="/chat">
              <button className="neural-gradient text-on-primary px-7 py-4 rounded-full font-bold flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 w-full md:w-auto justify-center whitespace-nowrap">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                <span className="text-sm md:text-base">AI Triage Assistant</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Health Metrics Column */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
          {/* BMI Metric */}
          <div className="bg-white p-6 md:p-8 rounded-3xl relative overflow-hidden group border border-slate-200 hover:bg-slate-50 shadow-md transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-9xl">fitness_center</span>
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Body Mass Index</span>
            <div className="mt-10">
              <span className="text-6xl font-extrabold text-primary tracking-tighter">{metrics.bmi}</span>
              <div className="mt-6 flex items-center gap-2 text-emerald-600 font-bold">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span className="text-[10px] uppercase tracking-widest">{parseFloat(metrics.bmi) < 25 ? 'Healthy Range' : 'Attention Needed'}</span>
              </div>
            </div>
          </div>

          {/* Calories Metric */}
          <div className="bg-white p-6 md:p-8 rounded-3xl relative overflow-hidden group border border-slate-200 hover:bg-slate-50 shadow-md transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-9xl">nutrition</span>
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Today's Intake</span>
            <div className="mt-10">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-extrabold text-primary tracking-tighter">{metrics.calories}</span>
                <span className="text-on-surface-variant font-bold text-sm uppercase tracking-widest">KCAL</span>
              </div>
              <div className="mt-6 flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined text-sm">bolt</span>
                <span className="text-[10px] uppercase tracking-widest">Active Metabolism</span>
              </div>
            </div>
          </div>

          {/* Hydration Metric */}
          <div className="bg-white p-6 md:p-8 rounded-3xl relative overflow-hidden group border border-slate-200 hover:bg-slate-50 shadow-md transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-primary">
              <span className="material-symbols-outlined text-9xl">water_drop</span>
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Hydration Level</span>
            <div className="mt-10">
              <span className="text-6xl font-extrabold text-on-background tracking-tighter">{metrics.water}L</span>
              <div className="mt-8 w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                <div 
                  className="neural-gradient h-full rounded-full shadow-sm transition-all duration-1000" 
                  style={{ width: `${Math.min((metrics.water / 2.5) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="mt-3 text-[10px] font-bold text-primary uppercase tracking-[0.1em]">{Math.round((metrics.water / 2.5) * 100)}% of daily goal</p>
            </div>
          </div>

          {/* Recent AI Triage Summary */}
          <div className="sm:col-span-3 bg-white rounded-3xl p-6 md:p-10 space-y-6 md:space-y-8 border border-slate-200 shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3 tracking-tighter">
                <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">analytics</span>
                Latest Analysis
              </h2>
              <span className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary/20">{latestTriage.status}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
              <div className="bg-slate-50 p-5 md:p-8 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-primary mb-3 uppercase tracking-widest text-xs">AI Assessment</h3>
                <p className="text-slate-700 leading-relaxed font-medium text-sm md:text-base">{latestTriage.assessment}</p>
              </div>
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-4 p-4 md:p-6 rounded-2xl bg-surface-container/50 border border-outline-variant/10 transition-transform hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-primary shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-xl">health_metrics</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Recommendation</p>
                    <p className="text-sm md:text-md font-bold text-on-background tracking-tight">{latestTriage.recommendation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 md:p-6 rounded-2xl bg-surface-container/50 border border-outline-variant/10 transition-transform hover:scale-[1.02]">
                  <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-secondary shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-xl">update</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Last Update</p>
                    <p className="text-sm md:text-md font-bold text-on-background tracking-tight">Real-time Sync Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
          <div className="neural-gradient rounded-3xl p-6 md:p-10 text-on-primary shadow-xl shadow-primary/10 relative overflow-hidden group">
            {/* Clinical background pattern */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/5 rounded-full blur-3xl transition-transform group-hover:scale-110 duration-700"></div>
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">Next Appointment</span>
              <h3 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tighter leading-tight">Dr. Alisa Meyer</h3>
              <p className="text-on-primary font-bold opacity-90 mt-1 uppercase text-xs tracking-widest">Senior Cardiologist</p>
              
              <div className="mt-6 md:mt-10 space-y-4 md:space-y-5">
                <div className="flex items-center gap-5 bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">calendar_today</span>
                  </div>
                  <span className="font-bold text-xl tracking-tight">Oct 24, 2023</span>
                </div>
                <div className="flex items-center gap-5 bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">schedule</span>
                  </div>
                  <span className="font-bold text-xl tracking-tight">10:30 AM</span>
                </div>
              </div>
              
              <div className="mt-8 md:mt-12 flex gap-4">
                <button className="flex-1 bg-white text-primary py-4 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform active:scale-95">Reschedule</button>
                <button className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg">
                  <span className="material-symbols-outlined text-xl">videocam</span>
                </button>
              </div>
            </div>
          </div>

          {/* Profile Action Chip */}
          <div className="bg-surface-container-low p-10 rounded-3xl space-y-6 border border-outline-variant/30 shadow-sm">
            <h4 className="font-bold text-primary uppercase text-[10px] tracking-[0.3em]">Patient Profile</h4>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Keep your medical history and clinical notes updated for accurate assessments.</p>
            <Link href="/profile" className="block w-full">
              <button className="w-full py-4 bg-surface-container-highest text-on-background rounded-full text-xs font-bold uppercase tracking-widest border border-outline-variant/50 hover:bg-surface-container transition-all">Update Clinical Info</button>
            </Link>
            <div className="flex flex-wrap gap-3 pt-4">
              <span className="px-5 py-2 bg-surface-container-highest text-secondary text-[10px] font-bold uppercase tracking-widest rounded-full border border-outline-variant/30">Diagnostics</span>
              <span className="px-5 py-2 bg-surface-container-highest text-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-outline-variant/30">History</span>
            </div>
          </div>

          {/* Map Widget (Clinical Style with Edit Feature) */}
          <div className="rounded-3xl overflow-hidden h-72 relative shadow-lg group border border-outline-variant/30 bg-slate-900">
            <img 
              alt="Clinic Location Map" 
              className="w-full h-full object-cover opacity-60 transition-transform duration-1000 group-hover:scale-110" 
              src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80" 
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80"></div>
            
            <div className="absolute bottom-6 left-6 right-6 space-y-4">
              {isEditingMapLocation ? (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mapInput.trim()) {
                      setStoreLocation(mapInput);
                      setIsEditingMapLocation(false);
                    }
                  }}
                  className="animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="glass-panel p-2 rounded-2xl flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20">
                    <input
                      autoFocus
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-white px-4 py-2"
                      value={mapInput}
                      onChange={e => setMapInput(e.target.value)}
                      placeholder="Enter new clinical location..."
                    />
                    <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </button>
                    <button type="button" onClick={() => setIsEditingMapLocation(false)} className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="glass-panel p-5 rounded-2xl flex items-center justify-between shadow-2xl bg-white/10 backdrop-blur-md border border-white/10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Clinical Node Location</p>
                    <p className="text-sm font-bold text-white tracking-tight">{storeLocation}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setMapInput(storeLocation === 'Detecting...' ? '' : storeLocation);
                      setIsEditingMapLocation(true);
                    }}
                    className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                  >
                    <span className="material-symbols-outlined">edit_location</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
