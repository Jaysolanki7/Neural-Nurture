'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { secureStorage } from '../../lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateBMI, getBMICategory } from '../../lib/utils';

export default function ProfilePage() {
    const [mounted, setMounted] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('patient');
    
    // Patient Fields
    const [bloodType, setBloodType] = useState('');
    const [allergies, setAllergies] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [profilePic, setProfilePic] = useState('');
    
    // Doctor Fields
    const [specialty, setSpecialty] = useState('');
    const [experience, setExperience] = useState('');
    const [fee, setFee] = useState('');
    const [location, setLocation] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');

    const [storageUsage, setStorageUsage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();
    const fileInputRef = useRef(null);

    const currentBMI = calculateBMI(weight, height);
    const bmiInfo = getBMICategory(currentBMI);

    useEffect(() => {
        setMounted(true);
        const storedName = secureStorage.getItem('user_name');
        const storedEmail = secureStorage.getItem('user_email');
        const storedRole = secureStorage.getItem('user_role') || 'patient';
        
        if (storedName) setName(storedName);
        if (storedEmail) setEmail(storedEmail);
        setRole(storedRole);

        fetchProfileData();
        fetchStorageUsage();
        recordLocation();
    }, []);

    const recordLocation = () => {
        const cachedLocation = localStorage.getItem('user_temp_location');
        if (cachedLocation) {
            console.log("Using cached location:", JSON.parse(cachedLocation));
            return;
        }

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const locData = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: Date.now()
                };
                localStorage.setItem('user_temp_location', JSON.stringify(locData));
                console.log("Location recorded and cached:", locData);
            }, (error) => {
                console.warn("Location access denied:", error.message);
            });
        }
    };

    const fetchStorageUsage = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('medical_records')
            .select('id')
            .eq('user_id', user.id);

        if (data) {
            const totalBytes = data.length * 2.5 * 1024 * 1024;
            const mb = (totalBytes / (1024 * 1024)).toFixed(1);
            setStorageUsage(mb);
        }
    };

    const fetchProfileData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const storedRole = secureStorage.getItem('user_role') || 'patient';
        const storedName = secureStorage.getItem('user_name');

        if (storedRole === 'doctor') {
            const { data } = await supabase
                .from('doctors')
                .select('*')
                .eq('name', storedName)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (data) {
                setSpecialty(data.specialty || '');
                setFee(data.price || '');
                setLocation(data.location || '');
                setLatitude(data.latitude || '');
                setLongitude(data.longitude || '');
            }
        } else {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (data) {
                if (data.full_name) {
                    setName(data.full_name);
                    secureStorage.setItem('user_name', data.full_name);
                }
                setBloodType(data.blood_type || '');
                setAllergies(data.allergies || '');
                setMedicalHistory(data.medical_history || '');
                setEmergencyContact(data.emergency_contact || '');
                setAge(data.age?.toString() || '');
                setGender(data.gender || '');
                setHeight(data.height?.toString() || '');
                setWeight(data.weight?.toString() || '');
                setProfilePic(data.avatar_url || '');
            }
        }
    };

    const handleProfilePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const fileExt = file.name.split('.').pop();
            const fileName = `avatars/${user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('medical-files')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('medical-files')
                .getPublicUrl(fileName);

            setProfilePic(urlData.publicUrl);
            toast.success('Identity node updated');
        } catch (error) {
            toast.error('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            if (role === 'doctor') {
                const { error } = await supabase
                    .from('doctors')
                    .insert([{ 
                        name: name, 
                        specialty, 
                        location, 
                        latitude, 
                        longitude, 
                        price: fee 
                    }]);
                if (error) throw error;
                secureStorage.setItem('user_name', name);
                toast.success('Professional Profile Updated');
            } else {
                const parsedAge = age ? parseInt(age) : null;
                const parsedHeight = height ? parseFloat(height) : null;
                const parsedWeight = weight ? parseFloat(weight) : null;
                
                // Prepare profile data
                const profileData = {
                    id: user.id,
                    full_name: name,
                    blood_type: bloodType,
                    allergies: allergies,
                    medical_history: medicalHistory,
                    emergency_contact: emergencyContact,
                    age: parsedAge,
                    gender: gender,
                    height: parsedHeight,
                    weight: parsedWeight,
                    avatar_url: profilePic,
                    updated_at: new Date(),
                };

                // Try full upsert
                const { error } = await supabase
                    .from('profiles')
                    .upsert(profileData);

                if (error) {
                    console.warn("Schema mismatch detected, falling back to basic profile sync...");
                    const { age: ageCol, gender: genderCol, height: hCol, weight: wCol, ...basicData } = profileData;
                    const { error: retryError } = await supabase
                        .from('profiles')
                        .upsert(basicData);
                    
                    if (retryError) throw retryError;
                    
                    secureStorage.setItem('user_name', name);
                    toast.error('Extended metrics not saved: Columns missing in Database.');
                } else {
                    secureStorage.setItem('user_name', name);
                    toast.success('Profile Synced Successfully');
                }
            }
            setIsEditing(false);
            await fetchProfileData();
        } catch (error) {
            toast.error('Sync Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFDFD] font-sans selection:bg-blue-100 pb-32">
            {/* Immersive Header with Framed Design */}
            <section className="relative px-4 md:px-12 pt-28 md:pt-36 pb-12 md:pb-24 overflow-hidden">
                <div className="absolute inset-0 bg-[#FDFDFD]"></div>
                
                {/* The Frame */}
                <div className="max-w-[1400px] mx-auto relative rounded-[2rem] md:rounded-[4rem] overflow-hidden bg-slate-900 shadow-2xl group" style={{minHeight: '200px'}}>
                    {/* Background Image */}
                    <div className="absolute inset-0 opacity-40">
                        <img 
                            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                            alt="Identity Banner" 
                        />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>

                    <div className="relative z-10 p-6 sm:p-10 md:p-16 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-10 md:pb-14">
                        <div className="flex flex-row flex-wrap justify-between items-end gap-4 sm:gap-6">
                            <div className="space-y-2 sm:space-y-4 min-w-0">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[8px] sm:text-[9px] font-black tracking-[0.3em] sm:tracking-[0.4em] uppercase text-blue-400 backdrop-blur-md">Identity Node</span>
                                <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter leading-none truncate max-w-[55vw] sm:max-w-none">{name}</h1>
                                <p className="text-slate-400 font-medium text-sm sm:text-lg md:text-xl uppercase tracking-widest">{role}</p>
                            </div>
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className="flex-shrink-0 bg-white text-slate-950 px-5 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-2xl whitespace-nowrap"
                            >
                                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <main className="max-w-[1400px] mx-auto -mt-4 md:-mt-10 px-4 md:px-12 relative z-20 grid grid-cols-12 gap-8 md:gap-12">
                
                {/* Profile Overview (Left) */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[3rem] p-10 md:p-12 border border-white shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="relative group/avatar mb-8">
                                <div className="w-32 h-32 md:w-48 md:h-48 rounded-[3rem] bg-slate-100 overflow-hidden border-8 border-white shadow-2xl">
                                    {profilePic ? (
                                        <img src={profilePic} className="w-full h-full object-cover" alt="Profile" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                                            <span className="material-symbols-outlined text-8xl">account_circle</span>
                                        </div>
                                    )}
                                </div>
                                {isEditing && (
                                    <button 
                                        onClick={() => fileInputRef.current.click()}
                                        className="absolute bottom-2 right-2 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-all"
                                    >
                                        <span className="material-symbols-outlined">add_a_photo</span>
                                    </button>
                                )}
                                <input type="file" ref={fileInputRef} onChange={handleProfilePicUpload} className="hidden" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-950 tracking-tighter mb-2">{name}</h2>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">{email}</p>
                            
                            {/* BMI Visualization */}
                            {currentBMI && (
                                <div className="w-full p-6 bg-slate-50 rounded-3xl mb-8 border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Body Mass Index</p>
                                    <div className="flex items-end gap-3">
                                        <span className="text-5xl font-black text-slate-950 tracking-tighter">{currentBMI}</span>
                                        <span className={`text-[10px] font-black uppercase mb-2 ${bmiInfo.color}`}>{bmiInfo.label}</span>
                                    </div>
                                </div>
                            )}

                            <div className="w-full pt-8 border-t border-slate-50 space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Cloud Capacity</span>
                                    <span>{storageUsage}% Used</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${storageUsage}%` }}
                                        className="h-full bg-blue-600"
                                    ></motion.div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-[3rem] p-10 md:p-12 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl"></div>
                        <div className="relative z-10 space-y-6">
                            <span className="material-symbols-outlined text-4xl text-blue-500">verified</span>
                            <h3 className="text-2xl font-black tracking-tight leading-tight">Security Protocol</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">Your identity node is encrypted with AES-256 and audited for HIPAA compliance.</p>
                            <div className="pt-4 flex items-center gap-3">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">Operational</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Section (Right) */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="bg-white/90 backdrop-blur-3xl rounded-[3rem] p-8 md:p-14 border border-white shadow-2xl">
                        <AnimatePresence mode="wait">
                            {isEditing ? (
                                <motion.form 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    onSubmit={handleSaveProfile} 
                                    className="space-y-10"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Full Name</label>
                                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all" type="text" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Blood Group</label>
                                            <select value={bloodType} onChange={e => setBloodType(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all appearance-none">
                                                <option value="">Select</option>
                                                <option value="A+">A+</option><option value="A-">A-</option>
                                                <option value="B+">B+</option><option value="B-">B-</option>
                                                <option value="O+">O+</option><option value="O-">O-</option>
                                                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Age (Years)</label>
                                            <input value={age} onChange={e => setAge(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all" type="number" placeholder="e.g. 25" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Gender</label>
                                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all appearance-none">
                                                <option value="">Select</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Non-binary">Non-binary</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100/50">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Height (cm)</label>
                                            <input value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-white border-2 border-transparent focus:border-blue-200 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all shadow-sm" type="number" placeholder="175" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Weight (kg)</label>
                                            <input value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-white border-2 border-transparent focus:border-blue-200 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all shadow-sm" type="number" placeholder="70" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Calculated BMI</label>
                                            <div className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 px-6 text-blue-600 font-black shadow-sm flex items-center justify-between">
                                                <span>{currentBMI || '--'}</span>
                                                <span className={`text-[8px] px-2 py-1 rounded-md bg-blue-50 ${bmiInfo?.color || 'text-slate-400'}`}>{bmiInfo?.label || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Emergency Contact</label>
                                        <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-black outline-none transition-all" placeholder="Name & Number" type="text" />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Known Allergies</label>
                                        <textarea value={allergies} onChange={e => setAllergies(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-medium min-h-[120px] outline-none transition-all"></textarea>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 ml-1">Medical History</label>
                                        <textarea value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-50 rounded-2xl py-5 px-6 text-slate-950 font-medium min-h-[150px] outline-none transition-all"></textarea>
                                    </div>

                                    <button disabled={loading} className="w-full py-6 rounded-3xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.4em] shadow-3xl shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4" type="submit">
                                        <span className="material-symbols-outlined">{loading ? 'sync' : 'save'}</span>
                                        {loading ? 'Synchronizing Node...' : 'Commit Changes'}
                                    </button>
                                </motion.form>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-12"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Blood Node</p>
                                            <p className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter">{bloodType || 'N/A'}</p>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Age</p>
                                            <p className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter">{age || 'N/A'}</p>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Height</p>
                                            <p className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter">{height || 'N/A'}<span className="text-xs ml-1">cm</span></p>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Weight</p>
                                            <p className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter">{weight || 'N/A'}<span className="text-xs ml-1">kg</span></p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] px-2">Clinical Context</h4>
                                        <div className="space-y-4">
                                            <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Allergy Registry</p>
                                                <p className="text-slate-600 font-medium leading-relaxed">{allergies || 'Zero known clinical sensitivities detected.'}</p>
                                            </div>
                                            <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">History Archives</p>
                                                <p className="text-slate-600 font-medium leading-relaxed">{medicalHistory || 'No longitudinal medical history on record.'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {mounted && (
                                        <div className="pt-8 border-t border-slate-50">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] text-center">Last Synced: {new Date().toLocaleDateString()}</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}
