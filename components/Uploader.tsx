import React, { useCallback, useState } from 'react';

interface UploaderProps {
  onImagesSelected: (base64List: string[]) => void;
}

const Uploader: React.FC<UploaderProps> = ({ onImagesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const validFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    const promises = validFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) resolve(e.target.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(base64Images => {
      if (base64Images.length > 0) {
        onImagesSelected(base64Images);
      }
    });
  }, [onImagesSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div 
      className={`relative w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center p-6 cursor-pointer
        ${isDragging 
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 scale-[1.02]' 
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input 
        type="file" 
        accept="image/*" 
        multiple 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => processFiles(e.target.files)}
      />
      
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-slate-300">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>

      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200">Subir Imágenes de Tickets</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center max-w-xs">
        Arrastra uno o varios tickets. Los organizaremos automáticamente por sucursal y fecha.
      </p>
    </div>
  );
};

export default Uploader;