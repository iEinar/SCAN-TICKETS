
import React from 'react';
import { ReceiptData, ReceiptItem, TextAlignment } from '../types';

interface ReceiptRendererProps {
  data: ReceiptData;
}

const getFontSizeClass = (size: string) => {
  switch (size) {
    case 'xs': return 'text-[11px] leading-tight'; 
    case 'sm': return 'text-[13px] leading-tight'; 
    case 'base': return 'text-[14px] leading-tight';
    case 'lg': return 'text-[16px] leading-tight';
    case 'xl': return 'text-[18px] leading-tight';
    case '2xl': return 'text-[22px] leading-tight';
    default: return 'text-[13px] leading-tight';
  }
};

const getAlignmentClass = (align: TextAlignment) => {
  switch (align) {
    case 'left': return 'items-start text-left';
    case 'right': return 'items-end text-right';
    case 'center': 
    default: return 'items-center text-center';
  }
};

// --- GLOBAL REGEX PATTERNS ---

// 1. TIME: HH:MM:SS or HH:MM with optional AM/PM
const TIME_REGEX = /\b((?:0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?)\s*(?:[aApP]\.?[mM]\.?)?\b/i;

// 2. DATE: Handles DD/MM/YYYY, YYYY-MM-DD, DD-MM-YY, etc.
// Matches: 04/01/2026, 05-01-2026, 2026-01-03, 09/01/26
const DATE_REGEX = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;

// --- BILLING HIGHLIGHT LOGIC ---

const getHighlightPatterns = (merchantKey: string | undefined): RegExp[] => {
    // These patterns are designed to capture the LABEL + VALUE as a single group
    const patterns: RegExp[] = [];

    // Common patterns (Sucursal, Total explicit label)
    patterns.push(
        /\b(SUCURSAL)\s*[:.]?\s*([A-Z0-9\s.-]+)/i,
        /\b(TOTAL|IMPORTE|MONTO)\s*[:.]?\s*([$]?\s*[\d,]+\.\d{2})/i
    );

    if (!merchantKey) return patterns;

    switch (merchantKey) {
        case 'walmart':
            patterns.push(
                /\b(TR|TRANS|TRANSACCION)\s*[:#.]?\s*(\d+)/i,
                /\b(TC|TICKET)\s*[:#.]?\s*(\d+)/i
            );
            break;
        case 'carlsjr':
            patterns.push(
                // Captures "Ticket#: 840,006,528" or "Orden: 123"
                /\b(ORDEN|ORDER|TICKET|FOLIO)\s*#?[:.]?\s*([0-9,.-]+)/i
            );
            break;
        case 'lecaroz':
            patterns.push(
                // Captures "#REFERENCIA: 60"
                /\b(REF|REFERENCIA)\s*#?[:.]?\s*([A-Z0-9]+)/i,
                /\b(TICKET|FOLIO)\s*[:#.]?\s*(\d+)/i
            );
            break;
        case 'cinemex':
            patterns.push(
                /\b(TICKET|FOLIO|TRANSACCION)\s*[:#.]?\s*(\d+)/i,
                // Captures "Complejo: POC"
                /\b(COMPLEJO)\s*[:#.]?\s*([A-Z0-9\s]+)/i
            );
            break;
        case 'tresb':
            patterns.push(
                // Sucursal: "Tienda: 0830" or "Suc: 1234"
                /\b(TIENDA|SUCURSAL|SUC)\s*[:#.]?\s*(\d+)/i,
                // Caja: "Caja: 01"
                /\b(CAJA)\s*[:#.]?\s*(\d+)/i,
                // Ticket: "Ticket: 0123"
                /\b(TICKET|FOLIO)\s*[:#.]?\s*(\d+)/i
            );
            break;
    }
    return patterns;
};

// The core text processor
const processTextContent = (
    text: string, 
    merchantKey: string | undefined, 
    metadata: ReceiptData['metadata']
): React.ReactNode => {
  if (!text) return text;

  // URL Detection
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|mx|co|io|biz|info)[^\s]*)/gi;
  if (text.match(urlRegex)) {
      const parts = text.split(urlRegex);
      return parts.map((part, index) => {
          if (part.match(urlRegex)) {
              let href = part;
              if (!href.startsWith('http')) href = 'https://' + href;
              return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 cursor-pointer">{part}</a>;
          }
          return part;
      });
  }

  // --- HIGHLIGHTING ENGINE ---
  // We prioritize specific patterns, then Dates, then Times.

  const patterns = getHighlightPatterns(merchantKey);
  
  // 1. SPECIFIC FIELDS (Label + Value)
  for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
          // match[0] is the full string "Ticket#: 123"
          // We assume we want to highlight the whole match[0] or specifically constructed parts
          
          // Exception: For Sucursal/Complejo, prevent capturing too much if regex is greedy
          // But our regexes are fairly specific.
          
          const fullMatch = match[0];
          const split = text.split(fullMatch);
          
          // Only split on the first occurrence to avoid destroying structure
          if (split.length >= 2) {
              return (
                  <span>
                      {split[0]}
                      <mark className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-white px-1 rounded-sm font-bold mx-0.5 shadow-sm no-underline">{fullMatch}</mark>
                      {split.slice(1).join(fullMatch)}
                  </span>
              );
          }
      }
  }

  // 2. DATES (Universal)
  const dateMatch = text.match(DATE_REGEX);
  if (dateMatch) {
      const dateStr = dateMatch[0];
      const split = text.split(dateStr);
      return (
          <span>
              {split[0]}
              <mark className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-white px-1 rounded-sm font-bold mx-0.5 shadow-sm no-underline">{dateStr}</mark>
              {split.slice(1).join(dateStr)}
          </span>
      );
  }

  // 3. TIMES (Universal)
  const timeMatch = text.match(TIME_REGEX);
  if (timeMatch) {
      const timeStr = timeMatch[0];
      const split = text.split(timeStr);
      return (
          <span>
              {split[0]}
              <mark className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-white px-1 rounded-sm font-bold mx-0.5 shadow-sm no-underline">{timeStr}</mark>
              {split.slice(1).join(timeStr)}
          </span>
      );
  }

  // 4. METADATA TOTAL FALLBACK
  // If no "TOTAL:" label regex matched, but this line contains the raw total amount number
  if (metadata.totalAmount) {
      const cleanTotal = metadata.totalAmount.replace(/[^0-9.]/g, '');
      // Ensure we have a valid number and it's in the text
      if (cleanTotal.length > 1 && text.includes(cleanTotal)) {
          // Only highlight if it looks like a price (has $ or is standalone)
          if (text.includes('$') || text.trim() === cleanTotal || text.trim() === metadata.totalAmount) {
             const parts = text.split(metadata.totalAmount);
             if (parts.length > 1) {
                 return (
                    <span>
                        {parts[0]}
                        <mark className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-white px-1 rounded-sm font-bold mx-0.5 shadow-sm no-underline">{metadata.totalAmount}</mark>
                        {parts.slice(1).join(metadata.totalAmount)}
                    </span>
                 );
             }
             // Try strict number match
             const parts2 = text.split(cleanTotal);
             if (parts2.length > 1) {
                 return (
                    <span>
                        {parts2[0]}
                        <mark className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-white px-1 rounded-sm font-bold mx-0.5 shadow-sm no-underline">{cleanTotal}</mark>
                        {parts2.slice(1).join(cleanTotal)}
                    </span>
                 );
             }
          }
      }
  }

  return text;
};


const Separator: React.FC<{ style?: string }> = ({ style }) => {
  const borderClass = style === 'double' 
    ? 'border-b-4 border-double border-black' 
    : style === 'solid' 
      ? 'border-b border-black' 
      : 'border-b border-dashed border-black';

  return <div className={`w-full my-2 ${borderClass}`} />;
};

const Barcode: React.FC<{ value: string, align: TextAlignment }> = ({ value, align }) => {
  const alignClass = getAlignmentClass(align);
  return (
    <div className={`flex flex-col ${alignClass} py-2 space-y-1 opacity-100 w-full`}>
      <div 
        className="h-16 w-full max-w-[280px]"
        style={{
          backgroundImage: `linear-gradient(90deg, 
            #000000 2px, transparent 2px, 
            transparent 5px, #000000 5px, 
            #000000 8px, transparent 8px,
            transparent 10px, #000000 10px,
            #000000 14px, transparent 14px,
            transparent 17px, #000000 17px,
            #000000 22px, transparent 22px,
            transparent 24px, #000000 24px,
            #000000 26px, transparent 26px)`,
          backgroundSize: '28px 100%'
        }}
      />
      <span className="text-[11px] font-mono tracking-[0.2em] text-black font-medium">{value}</span>
    </div>
  );
};

const QRCode: React.FC<{ value?: string, align: TextAlignment }> = ({ align }) => {
  const alignClass = getAlignmentClass(align);
  return (
    <div className={`flex flex-col ${alignClass} py-2 w-full`}>
      <div className="bg-white p-1">
        <svg viewBox="0 0 33 33" className="w-32 h-32 shape-rendering-crispEdges" xmlns="http://www.w3.org/2000/svg">
            <rect width="33" height="33" fill="white"/>
            <path d="M4 4h7v7H4zM5 5v5h5V5z" fill="black"/>
            <rect x="6" y="6" width="3" height="3" fill="black"/>
            <path d="M22 4h7v7h-7zM23 5v5h5V5z" fill="black"/>
            <rect x="24" y="6" width="3" height="3" fill="black"/>
            <path d="M4 22h7v7H4zM5 23v5h5V23z" fill="black"/>
            <rect x="6" y="24" width="3" height="3" fill="black"/>
            <g fill="black">
               <rect x="14" y="4" width="1" height="1"/> <rect x="16" y="4" width="1" height="1"/> <rect x="18" y="4" width="1" height="1"/>
               <rect x="13" y="6" width="1" height="1"/> <rect x="15" y="6" width="1" height="1"/> <rect x="19" y="6" width="1" height="1"/>
               <rect x="14" y="8" width="1" height="1"/> <rect x="17" y="8" width="1" height="1"/> <rect x="12" y="5" width="1" height="1"/>
               <rect x="4" y="14" width="1" height="1"/> <rect x="6" y="14" width="1" height="1"/> <rect x="8" y="14" width="1" height="1"/>
               <rect x="5" y="16" width="1" height="1"/> <rect x="7" y="16" width="1" height="1"/> <rect x="9" y="16" width="1" height="1"/>
               <rect x="22" y="14" width="1" height="1"/> <rect x="24" y="14" width="1" height="1"/> <rect x="26" y="14" width="1" height="1"/>
               <rect x="23" y="16" width="1" height="1"/> <rect x="25" y="16" width="1" height="1"/> <rect x="28" y="16" width="1" height="1"/>
               <rect x="12" y="12" width="9" height="9" fillOpacity="0.1"/>
               <path d="M12 12h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm-6 2h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1z" />
               <path d="M13 15h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm-4 2h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm-4 2h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1z" />
               <rect x="14" y="24" width="1" height="1"/> <rect x="18" y="24" width="1" height="1"/> <rect x="24" y="24" width="1" height="1"/>
               <rect x="15" y="26" width="1" height="1"/> <rect x="19" y="26" width="1" height="1"/> <rect x="22" y="26" width="1" height="1"/>
               <rect x="16" y="28" width="1" height="1"/> <rect x="20" y="28" width="1" height="1"/> <rect x="25" y="28" width="1" height="1"/>
            </g>
        </svg>
      </div>
    </div>
  );
};

const LogoPlaceholder: React.FC<{ text: string, align: TextAlignment }> = ({ text, align }) => {
  const alignClass = getAlignmentClass(align);
  return (
    <div className={`flex flex-col ${alignClass} py-4 mb-2 w-full`}>
      <div className="w-16 h-16 border-4 border-black rounded-full flex items-center justify-center mb-2">
        <span className="text-2xl font-bold font-mono text-black">{text.charAt(0)}</span>
      </div>
      <span className="text-lg font-bold uppercase tracking-widest text-black">{text}</span>
    </div>
  );
};

const ReceiptItemRenderer: React.FC<{ 
    item: ReceiptItem, 
    merchantKey?: string, 
    metadata: ReceiptData['metadata'] 
}> = ({ item, merchantKey, metadata }) => {
  
  const commonClasses = `
    ${item.isBold ? 'font-bold' : 'font-normal'} 
    font-mono tracking-tight
    ${getFontSizeClass(item.fontSize)}
    thermal-text
    select-text
    text-black
    transition-colors
    selection:bg-brand-200 selection:text-brand-900
  `;

  const topSpacing = item.marginTop ? item.marginTop : 0; 
  const bottomSpacing = 0; 
  const marginStyle = { marginTop: `${topSpacing}px`, marginBottom: `${bottomSpacing}px` };

  if (item.type === 'separator') {
    return <Separator style={item.separatorStyle} />;
  }

  if (item.type === 'barcode') {
    return <Barcode value={item.text} align={item.align} />;
  }

  if (item.type === 'qr') {
    return <QRCode value={item.text} align={item.align} />;
  }

  if (item.type === 'logo') {
    return <LogoPlaceholder text={item.text} align={item.align} />;
  }

  if (item.layout === 'split') {
    return (
      <div className={`flex justify-between items-end w-full ${commonClasses}`} style={marginStyle}>
        <span className="text-left flex-1 min-w-0 mr-2 break-words leading-tight">
           {processTextContent(item.text, merchantKey, metadata)}
        </span>
        <span className="text-right whitespace-nowrap leading-tight flex-shrink-0">
           {item.secondaryText ? processTextContent(item.secondaryText, merchantKey, metadata) : ''}
        </span>
      </div>
    );
  }

  // Default single line layout
  return (
    <div 
      className={`w-full break-words ${commonClasses}`} 
      style={{ textAlign: item.align, ...marginStyle }}
    >
      {processTextContent(item.text, merchantKey, metadata)}
    </div>
  );
};

const ReceiptRenderer: React.FC<ReceiptRendererProps> = ({ data }) => {
  return (
    <div className="relative group perspective-1000 py-6">
      {/* The Receipt Container */}
      <div 
        id="digital-receipt-export"
        className="receipt-paper relative w-full max-w-[360px] mx-auto shadow-receipt transform transition-transform duration-500 hover:scale-[1.01]"
        style={{ minHeight: '400px' }}
      >
        {/* Top Jagged Edge */}
        <div className="jagged-edge-top" />

        <div className="px-6 py-10 flex flex-col items-start">
          {data.items.map((item, index) => (
            <ReceiptItemRenderer 
                key={item.id || index} 
                item={item} 
                merchantKey={data.billing?.merchantKey}
                metadata={data.metadata}
            />
          ))}
        </div>

        {/* Footer spacing */}
        <div className="h-12 w-full"></div>

        {/* Bottom Jagged Edge */}
        <div className="jagged-edge-bottom" />
      </div>
    </div>
  );
};

export default ReceiptRenderer;
