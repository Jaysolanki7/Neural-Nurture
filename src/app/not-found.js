"use client";

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* 3D Animated Object */}
      <div className="relative w-48 h-48 md:w-64 md:h-64 mb-16" style={{ perspective: '1000px' }}>
        <div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d', animation: 'spin3d 12s linear infinite' }}>
          {/* We can build a simple 3D cube using CSS */}
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl flex items-center justify-center" style={{ transform: 'translateZ(96px)' }}>
             <span className="text-blue-500/30 font-black text-6xl">4</span>
          </div>
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl flex items-center justify-center" style={{ transform: 'rotateY(180deg) translateZ(96px)' }}>
             <span className="text-blue-500/30 font-black text-6xl">4</span>
          </div>
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl flex items-center justify-center" style={{ transform: 'rotateY(90deg) translateZ(96px)' }}>
             <span className="text-blue-500/30 font-black text-6xl">0</span>
          </div>
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl flex items-center justify-center" style={{ transform: 'rotateY(-90deg) translateZ(96px)' }}>
             <span className="text-blue-500/30 font-black text-6xl">0</span>
          </div>
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl" style={{ transform: 'rotateX(90deg) translateZ(96px)' }}></div>
          <div className="absolute inset-0 border border-blue-500/50 bg-blue-500/5 backdrop-blur-[2px] rounded-xl" style={{ transform: 'rotateX(-90deg) translateZ(96px)' }}></div>
          
          {/* Inner Core */}
          <div className="absolute inset-0 m-auto w-1/3 h-1/3 bg-blue-500 shadow-[0_0_60px_#3b82f6] rounded-full animate-pulse" style={{ transform: 'translateZ(0)' }}></div>
        </div>

        {/* Global Keyframes for the 3D spin */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin3d {
            0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
            100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
          }
        `}} />
      </div>

      {/* Text Content */}
      <div className="relative z-10 text-center space-y-6 px-4">
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">404</h1>
        <h2 className="text-lg md:text-2xl font-bold text-slate-300 uppercase tracking-[0.3em]">Signal Lost in the Void</h2>
        <p className="text-slate-400 max-w-md mx-auto text-xs md:text-sm font-medium leading-relaxed">
          The neural pathway you are trying to access does not exist or has been relocated to another sector.
        </p>
        
        <div className="pt-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full uppercase text-xs tracking-[0.2em] transition-all shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.6)] hover:-translate-y-1 active:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Go Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
