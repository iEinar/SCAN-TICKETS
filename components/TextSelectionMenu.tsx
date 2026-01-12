import React, { useState, useEffect } from 'react';

const TextSelectionMenu: React.FC = () => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [show, setShow] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    // Logic to calculate position and visibility
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      // Hide if no selection or selection is empty
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setShow(false);
        setIsCopied(false);
        return;
      }

      // --- CRITICAL CHANGE: Check if selection is inside a cloned receipt ---
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;

      // Traverse up the DOM to find if we are inside a .receipt-paper element
      let currentNode: HTMLElement | null = (anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode) as HTMLElement;
      let isInsideReceipt = false;

      while (currentNode) {
        if (currentNode.classList && currentNode.classList.contains('receipt-paper')) {
          isInsideReceipt = true;
          break;
        }
        currentNode = currentNode.parentElement;
      }

      // If not inside a receipt, hide the menu
      if (!isInsideReceipt) {
        setShow(false);
        return;
      }
      // -------------------------------------------------------------------

      // Get the bounding rectangle of the selection
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Safety check for invisible selections
      if (rect.width === 0 && rect.height === 0) return;

      // Calculate center top position relative to viewport
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
      setShow(true);
    };

    // Use mouseup/keyup to finalize position to avoid jitter while dragging
    const onInteract = () => {
       // Small timeout allows the browser to update the selection fully
       setTimeout(handleSelectionChange, 10);
    };

    // Hide on scroll/resize to prevent detached UI
    const onScrollOrResize = () => {
        if (show) setShow(false);
    };

    // Attach listeners
    document.addEventListener('mouseup', onInteract);
    document.addEventListener('keyup', onInteract);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', onScrollOrResize, { capture: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mouseup', onInteract);
      document.removeEventListener('keyup', onInteract);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', onScrollOrResize, { capture: true });
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [show]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent button click from clearing selection
    e.stopPropagation(); 
    
    const selection = window.getSelection();
    const text = selection?.toString();

    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        
        // Hide after a brief success message
        setTimeout(() => {
           setShow(false);
           setIsCopied(false);
           // We purposefully keep the selection active so the user sees what they copied
        }, 1500);
      } catch (err) {
        console.error("Copy failed", err);
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Determine the target element. 
    // anchorNode is where the user started selecting. 
    // Usually a text node (nodeType 3), so we grab its parent.
    const node = selection.anchorNode;
    const element = (node?.nodeType === 3 ? node.parentElement : node) as HTMLElement;

    if (element) {
        // Hide the menu immediately
        setShow(false);

        // Make element editable
        element.contentEditable = "true";
        element.focus();

        // Add temporary styling to indicate edit mode
        const originalClasses = element.className;
        element.classList.add('outline-none', 'ring-2', 'ring-brand-500', 'rounded-sm', 'bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-900', 'dark:text-brand-100', 'px-1', '-mx-1');

        // Cleanup handler
        const finishEditing = () => {
            element.contentEditable = "false";
            // Remove the temporary styling classes
            element.classList.remove('outline-none', 'ring-2', 'ring-brand-500', 'rounded-sm', 'bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-900', 'dark:text-brand-100', 'px-1', '-mx-1');
            
            // Clean up listeners
            element.removeEventListener('blur', finishEditing);
            element.removeEventListener('keydown', onKeyDown);
        };

        const onKeyDown = (ev: KeyboardEvent) => {
            // Finish on Enter (optional, maybe Shift+Enter for newline? For receipts, usually Enter means done)
            if (ev.key === 'Enter') {
                ev.preventDefault();
                element.blur(); // Triggers finishEditing
            }
        };

        element.addEventListener('blur', finishEditing);
        element.addEventListener('keydown', onKeyDown);
    }
  };

  // Only render if we have a valid position or are currently showing
  if (!position && !show) return null;

  return (
    <div
      className={`fixed z-[100] transition-all duration-200 ease-out transform pointer-events-none ${
        show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
      }`}
      style={{
        left: position ? position.x : 0,
        top: position ? position.y : 0,
        // Center horizontally and move above the selection
        transform: `translate(-50%, -100%) translateY(-12px)` 
      }}
    >
        <div className="flex bg-slate-900 rounded-full shadow-xl border border-slate-700/50 backdrop-blur-md overflow-hidden pointer-events-auto">
            {/* Copy Button */}
            <button
                onClick={handleCopy}
                onMouseDown={(e) => e.preventDefault()} // Critical: prevents focus loss from text
                className={`flex items-center gap-2 px-4 py-2 transition-all hover:bg-black border-r border-slate-700 ${
                    isCopied 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                    : 'text-slate-100'
                }`}
            >
                {isCopied ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-bold tracking-wide">Copiado</span>
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400">
                            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                            <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                        </svg>
                        <span className="text-xs font-bold tracking-wide">Copiar</span>
                    </>
                )}
            </button>

            {/* Edit Button */}
            <button
                onClick={handleEdit}
                onMouseDown={(e) => e.preventDefault()}
                className="flex items-center gap-2 px-4 py-2 text-slate-100 hover:bg-black transition-all"
                title="Editar este texto"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-brand-400">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
                <span className="text-xs font-bold tracking-wide">Editar</span>
            </button>
        </div>
        
        {/* Arrow pointer */}
        <div 
            className={`absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2.5 h-2.5 border-r border-b ${
                isCopied 
                ? 'bg-emerald-600 border-emerald-500' 
                : 'bg-slate-900 border-slate-700'
            }`} 
        />
    </div>
  );
};

export default TextSelectionMenu;