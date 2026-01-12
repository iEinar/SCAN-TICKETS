
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Uploader from './components/Uploader';
import ReceiptRenderer from './components/ReceiptRenderer';
import OriginalImageViewer from './components/OriginalImageViewer';
import ProcessingStatus from './components/ProcessingStatus';
import Logo from './components/Logo';
import DuplicateResolver from './components/DuplicateResolver';
import TextSelectionMenu from './components/TextSelectionMenu';
import BillingModal from './components/BillingModal';
import ScanGuideModal from './components/ScanGuideModal';
import { analyzeReceiptImage } from './services/geminiService';
import { getStrategyByKey } from './services/billingStrategies';
import { AnalysisState, ReceiptData } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import saveAs from 'file-saver';

// --- UTILITIES FOR HEURISTIC MATCHING ---

// 1. Normalize Strings (remove special chars, lowercase)
const cleanStr = (str: string | undefined): string => {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
};

// 2. Parse Float robustly
const parseAmount = (amountStr: string | undefined): number | null => {
    if (!amountStr) return null;
    // Remove everything except numbers and dots
    const clean = amountStr.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
};

// 3. Extract just the numbers from CP
const cleanCP = (cp: string | undefined): string => {
    if (!cp) return '';
    return cp.replace(/[^0-9]/g, '');
};

// 4. Levenshtein Distance (String Similarity)
const calculateStringSimilarity = (s1: string, s2: string): number => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    
    return (longer.length - costs[shorter.length]) / longer.length;
};

// --- VISUAL SIMILARITY CHECK (CLIENT SIDE) ---
// Resizes images to small dimensions and compares pixel data. 
// This allows catching duplicates INSTANTLY without waiting for AI.
const getImageSignature = (base64: string): Promise<Uint8ClampedArray> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Small resolution is enough for structural similarity
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject('No context'); return; }
            ctx.drawImage(img, 0, 0, 32, 32);
            // Get raw pixel data
            resolve(ctx.getImageData(0, 0, 32, 32).data);
        };
        img.onerror = reject;
        img.src = base64;
    });
};

const areImagesVisuallySimilar = (sig1: Uint8ClampedArray, sig2: Uint8ClampedArray): boolean => {
    if (sig1.length !== sig2.length) return false;
    let diff = 0;
    // Compare pixel by pixel (RGBA)
    for (let i = 0; i < sig1.length; i += 4) {
        // Simple Euclidean distance approximation
        diff += Math.abs(sig1[i] - sig2[i]);     // R
        diff += Math.abs(sig1[i+1] - sig2[i+1]); // G
        diff += Math.abs(sig1[i+2] - sig2[i+2]); // B
    }
    const totalPixels = sig1.length / 4;
    const avgDiff = diff / (totalPixels * 3); // Average difference per color channel
    
    // Threshold: If average pixel difference is < 15 (out of 255), it's likely the same image
    return avgDiff < 15; 
};

// --- CORE DUPLICATE DETECTION LOGIC ---
const isDuplicateReceipt = (newReceipt: ReceiptData, existingReceipt: ReceiptData): boolean => {
    let score = 0;

    // 1. Transaction ID / Ticket Number Match (The "Golden Key")
    const newId = cleanStr(newReceipt.billing?.transactionId || newReceipt.billing?.ticketNumber);
    const oldId = cleanStr(existingReceipt.billing?.transactionId || existingReceipt.billing?.ticketNumber);
    
    // If IDs exist and match exactly (and aren't tiny like "1"), it's a match.
    if (newId.length > 2 && oldId.length > 2 && newId === oldId) {
        return true; 
    }

    // 2. Total Amount Match (Weight: 50)
    // If the money is the same, it's highly suspicious.
    const amount1 = parseAmount(newReceipt.metadata.totalAmount);
    const amount2 = parseAmount(existingReceipt.metadata.totalAmount);
    
    const amountsMatch = amount1 !== null && amount2 !== null && Math.abs(amount1 - amount2) < 0.05;

    if (amountsMatch) {
        score += 50;
    }

    // 3. Date Match (Weight: 30)
    if (newReceipt.metadata.date && existingReceipt.metadata.date && 
        newReceipt.metadata.date === existingReceipt.metadata.date) {
        score += 30;
    }

    // 4. Postal Code (CP) Match (Weight: 25) - INCREASED IMPORTANCE
    // This helps identify same-store locations even if OCR on store name is fuzzy
    const cp1 = cleanCP(newReceipt.metadata.postalCode);
    const cp2 = cleanCP(existingReceipt.metadata.postalCode);

    if (cp1.length >= 4 && cp2.length >= 4 && cp1 === cp2) {
        score += 25;
    }

    // 5. Store Name Similarity (Weight: 15)
    const store1 = cleanStr(newReceipt.metadata.storeName);
    const store2 = cleanStr(existingReceipt.metadata.storeName);
    
    if (calculateStringSimilarity(store1, store2) > 0.7) {
        score += 15;
    } else if (store1.includes(store2) || store2.includes(store1)) {
        score += 10;
    }

    // --- AGGRESSIVE THRESHOLD (60) ---
    // Scenarios causing detection:
    // - Amount (50) + CP (25) = 75 -> DUPLICATE
    // - Amount (50) + Date (30) = 80 -> DUPLICATE
    // - Date (30) + CP (25) + Store (15) = 70 -> DUPLICATE
    
    return score >= 60;
};


const App: React.FC = () => {
  // Store multiple receipts
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  
  // New state for partial success feedback
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  // Duplicate Handling State
  const [duplicateQueue, setDuplicateQueue] = useState<{data: ReceiptData, originalImage: string}[]>([]);
  
  // Store visual signatures of processed images to skip AI for exact visual matches
  const processedSignatures = useRef<Uint8ClampedArray[]>([]);

  // Billing Modal State
  const [billingModalState, setBillingModalState] = useState<{ isOpen: boolean; receipt: ReceiptData | null }>({
    isOpen: false,
    receipt: null
  });

  // Track failed logo loads
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

  // Scan Guide Modal State
  const [scanGuideOpen, setScanGuideOpen] = useState(false);

  // Track processing session
  const processingSessionRef = useRef(0);
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Bulk Download State
  const [bulkDownloadFormat, setBulkDownloadFormat] = useState<'pdf' | 'png' | null>(null);

  // Derived state to control visibility
  const isResolvingDuplicates = duplicateQueue.length > 0;

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const reset = useCallback(() => {
    processingSessionRef.current += 1;
    setReceipts([]);
    setState({ status: 'idle' });
    setDuplicateQueue([]);
    setScanGuideOpen(false);
    setLogoErrors({});
    setWarningMessage(null);
    processedSignatures.current = [];
  }, []);

  // Strict check if receipt data is unrecognizable or bad quality
  const isReceiptUnrecognizable = (data: ReceiptData): boolean => {
      if (data.quality) {
          if (data.quality.isReadable === false) {
             console.warn("AI rejected image (Readable=false):", data.quality.issues);
             return true;
          }
          if (data.quality.readabilityScore < 85) {
             console.warn("AI rejected image (Score Low):", data.quality.readabilityScore);
             return true;
          }
      }

      const hasTotal = !!data.metadata.totalAmount;
      const hasDate = data.metadata.date && data.metadata.date !== 'YYYY-MM-DD';
      
      if (!hasTotal) {
          console.warn("Rejected: Missing Total Amount");
          return true;
      }
      if (!hasDate) {
           console.warn("Rejected: Missing Date");
           return true;
      }
      if (data.items.length < 2) {
          console.warn("Rejected: Too few items");
          return true;
      }

      return false;
  };

  const processImageBatch = useCallback(async (base64List: string[]) => {
    if (base64List.length === 0) return;

    const currentSession = processingSessionRef.current;
    setWarningMessage(null);
    
    // --- STEP 1: CLIENT-SIDE DEDUPLICATION (File & Visual) ---
    const uniqueFilesToProcess: string[] = [];
    const visualDuplicatesFound: { img: string }[] = [];
    
    const existingImagesSet = new Set(receipts.map(r => r.originalImage));
    const batchSeenSet = new Set<string>();

    // We process visual signatures sequentially here to filter before AI
    for (const img of base64List) {
        // 1a. Exact string match check
        if (existingImagesSet.has(img) || batchSeenSet.has(img)) {
            // It's a binary duplicate
            continue; 
        }

        // 1b. Visual Similarity Check (The "Speed" Fix)
        // If the user takes a burst photo, it might have different base64 but look identical.
        try {
            const sig = await getImageSignature(img);
            let isVisualDup = false;
            
            // Check against existing processed images
            for (const existingSig of processedSignatures.current) {
                if (areImagesVisuallySimilar(sig, existingSig)) {
                    isVisualDup = true;
                    break;
                }
            }

            if (isVisualDup) {
                // If it looks identical, we skip AI but track it to maybe warn user? 
                // Or just treat as "already processed".
                // For this app, we'll effectively skip it but maybe user wants to know.
                // We'll treat it as a "found duplicate" for logic flows.
                visualDuplicatesFound.push({ img });
            } else {
                uniqueFilesToProcess.push(img);
                batchSeenSet.add(img);
                processedSignatures.current.push(sig);
            }
        } catch (e) {
            // Fallback if canvas fails
            uniqueFilesToProcess.push(img);
        }
    }

    if (uniqueFilesToProcess.length === 0) {
        if (visualDuplicatesFound.length > 0) {
             alert("Las imágenes seleccionadas son visualmente idénticas a tickets ya procesados.");
        } else {
             alert("Las imágenes seleccionadas ya han sido procesadas.");
        }
        return;
    }

    setState(prev => {
        if (processingSessionRef.current !== currentSession) return prev;
        return { 
            status: 'analyzing', 
            progress: { 
                current: 0, 
                total: (prev.progress?.total || 0) + uniqueFilesToProcess.length 
            } 
        };
    });

    // --- STEP 2: PARALLEL PROCESSING (Speed Boost) ---
    // Instead of looping and waiting, we fire all requests.
    // We update progress as they complete.
    
    let completedCount = 0;
    const updateProgress = () => {
        completedCount++;
        setState(prev => ({
            ...prev,
            progress: {
                current: (prev.progress?.current || 0) + 1,
                total: prev.progress?.total || uniqueFilesToProcess.length
            }
        }));
    };

    const processSingleImage = async (img: string) => {
        try {
            const data = await analyzeReceiptImage(img);
            updateProgress();
            
            if (isReceiptUnrecognizable(data)) {
                return { success: false, reason: 'quality', img };
            }
            data.originalImage = img;
            return { success: true, data, img };
        } catch (error) {
            updateProgress();
            console.error("Analysis failed", error);
            return { success: false, reason: 'error', img };
        }
    };

    // Run parallel requests
    const results = await Promise.all(uniqueFilesToProcess.map(img => processSingleImage(img)));

    if (processingSessionRef.current !== currentSession) return;

    // --- STEP 3: POST-PROCESSING & DEDUPLICATION ---
    const newValidReceipts: ReceiptData[] = [];
    const newDuplicates: {data: ReceiptData, originalImage: string}[] = [];
    let rejectedCount = 0;

    // Use a snapshot of currently valid receipts plus those validated within this batch
    const allValidReceipts = [...receipts];

    for (const res of results) {
        if (!res.success) {
            rejectedCount++;
            continue;
        }

        const data = res.data!;
        
        // Check duplicate against:
        // 1. Old receipts (allValidReceipts contains initial state)
        // 2. New receipts added in this very batch (newValidReceipts)
        // This ensures if I upload 2 copies of same ticket in one batch, the 2nd is caught.
        
        const comparisonSet = [...allValidReceipts, ...newValidReceipts];
        let isDuplicate = false;

        for (const existing of comparisonSet) {
            if (isDuplicateReceipt(data, existing)) {
                isDuplicate = true;
                break;
            }
        }

        if (isDuplicate) {
             console.log("Duplicate content detected via AI Analysis");
             newDuplicates.push({ data, originalImage: res.img! });
        } else {
             newValidReceipts.push(data);
             // Add to our local set so subsequent items in loop check against this one
             // (Though strictly speaking, for parallel logic, we rely on the loop order here)
        }
    }

    // --- FINAL STATE UPDATE ---
    
    // 1. Add duplicates to queue
    if (newDuplicates.length > 0) {
        setDuplicateQueue(prev => [...prev, ...newDuplicates]);
    }

    // 2. Update warnings
    if (rejectedCount > 0) {
        if (newValidReceipts.length === 0 && newDuplicates.length === 0) {
            setScanGuideOpen(true);
            setState({ status: 'idle' });
            return;
        } else {
            setWarningMessage(`Se descartaron ${rejectedCount} imagen(es) por mala calidad, desenfoque o falta de datos.`);
        }
    } else if (visualDuplicatesFound.length > 0 && newValidReceipts.length === 0 && newDuplicates.length === 0) {
         // Edge case: Only visual duplicates found and skipped silently
         alert("Imágenes duplicadas detectadas visualmente.");
    }

    // 3. Update Valid Receipts
    if (newValidReceipts.length > 0) {
      setReceipts(prev => [...prev, ...newValidReceipts]);
      setState({ status: 'complete' });
    } else if (newDuplicates.length > 0) {
       // Only duplicates found
       setState({ status: 'complete' }); 
    } else {
       if (rejectedCount === 0 && visualDuplicatesFound.length === 0) {
            setState({ status: 'error', error: "No se pudieron procesar las imágenes." });
       } else if (receipts.length > 0) {
            // If we had existing receipts but this batch failed/was dupes, go back to complete
            setState({ status: 'complete' });
       } else {
            setState({ status: 'idle' });
       }
    }

  }, [receipts]);

  const handleImagesSelected = (base64List: string[]) => {
      processImageBatch(base64List);
  };

  const handleReclone = async (receiptToUpdate: ReceiptData) => {
    if (!receiptToUpdate.originalImage) return;

    setReceipts(prev => prev.map(r => 
        r === receiptToUpdate ? { ...r, isReprocessing: true } : r
    ));

    try {
        const newData = await analyzeReceiptImage(receiptToUpdate.originalImage);
        
        if (isReceiptUnrecognizable(newData)) {
             setReceipts(prev => prev.map(r => 
                r === receiptToUpdate ? { ...r, isReprocessing: false } : r
            ));
            setScanGuideOpen(true);
            return;
        }

        newData.originalImage = receiptToUpdate.originalImage;
        newData.isReprocessing = false;

        setReceipts(prev => prev.map(r => 
            r.originalImage === receiptToUpdate.originalImage ? newData : r
        ));
    } catch (error) {
        console.error("Reclone failed", error);
        alert("No se pudo regenerar el ticket. Intenta de nuevo.");
        setReceipts(prev => prev.map(r => 
            r === receiptToUpdate ? { ...r, isReprocessing: false } : r
        ));
    }
  };

  // --- DUPLICATE RESOLUTION HANDLERS ---
  const handleResolveDuplicate = useCallback((action: 'confirm' | 'cancel' | 'cancelAll') => {
    
    if (action === 'cancelAll') {
        // 1. Capture what is being cancelled to match against existing receipts
        const duplicatesToDiscard = [...duplicateQueue];
        
        // 2. Clear the queue immediately
        setDuplicateQueue([]);

        // 3. REMOVE the "Original" receipts that caused these duplicates.
        // This ensures "Cancel All" acts as "Abort operation for these tickets".
        setReceipts(prevReceipts => {
            const filtered = prevReceipts.filter(existing => {
                // If this existing receipt matches ANY duplicate in the queue, remove it.
                // We re-use the heuristic function to find the parent.
                const isParentOfDuplicate = duplicatesToDiscard.some(dup => 
                    isDuplicateReceipt(dup.data, existing)
                );
                return !isParentOfDuplicate;
            });

            // 4. Reset State to IDLE if list is empty (User sent back to start)
            if (filtered.length === 0) {
                 setState({ status: 'idle' });
            } else {
                 setState({ status: 'complete' });
            }
            
            return filtered;
        });
        return;
    }

    setDuplicateQueue(prevQueue => {
        if (prevQueue.length === 0) return [];
        
        const [current, ...remaining] = prevQueue;

        if (action === 'confirm' && current) {
            // Add duplicate to main list
            setReceipts(prev => [...prev, current.data]);
        }
        // If 'cancel', we just drop the duplicate but KEEP the original.

        // If queue becomes empty after this action
        if (remaining.length === 0) {
            setState({ status: 'complete' });
        }

        return remaining;
    });
  }, [duplicateQueue]); 

  const groupedReceipts = useMemo<Record<string, ReceiptData[]>>(() => {
    if (receipts.length === 0) return {};

    const sorted = [...receipts].sort((a, b) => {
      return new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime();
    });

    const groups: Record<string, ReceiptData[]> = {};
    sorted.forEach(receipt => {
      const store = receipt.metadata.storeName || "Otros";
      if (!groups[store]) groups[store] = [];
      groups[store].push(receipt);
    });

    return groups;
  }, [receipts]);

  // Download logic...
  const generateCanvas = async (elementId: string): Promise<HTMLCanvasElement | null> => {
      const element = document.getElementById(elementId);
      if (!element) return null;

      try {
          return await html2canvas(element, {
              scale: 3,
              useCORS: true,
              backgroundColor: null,
              windowWidth: 1200,
              onclone: (doc) => {
                  const el = doc.getElementById(elementId);
                  if (el) {
                      el.style.width = '500px';
                      el.style.maxWidth = 'none';
                      el.style.display = 'flex';
                      el.style.justifyContent = 'center';
                      el.style.alignItems = 'center';
                      el.style.padding = '40px';
                      el.style.background = 'transparent';
                  }
                  const paper = el?.querySelector('.receipt-paper');
                  if (paper) {
                      paper.classList.remove('shadow-receipt', 'transform', 'hover:scale-[1.01]', 'transition-transform');
                      (paper as HTMLElement).style.transform = 'none';
                  }
              }
          });
      } catch (error) {
          console.error("Canvas generation failed for " + elementId, error);
          return null;
      }
  };

  const handleDownloadSingle = async (receiptId: string, format: 'png' | 'pdf') => {
    if (format === 'png') {
        const canvas = await generateCanvas(receiptId);
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `scan-tickets-${receiptId}.png`;
            link.href = imgData;
            link.click();
        }
    } else if (format === 'pdf') {
        const element = document.getElementById(receiptId);
        if (!element) return;
        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (!printWindow) {
            alert("Por favor permite los pop-ups para generar el PDF.");
            return;
        }

        const paperElement = element.querySelector('.receipt-paper') as HTMLElement;
        if (!paperElement) return;

        const pxToMm = 0.264583;
        const widthMm = (paperElement.offsetWidth * pxToMm);
        const heightMm = ((paperElement.offsetHeight + 20) * pxToMm);

        const tailwindLink = '<script src="https://cdn.tailwindcss.com"></script>';
        const fontsLink = '<link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">';
        
        const criticalStyles = `
            <style>
               @media print {
                  @page { margin: 0; size: ${widthMm}mm ${heightMm}mm; }
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; background-color: white; }
               }
               body { background-color: white; display: flex; justify-content: center; align-items: flex-start; padding-top: 10px; font-family: 'Inter', sans-serif; }
               .receipt-paper { background-color: #ffffff; position: relative; background-image: radial-gradient(#00000005 0.5px, transparent 0.5px); background-size: 10px 10px; width: 360px; margin: 0 auto; box-shadow: none !important; transform: none !important; }
               .jagged-edge-top { background: linear-gradient(135deg, transparent 10px, #ffffff 10px), linear-gradient(225deg, transparent 10px, #ffffff 10px); background-position: top left; background-size: 20px 20px; background-repeat: repeat-x; height: 20px; width: 100%; position: absolute; top: -10px; left: 0; z-index: 10; }
               .jagged-edge-bottom { background: linear-gradient(-45deg, transparent 10px, #ffffff 10px), linear-gradient(45deg, transparent 10px, #ffffff 10px); background-position: bottom left; background-size: 20px 20px; background-repeat: repeat-x; height: 20px; width: 100%; position: absolute; bottom: -10px; left: 0; z-index: 10; filter: drop-shadow(0px 4px 2px rgba(0,0,0,0.05)); }
               .thermal-text { color: #000000; -webkit-font-smoothing: none; }
               .flex { display: flex; } .flex-col { flex-direction: column; } .items-center { align-items: center; } .justify-between { justify-content: space-between; } .text-center { text-align: center; } .text-right { text-align: right; } .w-full { width: 100%; } .absolute { position: absolute; } .relative { position: relative; }
               ::-webkit-scrollbar { display: none; }
            </style>
        `;

        const content = paperElement.outerHTML;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Ticket Digital - ${receiptId}</title>${fontsLink}${tailwindLink}${criticalStyles}<script>tailwind.config={darkMode:'class',theme:{extend:{colors:{brand:{600:'#ff0058',200:'#ffbfcf',900:'#960533'}},fontFamily:{mono:['"Roboto Mono"','monospace'],sans:['"Inter"','sans-serif']}}}}</script></head><body>${content}<script>document.addEventListener('DOMContentLoaded',()=>{const paper=document.querySelector('.receipt-paper');if(paper){paper.classList.remove('shadow-receipt','transform','hover:scale-[1.01]','transition-transform');}setTimeout(()=>{window.print();},800);});</script></body></html>`);
        printWindow.document.close();
    }
  };

  const handleDownloadAll = async (format: 'pdf' | 'png') => {
    setBulkDownloadFormat(format);
    
    const allIds: { id: string, name: string }[] = [];
    (Object.entries(groupedReceipts) as [string, ReceiptData[]][]).forEach(([storeName, groupReceipts]) => {
        groupReceipts.forEach((_, idx) => {
            const receiptDomId = `receipt-${storeName.replace(/\s+/g, '-')}-${idx}`;
            allIds.push({ id: receiptDomId, name: `${storeName} - ${idx + 1}` });
        });
    });

    try {
        if (format === 'pdf') {
            const doc = new jsPDF();
            let pageAdded = false;

            for (const item of allIds) {
                const canvas = await generateCanvas(item.id);
                if (canvas) {
                    if (pageAdded) doc.addPage();
                    
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pageAdded = true;
                }
            }
            doc.save('tickets-completos.pdf');

        } else if (format === 'png') {
            const zip = new JSZip();
            const folder = zip.folder("tickets-clonados");

            for (const item of allIds) {
                const canvas = await generateCanvas(item.id);
                if (canvas && folder) {
                    const dataUrl = canvas.toDataURL('image/png');
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                    const cleanName = item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    folder.file(`${cleanName}.png`, base64Data, { base64: true });
                }
            }
            
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "coleccion-tickets.zip");
        }
    } catch (error) {
        console.error("Bulk download failed", error);
        alert("Hubo un error al generar la descarga masiva.");
    } finally {
        setBulkDownloadFormat(null);
    }
  };

  const handleOpenBilling = (receipt: ReceiptData) => {
    setBillingModalState({ isOpen: true, receipt });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex justify-between items-center z-10 sticky top-0 transition-colors duration-300">
        <div 
          onClick={reset}
          className="flex items-center gap-3 cursor-pointer group select-none"
          title="Volver al inicio"
        >
          <Logo className="w-9 h-9 text-slate-200 dark:text-slate-700 group-hover:scale-105 transition-transform duration-300" />
          <h1 className="font-bold text-xl tracking-tight text-slate-800 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
            SCAN <span className="text-brand-600">TICKET'S</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsDarkMode(!isDarkMode)}
             className="p-2 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
           >
             {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
             ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
             )}
           </button>

          {state.status === 'complete' && (
             <button onClick={reset} className="text-sm font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 dark:text-brand-400 px-5 py-2 rounded-full transition-all">
                + Nuevo Escaneo
             </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="max-w-[1600px] mx-auto p-6 h-full flex flex-col">
          
          {/* Idle State */}
          {state.status === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full animate-fade-in-up">
              
              <div className="text-center mb-12 flex flex-col items-center">
                <div className="mb-6 p-6 bg-white dark:bg-slate-800 rounded-full shadow-xl shadow-brand-500/10 ring-1 ring-slate-200 dark:ring-slate-700">
                    <Logo className="w-24 h-24 text-slate-300 dark:text-slate-600" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                  Clonación Digital de <span className="text-brand-600 relative whitespace-nowrap">
                    Tickets
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-brand-300/50 dark:text-brand-900/50 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" /></svg>
                  </span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl max-w-2xl font-light">
                  Convierte tus tickets físicos en réplicas digitales pixel-perfect. <br/>
                  Totalmente editables y seleccionables.
                </p>
              </div>

              <div className="w-full max-w-2xl">
                 <Uploader onImagesSelected={handleImagesSelected} />
              </div>
              
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-center">
                <Feature 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" /></svg>}
                  title="Clonación 1:1" 
                  desc="Replica fuentes, códigos y espaciado exacto." 
                />
                <Feature 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" /></svg>}
                  title="100% Seleccionable" 
                  desc="El ticket generado es texto real, no una imagen." 
                />
                <Feature 
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
                  title="Facturación Asistida" 
                  desc="Extrae datos y abre el portal de facturación." 
                />
              </div>
            </div>
          )}

          {/* Analyzing State */}
          {state.status === 'analyzing' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <ProcessingStatus />
              {state.progress && (
                <div className="w-64 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                   <div 
                     className="bg-brand-600 h-2.5 rounded-full transition-all duration-300" 
                     style={{ width: `${(state.progress.current / state.progress.total) * 100}%` }}
                   ></div>
                </div>
              )}
              {state.progress && (
                 <p className="text-sm text-slate-500 dark:text-slate-400">
                   Procesando ticket {state.progress.current} de {state.progress.total}...
                 </p>
              )}
            </div>
          )}

          {/* Error State */}
          {state.status === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-100 dark:border-red-800 mb-6 max-w-md">
                <p className="font-semibold">Ocurrió un error</p>
                <p className="text-sm mt-1">{state.error}</p>
              </div>
              <button 
                onClick={reset}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
              >
                Intentar de Nuevo
              </button>
            </div>
          )}

          {/* Result State (Grouped Gallery) */}
          {/* IMPORTANT FIX: Hide the gallery if we are still deciding on duplicates to prevent confusion */}
          {state.status === 'complete' && !isResolvingDuplicates && (
            <div className="w-full pb-20 space-y-12 animate-fade-in">

              {/* WARNING BANNER FOR PARTIAL SUCCESS */}
              {warningMessage && (
                  <div className="w-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                      <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg text-amber-600 dark:text-amber-400 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                          </svg>
                      </div>
                      <div className="flex-1">
                          <h4 className="font-bold text-amber-800 dark:text-amber-300">Atención: Procesamiento Parcial</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                            {warningMessage} <br/> Solo se muestran los tickets que pasaron el control de calidad.
                          </p>
                      </div>
                      <button 
                        onClick={() => setWarningMessage(null)}
                        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 p-1"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                         </svg>
                      </button>
                  </div>
              )}
              
              {/* BULK DOWNLOAD ACTIONS (Only if more than 1 receipt) */}
              {receipts.length > 1 && (
                <div className="animate-fade-in-up flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-800 dark:bg-slate-800 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-600 rounded-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Descarga Masiva</h3>
                            <p className="text-slate-400 text-sm">Has procesado {receipts.length} tickets. Descárgalos todos juntos.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                         <button 
                            disabled={bulkDownloadFormat !== null}
                            onClick={() => handleDownloadAll('png')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                            {bulkDownloadFormat === 'png' ? (
                                <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-brand-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                </svg>
                            )}
                            ZIP con PNGs
                         </button>
                         <button 
                            disabled={bulkDownloadFormat !== null}
                            onClick={() => handleDownloadAll('pdf')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                            {bulkDownloadFormat === 'pdf' ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                            )}
                            PDF Completo
                         </button>
                    </div>
                </div>
              )}

              {(Object.entries(groupedReceipts) as [string, ReceiptData[]][]).map(([storeName, groupReceipts]) => {
                const firstReceipt = groupReceipts[0];
                const merchantKey = firstReceipt.billing?.merchantKey || 'generic';
                const strategy = getStrategyByKey(merchantKey);
                const hasLogo = strategy.key !== 'generic' && !!strategy.logo;
                
                // Check if this specific store's logo has failed to load
                const logoFailed = logoErrors[storeName];

                return (
                  <div key={storeName} className="animate-fade-in-up">
                    {/* Store Header */}
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
                      
                      {/* Logo Container */}
                      <div className="h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm bg-white dark:bg-white flex items-center justify-center relative">
                          {hasLogo && !logoFailed ? (
                              <img 
                                src={strategy.logo} 
                                alt={storeName} 
                                className="w-full h-full object-contain p-2"
                                onError={() => setLogoErrors(prev => ({ ...prev, [storeName]: true }))}
                              />
                          ) : (
                              <div className="w-full h-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-brand-600 dark:text-brand-400">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                                  </svg>
                              </div>
                          )}
                      </div>

                      <div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{storeName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">{groupReceipts.length} ticket{groupReceipts.length !== 1 ? 's' : ''} encontrados</p>
                      </div>
                    </div>

                    {/* List of Receipts (Side by Side comparison) */}
                    <div className="flex flex-col gap-16">
                      {groupReceipts.map((receipt, idx) => {
                        const receiptDomId = `receipt-${storeName.replace(/\s+/g, '-')}-${idx}`;
                        // We recalculate strategy here for the button (might be same)
                        // Optimization: could pass down if needed, but it's cheap
                        const itemHasPortal = strategy.key !== 'generic' && !!strategy.portalUrl;

                        return (
                          <div key={idx} className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
                            
                            {/* Item Header */}
                            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
                                  {receipt.metadata.date}
                                </span>
                                {receipt.metadata.totalAmount && (
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                        {receipt.metadata.totalAmount}
                                    </span>
                                )}
                                
                                {/* Portal Button (Primary) */}
                                <a 
                                    href={itemHasPortal ? strategy.portalUrl : undefined}
                                    target={itemHasPortal ? "_blank" : undefined}
                                    rel={itemHasPortal ? "noopener noreferrer" : undefined}
                                    onClick={(e) => !itemHasPortal && e.preventDefault()}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm
                                      ${itemHasPortal 
                                        ? 'bg-slate-900 text-white hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/20 transform hover:-translate-y-0.5 cursor-pointer dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-brand-500 dark:hover:text-white' 
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600'
                                      }`}
                                    title={itemHasPortal ? `Ir al portal de ${strategy.name}` : 'Portal no disponible'}
                                >
                                    <span>{itemHasPortal ? 'Portal de Facturación' : 'Portal No Disponible'}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                </a>

                              </div>
                              
                              <div className="flex gap-2">
                                {/* Re-clone Button */}
                                <button 
                                  onClick={() => handleReclone(receipt)}
                                  disabled={receipt.isReprocessing}
                                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-lg hover:border-brand-200 dark:hover:border-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Volver a generar este ticket si hubo errores"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${receipt.isReprocessing ? 'animate-spin' : ''}`}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                  </svg>
                                  {receipt.isReprocessing ? 'Regenerando...' : 'Volver a clonar'}
                                </button>

                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                <button 
                                  onClick={() => handleDownloadSingle(receiptDomId, 'png')}
                                  className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                  </svg>
                                  PNG
                                </button>
                                <button 
                                  onClick={() => handleDownloadSingle(receiptDomId, 'pdf')}
                                  className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                  </svg>
                                  PDF
                                </button>
                              </div>
                            </div>
                            
                            {/* Comparison Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                              
                              {/* Left: Original with Zoom */}
                              <div className="w-full flex flex-col items-center">
                                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Original</h4>
                                  {receipt.originalImage && (
                                      <OriginalImageViewer imageUrl={receipt.originalImage} />
                                  )}
                              </div>

                              {/* Right: Digital Clone */}
                              <div className="w-full flex flex-col items-center relative">
                                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Clon Digital</h4>
                                  
                                  <div id={receiptDomId} className="w-full flex justify-center">
                                      <ReceiptRenderer data={receipt} />
                                  </div>

                                  {/* Local Loading Overlay */}
                                  {receipt.isReprocessing && (
                                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl">
                                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                                          <p className="mt-4 text-sm font-semibold text-brand-600 animate-pulse">Regenerando ticket...</p>
                                      </div>
                                  )}
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      
      {/* Floating Text Selection Menu */}
      <TextSelectionMenu />

      {/* Duplicate Resolution Modal - Moved to end for Z-Index safety */}
      <DuplicateResolver 
        isOpen={duplicateQueue.length > 0}
        duplicateImage={duplicateQueue[0] ? duplicateQueue[0].originalImage : null}
        count={duplicateQueue.length}
        onConfirm={() => handleResolveDuplicate('confirm')}
        onCancel={() => handleResolveDuplicate('cancel')}
        onCancelAll={() => handleResolveDuplicate('cancelAll')}
      />

      {/* Bad Photo Guide Modal */}
      <ScanGuideModal 
        isOpen={scanGuideOpen}
        onClose={() => setScanGuideOpen(false)}
        onRetry={() => {
            setScanGuideOpen(false);
            // Ideally trigger file input, but simple close allows user to click main input
        }}
      />

      {/* Billing Assistant Modal */}
      <BillingModal 
        isOpen={billingModalState.isOpen}
        onClose={() => setBillingModalState({ isOpen: false, receipt: null })}
        receipt={billingModalState.receipt}
      />
    </div>
  );
};

const Feature: React.FC<{ title: string, desc: string, icon: React.ReactNode }> = ({ title, desc, icon }) => (
  <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300 flex flex-col items-center gap-3">
    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 text-brand-600 dark:text-brand-400">
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{desc}</p>
    </div>
  </div>
);

export default App;
