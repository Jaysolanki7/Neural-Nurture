"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function WellnessPage() {
  const [meals, setMeals] = useState([]);
  const [dailyLog, setDailyLog] = useState(null);
  const [loggedMeals, setLoggedMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [dietPreference, setDietPreference] = useState('Balanced');
  const [medicalContext, setMedicalContext] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [protocol, setProtocol] = useState({
    vitamins: [],
    protein: 'Calculating...',
    focus: 'Detecting...'
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchWellnessData();
  }, [selectedDate]);

  const fetchWellnessData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = selectedDate.toISOString().split('T')[0];

      // Fetch Medical Context
      const { data: medData } = await supabase
        .from('medical_records')
        .select('*')
        .eq('user_id', user.id);
      
      setMedicalContext(medData || []);
      generateProtocol(medData || []);

      // Fetch Logged Meals for the selected day
      const { data: scanData } = await supabase
        .from('food_scans')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lte('created_at', `${dateStr}T23:59:59Z`);

      setLoggedMeals(scanData || []);

      // Fetch Meal Plan (7-day static)
      const { data: mealData } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setMeals(mealData || []);

      // Fetch Daily Wellness Log (Water, etc)
      const { data: logData } = await supabase
        .from('wellness_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', dateStr)
        .single();

      setDailyLog(logData || {
        water_intake: 0,
        mindfulness_minutes: 0,
        vitamin_taken: false,
        daily_score: 0
      });

    } catch (error) {
      console.error('Error fetching wellness data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateProtocol = (records) => {
    const context = records.map(r => r.category).join(' ');
    let protocolData = {
      vitamins: ['Multi-Vitamin', 'Vitamin D3'],
      protein: '0.8g/kg',
      focus: 'General Maintenance'
    };

    if (context.includes('Diagnostic')) {
      protocolData.vitamins.push('B-Complex', 'Omega-3');
      protocolData.protein = '1.2g/kg (High Recovery)';
      protocolData.focus = 'Clinical Recovery';
    } else if (context.includes('Analysis')) {
      protocolData.vitamins.push('Magnesium', 'Zinc');
      protocolData.protein = '1.0g/kg (Optimized)';
      protocolData.focus = 'Peak Performance';
    }

    setProtocol(protocolData);
  };

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setShowScanner(true);
    setScanResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result;
        setCapturedImage(base64Image);

        const response = await fetch('/api/wellness/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image }),
        });

        const data = await response.json();
        if (data.success) {
          setScanResult(data.analysis);
          toast.success('Food identified! Review and add to log.');
        } else {
          toast.error('AI Analysis failed');
        }
        setIsScanning(false);
      };
    } catch (error) {
      toast.error('Error scanning food');
      setIsScanning(false);
    }
  };

  const addToDailyLog = async () => {
    if (!scanResult) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('food_scans').insert({
        user_id: user.id,
        created_at: selectedDate.toISOString(), // Ensure meal is logged to the selected date
        food_name: scanResult.food_name,
        calories: parseInt(scanResult.calories) || 0,
        protein: scanResult.protein,
        vitamins: scanResult.vitamins,
        benefits: scanResult.benefits,
        risks: scanResult.risks,
        full_analysis: {
          ...scanResult,
          logged_at: selectedDate.toISOString()
        }
      });

      if (error) throw error;
      toast.success('Added to daily meal log!');
      setShowScanner(false);
      fetchWellnessData();
    } catch (error) {
      toast.error('Failed to log meal');
    }
  };

  const removeLoggedMeal = async (id) => {
    try {
      const { error } = await supabase.from('food_scans').delete().eq('id', id);
      if (error) throw error;
      toast.success('Meal removed from log');
      fetchWellnessData();
    } catch (error) {
      toast.error('Failed to remove meal');
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setIsGenerating(true);
      setShowPlanModal(false);
      const res = await fetch('/api/wellness/generate-plan', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference: dietPreference })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`7-Day ${dietPreference} Plan Generated!`);
        fetchWellnessData();
      } else {
        toast.error('AI Generation failed');
      }
    } catch (error) {
      toast.error('Error connecting to AI engine');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateLog = async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const dateStr = selectedDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('wellness_logs')
        .upsert({
          user_id: user.id,
          log_date: dateStr,
          ...dailyLog,
          ...updates
        });

      if (!error) {
        setDailyLog(prev => ({ ...prev, ...updates }));
        toast.success('Log updated');
      }
    } catch (error) {
      toast.error('Failed to update log');
    }
  };

  const calculateTotals = () => {
    return loggedMeals.reduce((acc, meal) => {
      const p = parseInt(meal.protein) || 0;
      const c = parseInt(meal.full_analysis?.carbs) || 0;
      const f = parseInt(meal.full_analysis?.fats) || 0;
      return {
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + p,
        carbs: acc.carbs + c,
        fats: acc.fats + f
      };
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
  };

  const totals = calculateTotals();

  // Calendar Helper
  const getDaysInMonth = () => {
    const days = [];
    const today = new Date();
    for (let i = -3; i < 4; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  return (
    <main className="pt-24 pb-8 px-4 md:px-8 max-w-7xl mx-auto font-body">
      {/* Hero Section */}
      <section className="mb-12 relative overflow-hidden rounded-[3rem] p-8 md:p-14 bg-slate-950 text-white shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-10 right-10 w-96 h-96 bg-blue-600 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-indigo-600 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-xl">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black tracking-[0.4em] uppercase text-blue-400">Metabolic Intelligence</span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] text-white">Daily <br /> Nutrition Log</h1>
            <p className="text-slate-400 text-lg md:text-2xl font-medium leading-relaxed max-w-lg">Capture, analyze, and track your clinical intake with precision vision models.</p>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => fileInputRef.current.click()}
                className="bg-white text-slate-950 px-10 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-4"
              >
                <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                New Scan
              </button>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} className="hidden" />
            </div>
          </div>
          
          {/* Daily Macros Display */}
          <div className="w-full md:w-auto flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-3">Calories</p>
                  <p className="text-5xl font-black">{totals.calories}</p>
               </div>
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-3">Protein</p>
                  <p className="text-5xl font-black">{totals.protein}g</p>
               </div>
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.4em] mb-3">Carbs</p>
                  <p className="text-5xl font-black">{totals.carbs}g</p>
               </div>
               <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center min-w-[180px]">
                  <p className="text-[9px] font-black text-pink-400 uppercase tracking-[0.4em] mb-3">Fats</p>
                  <p className="text-5xl font-black">{totals.fats}g</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar Strip */}
      <section className="mb-12">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-6 px-2">
          {getDaysInMonth().map((date, i) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`min-w-[120px] p-6 rounded-[2.5rem] border transition-all flex flex-col items-center gap-2 group ${isSelected ? 'bg-slate-950 border-slate-950 text-white shadow-2xl scale-110 z-10' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-3xl font-black tracking-tighter">{date.getDate()}</span>
                {isToday && !isSelected && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Logged Meals */}
        <div className="lg:col-span-8 space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black text-slate-950 tracking-tighter">Daily Consumption</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AnimatePresence mode="popLayout">
              {loggedMeals.length > 0 ? loggedMeals.map((meal) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={meal.id} 
                  className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20 group relative overflow-hidden"
                >
                  <div className="absolute top-6 right-6 flex gap-2">
                    <button 
                      onClick={() => removeLoggedMeal(meal.id)}
                      className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-600 transition-all duration-500">
                        <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-white">restaurant</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{meal.food_name}</h3>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{meal.calories} kcal</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Protein</p>
                        <p className="text-sm font-black text-slate-900">{meal.protein}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Carbs</p>
                        <p className="text-sm font-black text-slate-900">{meal.full_analysis?.carbs || 'N/A'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Fats</p>
                        <p className="text-sm font-black text-slate-900">{meal.full_analysis?.fats || 'N/A'}</p>
                      </div>
                    </div>

                    <p className="text-slate-500 text-xs leading-relaxed font-medium line-clamp-2">{meal.benefits}</p>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-1 md:col-span-2 py-32 text-center bg-slate-50 rounded-[4rem] border-4 border-dashed border-white">
                  <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <span className="material-symbols-outlined text-5xl text-slate-200">no_food</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-950 tracking-tighter">Day is Clear</h3>
                  <p className="text-slate-400 font-black mt-4 uppercase tracking-[0.4em] text-[10px]">No meals logged for this cycle.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Wellness Metrics */}
        <aside className="lg:col-span-4 space-y-8">
           <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl shadow-slate-200/10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-14 bg-slate-950 text-white rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">analytics</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-950 tracking-tighter">Bio-Metrics</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status Tracking</p>
                </div>
              </div>

              <div className="space-y-8">
                 {/* Water */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Hydration Level</p>
                      <p className="text-xl font-black text-blue-600">{dailyLog?.water_intake || 0}L</p>
                    </div>
                    <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex p-1">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(((dailyLog?.water_intake || 0) / 2.5) * 100, 100) || 0}%` }}
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                      ></motion.div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => updateLog({ water_intake: Math.max(0, (dailyLog?.water_intake || 0) - 0.25) })}
                        className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-sm">remove</span>
                      </button>
                      <button 
                        onClick={() => updateLog({ water_intake: (dailyLog?.water_intake || 0) + 0.25 })} 
                        className="flex-[3] py-4 rounded-2xl bg-blue-50 text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add 250ml
                      </button>
                    </div>
                 </div>

                 {/* Protein Compliance */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Protein Goal</p>
                      <p className="text-xl font-black text-emerald-600">{totals.protein} / 80g</p>
                    </div>
                    <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex p-1">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((totals.protein / 80) * 100, 100)}%` }}
                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                      ></motion.div>
                    </div>
                 </div>

                 {/* Vitamins */}
                 <button 
                  onClick={() => updateLog({ vitamin_taken: !dailyLog?.vitamin_taken })}
                  className={`w-full p-8 rounded-[2.5rem] border-2 transition-all flex items-center justify-between ${dailyLog?.vitamin_taken ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}
                 >
                    <div className="flex items-center gap-6">
                      <span className={`material-symbols-outlined text-4xl ${dailyLog?.vitamin_taken ? 'text-emerald-600' : 'text-slate-200'}`}>medication</span>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Supplement Stack</p>
                        <p className="text-lg font-black text-slate-950">{dailyLog?.vitamin_taken ? 'Protocol Active' : 'Stack Pending'}</p>
                      </div>
                    </div>
                    {dailyLog?.vitamin_taken && <span className="material-symbols-outlined text-emerald-600">verified</span>}
                 </button>
              </div>
           </div>

           <div className="bg-slate-950 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-3xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]"></div>
              <span className="material-symbols-outlined text-5xl text-blue-500 mb-8 opacity-50">tips_and_updates</span>
              <h4 className="text-2xl font-black tracking-tight leading-tight mb-4">Neural Suggestion</h4>
              <p className="text-slate-500 font-medium leading-relaxed">
                {totals.calories < 1500 ? "Caloric intake is low for your activity profile. Consider a high-density snack." : "Nutritional balance is optimal. Your metabolic rate is steady."}
              </p>
           </div>
        </aside>
      </div>

      {/* AI Scanner Modal 4.0 */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] overflow-hidden shadow-3xl flex flex-col border border-slate-200"
            >
              <div className="p-8 md:p-12 overflow-y-auto flex-1 space-y-10">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <span className="material-symbols-outlined">biotech</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-950">Bio-Scan Result</h2>
                  </div>
                  <button onClick={() => setShowScanner(false)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-all">
                    <span className="material-symbols-outlined text-slate-600">close</span>
                  </button>
                </div>

                {isScanning ? (
                  <div className="py-20 flex flex-col items-center gap-8">
                    <div className="w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Analyzing Molecular Density...</p>
                  </div>
                ) : scanResult ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div className="w-full aspect-square rounded-[2.5rem] overflow-hidden shadow-inner border-4 border-white">
                        <img src={capturedImage} className="w-full h-full object-cover" alt="Scanned Food" />
                      </div>
                      <div className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-4">Molecular Name</h3>
                        <p className="text-5xl font-black text-slate-950 tracking-tighter">{scanResult.food_name}</p>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Calories</p>
                          <p className="text-4xl font-black text-slate-950">{scanResult.calories}</p>
                        </div>
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Protein</p>
                          <p className="text-4xl font-black text-blue-600">{scanResult.protein}</p>
                        </div>
                      </div>
                      <div className="p-10 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-4">Metabolic Benefits</h4>
                        <p className="text-lg font-medium text-slate-700 leading-relaxed italic">"{scanResult.benefits}"</p>
                      </div>
                      <div className="p-10 bg-amber-50 rounded-[2.5rem] border border-amber-100">
                        <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.4em] mb-4">Clinical Risks</h4>
                        <p className="text-lg font-medium text-slate-700 leading-relaxed italic">"{scanResult.risks}"</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-8 md:p-10 bg-white border-t border-slate-100 flex gap-6">
                <button onClick={() => setShowScanner(false)} className="flex-1 py-6 text-slate-400 font-black text-[10px] uppercase tracking-[0.5em] hover:text-slate-950 transition-colors">Discard</button>
                <button 
                  onClick={addToDailyLog}
                  className="flex-[2] py-6 bg-slate-950 text-white font-black text-[10px] uppercase tracking-[0.5em] rounded-3xl shadow-2xl shadow-slate-950/30 hover:scale-105 active:scale-95 transition-all"
                >
                  Confirm & Add to Log
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Plan Modal (Generated Plan) */}
      <AnimatePresence>
        {showPlanModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-12 shadow-3xl border border-slate-100"
            >
              <h2 className="text-4xl font-black tracking-tighter text-slate-950 mb-8">AI Plan Architect</h2>
              <div className="grid grid-cols-2 gap-4 mb-10">
                {['Balanced', 'Keto', 'Vegan', 'High Protein'].map(pref => (
                  <button 
                    key={pref}
                    onClick={() => setDietPreference(pref)}
                    className={`p-6 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${dietPreference === pref ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowPlanModal(false)} className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleGeneratePlan} className="flex-[2] py-5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg">Execute Synthesis</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
