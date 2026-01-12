import React from 'react';

const ProcessingStatus: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
      <div className="relative w-24 h-24">
        {/* Scanner effect animation */}
        <div className="absolute inset-0 bg-brand-500/10 dark:bg-brand-500/20 rounded-lg animate-pulse"></div>
        {/* Updated shadow color to match #ff0058 (255, 0, 88) */}
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-500 shadow-[0_0_15px_rgba(255,0,88,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
        
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-full h-full text-slate-300 dark:text-slate-600">
           <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      
      <div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Clonación Visual en Progreso</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Analizando tipografía, diseño y estructura del contenido...
        </p>
      </div>

      <div className="flex gap-2 text-xs font-mono text-brand-600 dark:text-brand-400">
        <span className="animate-[bounce_1s_infinite_0ms]">OCR</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="animate-[bounce_1s_infinite_200ms]">DISEÑO</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="animate-[bounce_1s_infinite_400ms]">RENDER</span>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ProcessingStatus;