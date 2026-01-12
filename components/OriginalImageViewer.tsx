import React, { useState, useRef, MouseEvent, TouchEvent, useEffect } from 'react';

interface OriginalImageViewerProps {
  imageUrl: string;
}

const OriginalImageViewer: React.FC<OriginalImageViewerProps> = ({ imageUrl }) => {
  const [zoomState, setZoomState] = useState({
    show: false,
    x: 0,
    y: 0,
    scale: 2.5 // Default zoom level
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  // --- MOUSE MOVEMENT (PANNING) ---
  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    
    // Calculate percentage position
    let x = ((clientX - left) / width) * 100;
    let y = ((clientY - top) / height) * 100;

    // Clamp values between 0 and 100
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    setZoomState(prev => ({ ...prev, show: true, x, y }));
  };

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    handleMove(e.clientX, e.clientY);
  };

  // --- MOUSE WHEEL (ZOOM LEVEL) ---
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Prevent page scroll only when zooming
    e.stopPropagation(); 
    // e.preventDefault() is handled by the passive: false effect below if needed, 
    // but React synthetic events don't support preventDefault on wheel easily for scrolling.
    // However, since we are inside a small container, standard scroll usually works fine.
    
    const delta = -e.deltaY * 0.005; // Sensitivity
    setZoomState(prev => {
      const newScale = Math.min(Math.max(1, prev.scale + delta), 8); // Clamp between 1x and 8x
      return { ...prev, scale: newScale, show: true };
    });
  };

  // --- TOUCH HANDLERS (PAN & PINCH) ---
  const getTouchDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      lastTouchDistance.current = getTouchDistance(e.touches);
    } else if (e.touches.length === 1) {
       setZoomState(prev => ({ ...prev, show: true }));
    }
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    // Handle Pinch (Zoom)
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      if (lastTouchDistance.current !== null) {
        const delta = dist - lastTouchDistance.current;
        const zoomFactor = delta * 0.01; // Sensitivity
        
        setZoomState(prev => {
            const newScale = Math.min(Math.max(1, prev.scale + zoomFactor), 8);
            return { ...prev, scale: newScale };
        });
      }
      lastTouchDistance.current = dist;
    } 
    // Handle Pan (Move)
    else if (e.touches.length === 1) {
      // Prevent page scrolling while panning
      // Note: In some browsers, preventDefault inside passive listeners (default for touch) is ignored.
      // We rely on 'touch-action: none' in CSS.
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    lastTouchDistance.current = null;
    // We don't hide immediately on touch end to avoid flickering if user lifts one finger
    // but we can set a timeout or just leave it until they click outside or specific action.
    // For now, let's behave like mouse leave logic only if all fingers are up.
  };

  const onLeave = () => {
     setZoomState((prev) => ({ ...prev, show: false }));
  };

  // Add event listener to prevent default wheel scroll behavior on the element itself
  useEffect(() => {
      const element = containerRef.current;
      if (!element) return;
      
      const preventDefault = (e: Event) => e.preventDefault();
      
      // We only want to prevent scroll if we are zooming, but doing it always on this container is safer UX
      element.addEventListener('wheel', preventDefault, { passive: false });
      
      return () => {
          element.removeEventListener('wheel', preventDefault);
      };
  }, []);

  return (
    <div className="flex flex-col w-full h-full items-center justify-start">
      {/* Helper text */}
      <div className="mb-4 text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-medium text-slate-500 dark:text-slate-300">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
             <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
           </svg>
           Scroll / Pinza para Zoom • Arrastra para Mover
        </span>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-slate-900 group cursor-crosshair touch-none select-none"
        onMouseEnter={() => setZoomState(prev => ({...prev, show: true}))}
        onMouseMove={onMouseMove}
        onMouseLeave={onLeave}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }} // Critical for preventing page scroll on mobile
      >
        {/* The Base Image */}
        <img 
          src={imageUrl} 
          alt="Original Receipt" 
          className={`w-full h-auto object-contain max-h-[600px] transition-opacity duration-200 ${zoomState.show ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* The Zoomed Version (Overlay) */}
        {zoomState.show && (
          <>
            <div 
                className="absolute inset-0 bg-no-repeat pointer-events-none"
                style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundPosition: `${zoomState.x}% ${zoomState.y}%`,
                backgroundSize: `${zoomState.scale * 100}%`,
                }}
            />
            {/* Zoom Level Badge */}
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-mono text-white pointer-events-none">
                {zoomState.scale.toFixed(1)}x
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OriginalImageViewer;