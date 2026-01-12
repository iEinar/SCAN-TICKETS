import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        <linearGradient id="scanGradient" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#ff0058" />
          <stop offset="100%" stopColor="#ff4d7f" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Background shape (Ticket) */}
      <path 
        d="M25 15C25 11.6863 27.6863 9 31 9H69C72.3137 9 75 11.6863 75 15V85L70.8333 82L66.6667 85L62.5 82L58.3333 85L54.1667 82L50 85L45.8333 82L41.6667 85L37.5 82L33.3333 85L29.1667 82L25 85V15Z" 
        fill="currentColor" 
        className="text-slate-200 dark:text-slate-700"
      />
      
      {/* Ticket Lines (Abstract content) */}
      <rect x="33" y="25" width="34" height="4" rx="2" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <rect x="33" y="35" width="20" height="4" rx="2" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <rect x="63" y="35" width="4" height="4" rx="1" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      
      <rect x="33" y="45" width="24" height="4" rx="2" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
      <rect x="63" y="45" width="4" height="4" rx="1" fill="currentColor" className="text-slate-300 dark:text-slate-600" />

      {/* The Scanner Beam (Brand Color) */}
      <path 
        d="M15 55H85" 
        stroke="url(#scanGradient)" 
        strokeWidth="4" 
        strokeLinecap="round"
        filter="url(#glow)"
        className="animate-pulse"
      />
      
      {/* Laser highlight shape on the ticket */}
      <path 
        d="M25 55H75" 
        stroke="white" 
        strokeWidth="1" 
        strokeOpacity="0.5"
      />

      {/* Lower half (scanned/digital conversion) opacity change */}
      <path 
        d="M25 57H75V85L70.8333 82L66.6667 85L62.5 82L58.3333 85L54.1667 82L50 85L45.8333 82L41.6667 85L37.5 82L33.3333 85L29.1667 82L25 85V57Z" 
        fill="url(#scanGradient)" 
        fillOpacity="0.1" 
      />
    </svg>
  );
};

export default Logo;