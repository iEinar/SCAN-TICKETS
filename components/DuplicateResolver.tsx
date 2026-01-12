import React from 'react';

interface DuplicateResolverProps {
  isOpen: boolean;
  duplicateImage: string | null;
  count: number; // How many duplicates are in queue
  onConfirm: () => void; // Clone anyway
  onCancel: () => void; // Skip this one
  onCancelAll: () => void; // Skip all remaining
}

const DuplicateResolver: React.FC<DuplicateResolverProps> = ({ 
  isOpen, 
  duplicateImage, 
  count,
  onConfirm, 
  onCancel, 
  onCancelAll 
}) => {
  if (!isOpen || !duplicateImage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-up relative">
        
        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-amber-100 dark:border-amber-900/50 flex items-center gap-3 relative z-10">
          <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-full text-amber-600 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ticket Duplicado Detectado</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
               {count > 1 ? `Quedan ${count} duplicados por resolver` : 'Esta imagen ya existe en tu lista'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center relative z-10">
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-6 leading-relaxed">
            Se ha detectado que este ticket es idéntico a uno procesado o en cola. <br/>
            ¿Deseas <strong>clonarlo nuevamente</strong> o descartarlo?
          </p>

          <div className="relative w-48 h-64 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner mb-6 group select-none">
            <img 
              src={duplicateImage} 
              alt="Duplicate Preview" 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-md">Vista Previa</span>
            </div>
          </div>

          {/* Actions - Ensure high z-index and relative positioning */}
          <div className="flex flex-col gap-3 w-full relative z-20">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirm();
              }}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" />
              </svg>
              Clonar de todos modos
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }}
                className="py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors cursor-pointer"
              >
                Ignorar este
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancelAll();
                }}
                className="py-3 bg-white dark:bg-transparent border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-red-600 hover:border-red-200 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium rounded-xl cursor-pointer"
              >
                Cancelar todo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateResolver;