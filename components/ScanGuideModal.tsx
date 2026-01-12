import React from 'react';

interface ScanGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

const ScanGuideModal: React.FC<ScanGuideModalProps> = ({ isOpen, onClose, onRetry }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-scale-up border border-white/10">
        
        {/* Top Decorative Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-orange-400 to-red-500"></div>

        <div className="p-8 text-center">
          {/* Main Icon Warning */}
          <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-orange-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="absolute inset-0 border-4 border-orange-100 dark:border-orange-900/10 rounded-full animate-ping opacity-75"></div>
          </div>

          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">No pudimos leer tu ticket</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            La imagen parece estar borrosa, oscura o muy lejos. Para un clon perfecto, sigue estos consejos:
          </p>

          {/* Animated Tips Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            
            {/* Tip 1: Light */}
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700">
              <div className="relative w-10 h-10 flex items-center justify-center text-yellow-500">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 relative z-10">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                 </svg>
                 <div className="absolute inset-0 bg-yellow-400/20 blur-lg rounded-full animate-pulse"></div>
              </div>
              <div className="text-center">
                <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">Iluminación</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Evita sombras oscuras</span>
              </div>
            </div>

            {/* Tip 2: Focus */}
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700">
              <div className="relative w-10 h-10 flex items-center justify-center text-blue-500">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                 </svg>
                 {/* Focus Animation */}
                 <div className="absolute w-full h-full border-2 border-blue-400 rounded-lg animate-[ping_2s_ease-in-out_infinite] opacity-20"></div>
              </div>
              <div className="text-center">
                <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">Enfoque</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Toca la pantalla para enfocar</span>
              </div>
            </div>

            {/* Tip 3: Distance */}
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700">
              <div className="relative w-10 h-10 flex items-center justify-center text-emerald-500">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 transition-transform animate-[bounce_2s_infinite]">
                   <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                 </svg>
              </div>
              <div className="text-center">
                <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">Acércate</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Solo el ticket, sin fondo</span>
              </div>
            </div>

          </div>

          <button 
            onClick={onRetry}
            className="w-full py-4 bg-slate-900 hover:bg-black dark:bg-brand-600 dark:hover:bg-brand-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Entendido, intentar de nuevo
          </button>
          
          <button 
            onClick={onClose}
            className="mt-4 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
          >
            Cancelar
          </button>

        </div>
      </div>
    </div>
  );
};

export default ScanGuideModal;