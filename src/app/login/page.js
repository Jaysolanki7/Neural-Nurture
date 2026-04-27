"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { secureStorage } from '../../lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../lib/store';
import { getURL } from '../../lib/utils';


export default function AuthPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [role, setRole] = useState('patient'); 
  const [otpType, setOtpType] = useState('email');
  const router = useRouter();
  const setUser = useStore(state => state.setUser);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  const validateEmailFormat = (val) => {
    if (!val) return 'Email required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) return 'Invalid email';
    return '';
  };

  const validatePasswordFormat = (val) => {
    if (!val) return 'Password required';
    if (val.length < 8) return 'Min 8 chars';
    if (!/[A-Z]/.test(val)) return 'Need 1 uppercase';
    if (!/[a-z]/.test(val)) return 'Need 1 lowercase';
    if (!/[0-9]/.test(val)) return 'Need 1 number';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)) return 'Need 1 special char';
    return '';
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val.length > 0) setEmailError(validateEmailFormat(val));
    else setEmailError('');
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (val.length > 0) setPasswordError(validatePasswordFormat(val));
    else setPasswordError('');
  };

  const formatPhoneNumber = (num) => {
    let str = num.trim();
    if (str.startsWith('+')) return str.replace(/\s+/g, '');
    let cleaned = str.replace(/\D/g, '');
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.length > 10 && cleaned.startsWith('91')) return `+${cleaned}`;
    return str.replace(/\s+/g, '');
  };

  const handleOtpEmailChange = (e) => {
    const val = e.target.value;
    setOtpEmail(val);
    if (val.length > 0 && val.includes('@')) setEmailError(validateEmailFormat(val));
    else setEmailError(''); // No format validation for phone here
  };

  useEffect(() => {
    if (isOtpMode) {
      setIsFormValid(otpEmail.length > 0 && (!otpEmail.includes('@') || !validateEmailFormat(otpEmail)));
    } else {
      const eErr = validateEmailFormat(email);
      const pErr = validatePasswordFormat(password);
      if (isLoginMode) {
        setIsFormValid(!eErr && !pErr);
      } else {
        setIsFormValid(!eErr && !pErr && firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length > 0);
      }
    }
  }, [email, password, firstName, lastName, phone, isLoginMode, isOtpMode, otpEmail]);

  const handleKeyDown = (e, nextFieldId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      }
    }
  };

  const handleOtpBoxChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = otpCode.split('');
    newOtp[index] = value.substring(value.length - 1);
    const updated = newOtp.join('').padEnd(index, ' ');
    setOtpCode(updated);
    
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpBoxKeyDown = (index, e) => {
    if (e.key === 'Backspace' && (!otpCode[index] || otpCode[index] === ' ') && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getURL()}login?reset=true`
    });
    if (error) {
      toast.error(error.message);
      setErrorMsg(error.message);
    } else {
      toast.success("Password reset link sent to your email.");
      setIsResetMode(false);
    }
    setLoading(false);
  };


  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getURL()}auth/callback?next=/dashboard`
        }
      });
      if (error) {
        toast.error(error.message);
        setErrorMsg(error.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const isPhone = !otpEmail.includes('@');
      const formattedContact = isPhone ? formatPhoneNumber(otpEmail) : otpEmail;
      
      const params = isPhone 
        ? { phone: formattedContact } 
        : { email: formattedContact, options: { emailRedirectTo: `${getURL()}auth/callback`, shouldCreateUser: true } };

      const { error } = await supabase.auth.signInWithOtp(params);
      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
      } else {
        setOtpSent(true);
        setOtpType(isPhone ? 'sms' : 'email');
        toast.success(`Check your ${isPhone ? 'phone' : 'email'} for the OTP code!`);
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isPhone = !otpEmail.includes('@');
      const formattedContact = isPhone ? formatPhoneNumber(otpEmail) : otpEmail;

      let verifyParams = {
        token: otpCode,
        type: otpType
      };
      
      if (isPhone) verifyParams.phone = formattedContact;
      else verifyParams.email = formattedContact;

      let { data, error } = await supabase.auth.verifyOtp(verifyParams);

      if (error && otpType === 'email') {
         // Some Supabase versions use 'magiclink' type for OTP sign-ins
         const retryParams = { ...verifyParams, type: 'magiclink' };
         const retry = await supabase.auth.verifyOtp(retryParams);
         data = retry.data;
         error = retry.error;
      }

      if (error) {
        toast.error(error.message);
        setErrorMsg(error.message);
        setLoading(false);
      } else {
        toast.success('Successfully authenticated!');
        const userRole = data.user?.user_metadata?.role || 'patient';
        const name = data.user?.user_metadata?.first_name || otpEmail.split('@')[0];
        
        secureStorage.setItem('user_name', name);
        secureStorage.setItem('user_email', otpEmail);
        secureStorage.setItem('user_role', userRole);
        if (data.session) secureStorage.setItem('session_id', data.session.access_token);
        
        // Update Zustand Store
        setUser({ name, email: otpEmail, role: userRole });
        
        window.location.href = '/dashboard';
      }

    } catch (err) {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      if (isLoginMode) {
        const adminUser = process.env.NEXT_PUBLIC_ADMIN_USERNAME;
        const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
        const isAdminEnabled = process.env.NEXT_PUBLIC_IS_ADMIN_ENABLED === 'true';

        if (isAdminEnabled && adminUser && adminPass && email.trim() === adminUser.trim() && password === adminPass) {
          toast.success('Admin access granted.');
          secureStorage.setItem('user_name', 'Administrator');
          secureStorage.setItem('user_role', 'admin');
          sessionStorage.setItem('admin_auth', 'true');
          window.location.replace('/admin/dashboard');
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
          setErrorMsg(error.message);
          setLoading(false);
        } else {
          toast.success('Login Successful!');
          const userRole = data.user?.user_metadata?.role || 'patient';
          const name = data.user?.user_metadata?.first_name || email.split('@')[0];
          secureStorage.setItem('user_name', name);
          secureStorage.setItem('user_email', data.user.email);
          secureStorage.setItem('user_role', userRole);
          secureStorage.setItem('session_id', data.session.access_token);
          
          // Update Zustand Store
          setUser({ name, email: data.user.email, role: userRole });

          window.location.href = '/dashboard';
        }

      } else {
        const formattedPhone = phone ? formatPhoneNumber(phone) : phone;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName, role: role, phone: formattedPhone }
          }
        });
        if (error) {
          toast.error(error.message);
          setErrorMsg(error.message);
          setLoading(false);
        } else {
          toast.success('Account Created! Please check your email for the verification code.');
          setOtpEmail(email);
          setIsOtpMode(true);
          setOtpSent(true);
          setOtpType('signup');
          setLoading(false);
        }
      }
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-['Manrope']">
      
      {/* High-Contrast Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          animate={{ x: [0, 150, 0], y: [0, -100, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-400/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, -150, 0], y: [0, 100, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-blue-400/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
      </div>

      <Link href="/" className="absolute top-8 left-8 z-50 group">
        <motion.div 
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/60 flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-900/5 transition-all"
        >
          <span className="material-symbols-outlined font-bold">arrow_back</span>
        </motion.div>
      </Link>

      <motion.main 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
      >
        {/* Modern Branding */}
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.05 }}
            className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-6 border-[3px] border-white/50 backdrop-blur-sm"
          >
            <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-slate-900 mb-2">Medi<span className="text-indigo-600">AI</span></h1>
          <p className="text-slate-500 font-bold tracking-[0.4em] text-[9px] uppercase">Quantum Clinical OS</p>
        </div>

        {/* High-Contrast Light Glass Card */}
        <div className="bg-white/80 backdrop-blur-2xl p-10 rounded-[32px] border border-white/60 shadow-2xl shadow-indigo-900/10 relative overflow-hidden">
          
          <div className="flex p-1.5 bg-slate-100/80 rounded-[18px] mb-8 border border-slate-200/50 backdrop-blur-md">
            <button 
              onClick={() => { setIsLoginMode(true); setIsOtpMode(false); setIsResetMode(false); }}
              className={`flex-1 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${isLoginMode && !isResetMode ? 'bg-white text-indigo-600 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLoginMode(false); setIsOtpMode(false); setIsResetMode(false); }}
              className={`flex-1 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${!isLoginMode && !isResetMode ? 'bg-white text-indigo-600 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Register
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isResetMode ? 'reset' : isOtpMode ? 'otp' : isLoginMode ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLoginMode ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLoginMode ? 10 : -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <header className="mb-8">
                <h2 className="text-[26px] font-extrabold text-slate-900 mb-2 tracking-tight">
                  {isResetMode ? 'Reset Password' : isOtpMode ? 'One-Time Access' : isLoginMode ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  {isResetMode ? 'Enter your email to receive a secure reset link.' : isOtpMode ? 'Verify your identity with the code sent to your email.' : isLoginMode ? 'Sign in to access your clinical diagnostics.' : 'Create your account to start your journey.'}
                </p>
              </header>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50/80 border border-red-200 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm backdrop-blur-md">
                  <span className="material-symbols-outlined text-[20px]">error</span>
                  {errorMsg}
                </div>
              )}

              {isResetMode ? (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Clinical Email</label>
                      {emailError && <span className="text-[10px] font-bold text-red-500">{emailError}</span>}
                    </div>
                    <div className="relative">
                      <input 
                        required 
                        value={email} 
                        onChange={handleEmailChange} 
                        className={`w-full bg-white/50 border ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : email && !emailError ? 'border-green-400 focus:border-green-500 focus:ring-green-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 rounded-2xl py-4 px-5 pr-12 text-slate-900 font-semibold transition-all outline-none`} 
                        placeholder="name@mediai.com" 
                        type="email" 
                      />
                    </div>
                  </div>
                  <button 
                    disabled={loading || !email || emailError} 
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold text-[13px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6" 
                    type="submit"
                  >
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                    <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                  </button>
                  <div className="text-center mt-4">
                    <button type="button" onClick={() => setIsResetMode(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors">Back to Login</button>
                  </div>
                </form>
              ) : !isOtpMode ? (
                <form onSubmit={handleAuth} className="space-y-5">
                  {!isLoginMode && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">First Name</label>
                          <input id="firstName" required value={firstName} onChange={e => setFirstName(e.target.value)} onKeyDown={e => handleKeyDown(e, 'lastName')} className="w-full bg-white/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl py-4 px-5 text-slate-900 font-semibold transition-all outline-none" placeholder="Julian" type="text" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Last Name</label>
                          <input id="lastName" required value={lastName} onChange={e => setLastName(e.target.value)} onKeyDown={e => handleKeyDown(e, 'phone')} className="w-full bg-white/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl py-4 px-5 text-slate-900 font-semibold transition-all outline-none" placeholder="Moore" type="text" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone Number</label>
                        <input id="phone" required value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => handleKeyDown(e, 'email')} className="w-full bg-white/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl py-4 px-5 text-slate-900 font-semibold transition-all outline-none" placeholder="+91 98765 43210" type="tel" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Clinical Email</label>
                      {emailError && <span className="text-[10px] font-bold text-red-500">{emailError}</span>}
                    </div>
                    <div className="relative">
                      <input 
                        id="email"
                        required 
                        value={email} 
                        onChange={handleEmailChange} 
                        onKeyDown={e => handleKeyDown(e, 'password')}
                        className={`w-full bg-white/50 border ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : email && !emailError ? 'border-green-400 focus:border-green-500 focus:ring-green-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 rounded-2xl py-4 px-5 pr-12 text-slate-900 font-semibold transition-all outline-none`} 
                        placeholder="name@mediai.com" 
                        type="email" 
                      />
                      {email && !emailError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500 text-[20px] pointer-events-none">check_circle</span>
                      )}
                      {emailError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-red-500 text-[20px] pointer-events-none">error</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Password</label>
                      {passwordError && <span className="text-[10px] font-bold text-red-500">{passwordError}</span>}
                    </div>
                    <div className="relative">
                      <input 
                        id="password"
                        required 
                        value={password} 
                        onChange={handlePasswordChange} 
                        className={`w-full bg-white/50 border ${passwordError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : password && !passwordError ? 'border-green-400 focus:border-green-500 focus:ring-green-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 rounded-2xl py-4 px-5 pr-12 text-slate-900 font-semibold transition-all outline-none`} 
                        placeholder="••••••••" 
                        type="password" 
                      />
                      {password && !passwordError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500 text-[20px] pointer-events-none">check_circle</span>
                      )}
                      {passwordError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-red-500 text-[20px] pointer-events-none">error</span>
                      )}
                    </div>
                    {isLoginMode && (
                      <div className="flex justify-end mt-2">
                        <button type="button" onClick={() => setIsResetMode(true)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-widest">
                          Forgot Password?
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    disabled={loading || !isFormValid} 
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold text-[13px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none mt-6" 
                    type="submit"
                  >
                    <span>{loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Create Account')}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Email or Phone Number</label>
                      {emailError && <span className="text-[10px] font-bold text-red-500">{emailError}</span>}
                    </div>
                    <div className="relative">
                      <input 
                        id="targetEmail"
                        required 
                        disabled={otpSent} 
                        value={otpEmail} 
                        onChange={handleOtpEmailChange} 
                        onKeyDown={e => !otpSent ? handleKeyDown(e, 'submitOtp') : handleKeyDown(e, 'otpCode')}
                        className={`w-full bg-white/50 border ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : otpEmail && !emailError ? 'border-green-400 focus:border-green-500 focus:ring-green-500/10' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'} focus:ring-4 rounded-2xl py-4 px-5 pr-12 text-slate-900 font-semibold transition-all outline-none`} 
                        type="text" 
                        placeholder="name@mediai.com or +919876543210" 
                      />
                      {otpEmail && !emailError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500 text-[20px] pointer-events-none">check_circle</span>
                      )}
                      {emailError && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-red-500 text-[20px] pointer-events-none">error</span>
                      )}
                    </div>
                  </div>
                  {otpSent && (
                    <div className="space-y-5 pt-3">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">6-Digit Access Code</label>
                        <div className="flex justify-between gap-2">
                          {[0, 1, 2, 3, 4, 5].map(idx => (
                            <input 
                              key={idx}
                              id={`otp-${idx}`}
                              type="text" 
                              maxLength={1}
                              value={otpCode[idx] || ''}
                              onChange={e => handleOtpBoxChange(idx, e.target.value)}
                              onKeyDown={e => handleOtpBoxKeyDown(idx, e)}
                              className="w-[15%] aspect-square bg-white/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl text-slate-900 font-black text-center text-2xl transition-all outline-none"
                            />
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => setOtpSent(false)} className="w-full text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-700 transition-colors">Wrong email? Change it</button>
                    </div>
                  )}

                  <button 
                    id="submitOtp"
                    disabled={loading || (!otpSent && !isFormValid) || (otpSent && otpCode.length !== 6)} 
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold text-[13px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none mt-6" 
                    type="submit"
                  >
                    <span className="material-symbols-outlined text-[18px]">{otpSent ? 'vpn_key' : 'send'}</span>
                    <span>{loading ? 'Processing...' : (otpSent ? 'Verify Code' : 'Request OTP')}</span>
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-[1px] flex-1 bg-slate-200"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or</span>
              <div className="h-[1px] flex-1 bg-slate-200"></div>
            </div>

            <button 
              onClick={handleGoogleLogin} 
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white border border-slate-200/80 text-slate-700 font-bold text-[13px] transition-all hover:bg-slate-50 hover:shadow-md hover:border-slate-300 active:scale-[0.98] shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.25h2.91c1.7-1.56 2.68-3.87 2.68-6.61z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.25c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33C2.43 15.89 5.49 18 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.73c-.18-.54-.28-1.12-.28-1.73s.1-1.19.28-1.73V4.94H.95C.35 6.13 0 7.52 0 9s.35 2.87.95 4.06l3.02-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.49 0 2.43 2.11.95 5.14l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setIsOtpMode(!isOtpMode)}
                className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                {isOtpMode ? 'Return to Password Login' : 'Sign in with One-Time Password'}
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-10 flex justify-center items-center gap-8 opacity-60">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>End-to-End SSL</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>GDPR Compliant</span>
          </div>
        </footer>

      </motion.main>
    </div>
  );
}
