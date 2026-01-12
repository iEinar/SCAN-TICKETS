import React, { useState, useEffect } from 'react';
import { ReceiptData, TaxProfile } from '../types';
import { getStrategyByKey } from '../services/billingStrategies';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

const DEFAULT_PROFILE: TaxProfile = {
  rfc: '',
  razonSocial: '',
  cp: '',
  regimenFiscal: '601 - General de Ley Personas Morales',
  usoCFDI: 'G03 - Gastos en general',
  email: ''
};

const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose, receipt }) => {
  const [step, setStep] = useState<'profile' | 'verify'>('profile');
  const [profile, setProfile] = useState<TaxProfile>(DEFAULT_PROFILE);
  const [billingData, setBillingData] = useState<any>({});

  // Load profile from local storage
  useEffect(() => {
    const saved = localStorage.getItem('scan_tickets_tax_profile');
    if (saved) {
      setProfile(JSON.parse(saved));
      // If we have a profile, go straight to verify, unless it's empty
      if (saved.length > 20) setStep('verify'); 
    }
  }, []);

  // Prepare billing data when receipt changes
  useEffect(() => {
    if (receipt && receipt.billing) {
      setBillingData({
        ...receipt.billing,
        total: receipt.metadata.totalAmount || receipt.billing.rawTotal
      });
    }
  }, [receipt]);

  const handleSaveProfile = () => {
    localStorage.setItem('scan_tickets_tax_profile', JSON.stringify(profile));
    setStep('verify');
  };

  const handleCopyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    const el = document.getElementById(fieldId);
    if (el) {
        el.classList.add('text-emerald-600', 'font-bold');
        setTimeout(() => el.classList.remove('text-emerald-600', 'font-bold'), 1000);
    }
  };

  const handleOpenPortal = () => {
    if (!receipt || !receipt.billing?.merchantKey) return;
    const strategy = getStrategyByKey(receipt.billing.merchantKey);
    
    // Open in new tab
    window.open(strategy.portalUrl, '_blank');
  };

  if (!isOpen || !receipt) return null;

  const strategy = getStrategyByKey(receipt.billing?.merchantKey || 'generic');
  const isWalmart = strategy.key === 'walmart';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-100 dark:bg-brand-900/50 rounded-lg text-brand-600">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
               </svg>
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Asistente de Facturación</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {step === 'profile' ? 'Configura tus datos fiscales' : `Facturando a ${strategy.name}`}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {step === 'profile' && (
            <div className="space-y-4 animate-fade-in">
               <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm mb-4">
                  Guarda tus datos fiscales una sola vez. Los utilizaremos para ayudarte a llenar los formularios de facturación más rápido.
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">RFC</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                      value={profile.rfc}
                      onChange={e => setProfile({...profile, rfc: e.target.value.toUpperCase()})}
                      placeholder="XAXX010101000"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Código Postal</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                      value={profile.cp}
                      onChange={e => setProfile({...profile, cp: e.target.value})}
                      placeholder="00000"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Razón Social</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                      value={profile.razonSocial}
                      onChange={e => setProfile({...profile, razonSocial: e.target.value.toUpperCase()})}
                      placeholder="Nombre o Empresa"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Régimen Fiscal</label>
                    <select 
                       className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                       value={profile.regimenFiscal}
                       onChange={e => setProfile({...profile, regimenFiscal: e.target.value})}
                    >
                        <option>601 - General de Ley Personas Morales</option>
                        <option>605 - Sueldos y Salarios</option>
                        <option>612 - Personas Físicas con Actividades Empresariales</option>
                        <option>626 - Régimen Simplificado de Confianza</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Uso CFDI</label>
                    <select 
                       className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                       value={profile.usoCFDI}
                       onChange={e => setProfile({...profile, usoCFDI: e.target.value})}
                    >
                        <option>G03 - Gastos en general</option>
                        <option>P01 - Por definir</option>
                    </select>
                  </div>
                   <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                    <input 
                      type="email" 
                      className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500"
                      value={profile.email}
                      onChange={e => setProfile({...profile, email: e.target.value})}
                      placeholder="facturas@empresa.com"
                    />
                  </div>
               </div>
               <button 
                 onClick={handleSaveProfile}
                 className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
               >
                 Guardar y Continuar
               </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="animate-fade-in space-y-6">
                
                {/* 1. Merchant & Strategy Info */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    {strategy.logo && <img src={strategy.logo} alt={strategy.name} className="h-10 w-auto object-contain" />}
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{strategy.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">{strategy.portalUrl}</p>
                    </div>
                </div>

                {/* 2. Copy/Paste Dashboard */}
                <div>
                   <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos del Ticket (Para copiar)</h5>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* TR Number */}
                      <div className="relative group">
                          <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 block">TR (Transacción) / Ticket ID</label>
                          <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <input 
                                type="text" 
                                value={billingData.transactionId || billingData.ticketNumber || ''} 
                                onChange={(e) => setBillingData({...billingData, transactionId: e.target.value})}
                                className="bg-transparent border-none w-full px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 focus:ring-0"
                              />
                              <button 
                                onClick={() => handleCopyToClipboard(billingData.transactionId || billingData.ticketNumber || '', 'copy-tr')}
                                className="bg-slate-200 dark:bg-slate-700 px-3 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                              >
                                <svg id="copy-tr" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                          </div>
                          {isWalmart && <p className="text-[10px] text-slate-400 mt-1">Busca el código que empieza con TR en el ticket.</p>}
                      </div>

                      {/* TC Number */}
                      <div className="relative group">
                          <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 block">{isWalmart ? 'TC (Código)' : 'Folio'}</label>
                          <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <input 
                                type="text" 
                                value={isWalmart ? billingData.ticketNumber || '' : ''} 
                                onChange={(e) => setBillingData({...billingData, ticketNumber: e.target.value})}
                                placeholder={isWalmart ? "####" : "Folio"}
                                className="bg-transparent border-none w-full px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 focus:ring-0"
                              />
                              <button 
                                onClick={() => handleCopyToClipboard(billingData.ticketNumber || '', 'copy-tc')}
                                className="bg-slate-200 dark:bg-slate-700 px-3 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                              >
                                <svg id="copy-tc" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                          </div>
                          {isWalmart && <p className="text-[10px] text-slate-400 mt-1">Suele ser de 3 o 4 dígitos (TC).</p>}
                      </div>

                      {/* Total Amount */}
                      <div className="relative group">
                          <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 block">Monto Total</label>
                           <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <input 
                                type="text" 
                                value={billingData.total || ''} 
                                readOnly
                                className="bg-transparent border-none w-full px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 focus:ring-0"
                              />
                               <button 
                                onClick={() => handleCopyToClipboard(billingData.total || '', 'copy-total')}
                                className="bg-slate-200 dark:bg-slate-700 px-3 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                              >
                                <svg id="copy-total" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                           </div>
                      </div>

                       {/* RFC (User Profile) */}
                       <div className="relative group">
                          <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 block">Tu RFC</label>
                           <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              <input 
                                type="text" 
                                value={profile.rfc} 
                                readOnly
                                className="bg-transparent border-none w-full px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 focus:ring-0"
                              />
                               <button 
                                onClick={() => handleCopyToClipboard(profile.rfc, 'copy-rfc')}
                                className="bg-slate-200 dark:bg-slate-700 px-3 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                              >
                                <svg id="copy-rfc" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              </button>
                           </div>
                      </div>
                   </div>
                </div>

                {/* 3. Helper Info */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50">
                   <h6 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-1">⚠️ Importante</h6>
                   <p className="text-xs text-amber-700 dark:text-amber-500">
                     Al hacer clic en "Ir al Portal", se abrirá el sitio oficial de <strong>{strategy.name}</strong> en una nueva pestaña. 
                     Usa los botones de copiar arriba para llenar el formulario rápidamente.
                   </p>
                </div>

                <div className="flex gap-3 pt-2">
                   <button 
                     onClick={() => setStep('profile')}
                     className="px-4 py-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
                   >
                     Editar Perfil
                   </button>
                   <button 
                     onClick={handleOpenPortal}
                     className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                   >
                     Ir al Portal de Facturación
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                     </svg>
                   </button>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BillingModal;