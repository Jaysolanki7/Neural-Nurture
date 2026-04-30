"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { secureStorage } from '../../lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [triage, setTriage] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState('patient');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (Max 10MB)");
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, triage, loading]);

  useEffect(() => {
    const userRole = secureStorage.getItem('user_role') || 'patient';
    setRole(userRole);
    fetchSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    } else {
      setMessages([{ 
        role: 'assistant', 
        text: role === 'doctor' 
          ? `Neural Clinical Assistant Online. Submit patient symptoms or laboratory parameters for rapid diagnostic synthesis and management protocols.`
          : `Hello, I am MediAI. Please describe your symptoms or clinical requirements for analysis.` 
      }]);
      setTriage(null);
    }
  }, [currentSessionId, role]);

  const fetchSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = role === 'admin' || secureStorage.getItem('user_role') === 'admin';
    if (!user && !isAdmin) return;
    
    const userId = user ? user.id : '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) setSessions(data);
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await supabase.from('chat_messages').delete().eq('session_id', sessionId);
      await supabase.from('chat_sessions').delete().eq('id', sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([{ 
          role: 'assistant', 
          text: role === 'doctor' 
            ? `Neural Clinical Assistant Online. Submit patient symptoms or laboratory parameters for rapid diagnostic synthesis and management protocols.`
            : `Hello, I am MediAI. Please describe your symptoms or clinical requirements for analysis.` 
        }]);
        setTriage(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const fetchMessages = async (sessionId) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      let lastTriage = null;
      const parsedMessages = data.map(m => {
        let text = m.content;
        let fileName = null;
        if (m.role === 'user' && text && text.includes('||FILE||')) {
          const parts = text.split('||FILE||');
          text = parts[0];
          fileName = parts[1];
        } else if (text && text.includes('||TRIAGE_DATA||')) {
          const parts = text.split('||TRIAGE_DATA||');
          text = parts[0];
          try {
            lastTriage = JSON.parse(parts[1]);
          } catch(e) {}
        }
        return { role: m.role, text, fileName };
      });
      setMessages(parsedMessages);
      setTriage(lastTriage);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    const userMsg = input || (selectedFile ? `Analyze attached report: ${selectedFile.name}` : "");
    const currentFile = selectedFile;
    const previewUrl = currentFile && currentFile.type.startsWith('image/') ? URL.createObjectURL(currentFile) : null;
    
    setInput('');
    setSelectedFile(null);
    setFilePreview(null);
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: userMsg,
      fileName: currentFile?.name,
      filePreviewUrl: previewUrl
    }]);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin = role === 'admin' || secureStorage.getItem('user_role') === 'admin';
      
      if (!user && !isAdmin) return;
      const userId = user ? user.id : '00000000-0000-0000-0000-000000000000';

      let fileData = null;
      if (currentFile) {
        const base64 = await fileToBase64(currentFile);
        fileData = {
          base64,
          mimeType: currentFile.type,
          fileName: currentFile.name
        };
      }

      const apiEndpoint = role === 'doctor' ? '/api/doctor/chat' : role === 'admin' ? '/api/admin/chat' : '/api/chat';

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input.trim() ? input : null, 
          fileData 
        })
      });
      const data = await res.json();
      
      let sessionId = currentSessionId;
      if (!sessionId) {
        const { data: session } = await supabase
          .from('chat_sessions')
          .insert({ user_id: userId, title: data.predictedTitle || userMsg.substring(0, 30) })
          .select().single();
        if (session) {
          sessionId = session.id;
          setCurrentSessionId(sessionId);
          fetchSessions();
        }
      }

      if (sessionId) {
        let saveMsg = userMsg;
        if (currentFile) {
          saveMsg = `${userMsg}||FILE||${currentFile.name}`;
        }
        await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: saveMsg });
        if (data.reply) {
          setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
          let contentToSave = data.reply + (data.triage ? `||TRIAGE_DATA||${JSON.stringify(data.triage)}` : '');
          await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'assistant', content: contentToSave });
        }
      }
      if (data.triage) setTriage(data.triage);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Neural link timeout or file too complex." }]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="pt-20 h-screen flex overflow-hidden bg-background text-on-background font-sans">
      {/* Sidebar - Remains consistent */}
      <aside className={`${isSidebarOpen ? 'w-full md:w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'} fixed md:relative transition-all duration-300 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden h-full z-50 md:z-20`}>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Analysis History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"><span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span></button>
          </div>
          <button onClick={() => { setCurrentSessionId(null); setMessages([]); setIsSidebarOpen(false); }} className="w-full py-4 px-6 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all font-black shadow-lg shadow-blue-600/20">
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="text-[10px] uppercase tracking-[0.2em]">New Chat</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {sessions.map(session => (
            <div key={session.id} className="relative group flex items-center">
              <button onClick={() => { setCurrentSessionId(session.id); setIsSidebarOpen(false); }} className={`flex-1 text-left p-4 pr-12 rounded-xl flex items-center gap-3 transition-all ${currentSessionId === session.id ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20' : 'hover:bg-slate-200/50 text-slate-600'}`}>
                <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
                <span className="text-xs font-bold truncate">{session.title}</span>
              </button>
              <button onClick={(e) => deleteSession(session.id, e)} className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col bg-white relative overflow-hidden h-full">
        <div className="px-6 md:px-8 py-6 bg-white/80 backdrop-blur-xl flex items-center justify-between z-10 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`${isSidebarOpen ? 'md:hidden' : 'flex'} w-10 h-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all`}>
              <span className="material-symbols-outlined">{isSidebarOpen ? 'close' : 'keyboard_double_arrow_right'}</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest">{role === 'doctor' ? 'Clinical Intelligence Hub' : 'MediAI Triage Assistant'}</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neural Link Secure</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-12 pb-64 scroll-smooth custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col gap-4 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'items-end ml-auto' : ''}`}>
              <div className="flex items-center gap-3 px-1">
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[#1e293b] text-white flex items-center justify-center shadow-lg shadow-slate-200">
                    <span className="material-symbols-outlined text-[16px]">medical_services</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    {msg.role === 'user' ? (role === 'doctor' ? 'Clinical Input' : 'Patient Inquiry') : 'MediAI Triage Assistant'}
                  </span>
                  {msg.role !== 'user' && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clinical AI Online</span>
                    </div>
                  )}
                </div>
              </div>
              <div className={`p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)] border transition-all ${msg.role === 'user' ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'}`}>
                {msg.filePreviewUrl && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-white/10">
                    <img src={msg.filePreviewUrl} alt="Upload" className="max-w-full h-auto max-h-64 object-contain rounded-2xl" />
                  </div>
                )}
                {msg.fileName && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-white/10 rounded-2xl border border-white/5">
                    <span className="material-symbols-outlined text-blue-400">description</span>
                    <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[200px]">{msg.fileName}</span>
                    <span className="text-[8px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-black">PDF/IMAGE</span>
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <p className="text-[15px] font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{msg.text}</p>
                ) : msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-6 bg-slate-50 rounded-3xl w-24">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
            </div>
          )}

          {triage && triage.urgency !== 'none' && (
            <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-xl max-w-2xl space-y-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600">assignment_turned_in</span>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Assessment Summary</h3>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  triage.urgency?.toLowerCase().includes('red') || triage.urgency?.toLowerCase().includes('critical') 
                    ? 'bg-red-100 text-red-600' 
                    : triage.urgency?.toLowerCase().includes('yellow') 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {triage.urgency} Priority
                </div>
              </div>

              {/* Condition & Specialist */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-extrabold text-slate-900">
                    Probable Condition: <span className="text-blue-600">{triage.likely_cause}</span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Specialist:</span>
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest bg-slate-200/50 px-3 py-1 rounded-md">{triage.specialist_needed}</span>
                </div>
              </div>

              {/* Care Steps */}
              <div className="bg-white/50 rounded-3xl p-6 border border-slate-100">
                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">volunteer_activism</span>
                  Patient Care Steps
                </h5>
                <ul className="space-y-3">
                  {triage.home_care?.map((step, sIdx) => (
                    <li key={sIdx} className="flex gap-3 text-sm font-medium text-slate-700 leading-relaxed">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Link href={`/doctors?specialty=${encodeURIComponent(triage.specialist_needed)}`} className="block">
                  <button className="w-full py-5 bg-[#1e293b] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                    Find a Specialist
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </Link>
              </div>
            </div>
          )}
          {/* Scroll Anchor */}
          <div ref={messagesEndRef} className="h-4" />
        </div>
        
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-10 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto space-y-4 pointer-events-auto">
            <AnimatePresence>
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-4 bg-slate-900 text-white p-4 rounded-3xl border border-slate-800 shadow-2xl ml-4 mr-20"
                >
                  {filePreview ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                      <img src={filePreview} className="w-full h-full object-cover" alt="Preview" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-sm">attach_file</span>
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest truncate">{selectedFile.name}</p>
                    <p className="text-[8px] text-slate-500 font-bold">READY FOR CLINICAL ANALYSIS</p>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSend} className="flex items-center gap-4 bg-slate-50 p-2 pl-4 md:pl-8 rounded-full border border-slate-200 shadow-2xl focus-within:border-blue-600/50 transition-all">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,image/*" />
              <button 
                type="button"
                onClick={() => fileInputRef.current.click()}
                className={`h-12 w-12 md:h-14 md:w-14 flex items-center justify-center rounded-full transition-all ${selectedFile ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
              >
                <span className="material-symbols-outlined">attachment</span>
              </button>
              <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-transparent border-none focus:outline-none text-slate-900 font-medium text-sm py-4" placeholder={role === 'doctor' ? "Attach report or enter clinical parameters..." : "Describe symptoms or upload a report..."} />
              <button type="submit" disabled={loading || (!input.trim() && !selectedFile)} className="h-12 w-12 md:h-14 md:w-14 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-lg hover:scale-105 transition-all disabled:opacity-30">
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
