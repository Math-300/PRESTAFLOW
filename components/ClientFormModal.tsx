
import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Plus, X, UserPlus, Check, Calculator, Save, Landmark, RefreshCw, AlertCircle, LayoutGrid } from 'lucide-react';
import { Client, BankAccount } from '../types';
import { getToday, formatNumberWithDots, formatCurrency } from '../utils/format';
import { calculateLoanProjection } from '../services/loanUtils';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>; // Passes the raw form state back to App for processing
  editingClient: Client | null;
  bankAccounts: BankAccount[];
  allClients: Client[]; // For referrals & card checks
  nextCardCode: string;
  maxCardLimit?: number;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen, onClose, onSubmit, editingClient, bankAccounts, allClients, nextCardCode, maxCardLimit = 500
}) => {
  
  // Internal State
  const [clientForm, setClientForm] = useState({
    name: '',
    cardCode: '',
    cedula: '',
    phone: '',
    address: '',
    occupation: '',
    workAddress: '',
    loanLimit: '',
    guarantorName: '',
    guarantorPhone: '',
    collateral: '', // NEW
    creditStartDate: getToday(),
    notes: '',
    referrerId: '',
    referrerSearch: '',
    interestRate: '10',
    interestType: 'FIXED' as 'FIXED' | 'DIMINISHING',
    paymentFrequency: 'MONTHLY' as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    loanTermMonths: '1',
    hasInitialLoan: true,
    initialAmount: '',
    initialInterest: '',
    initialBankId: '',
    isRedirection: false,
    redirectionWaitDays: '3'
  });

  const [showAvailableGaps, setShowAvailableGaps] = useState(false);
  
  // Initialization Effect
  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setClientForm({
          name: editingClient.name,
          cardCode: editingClient.cardCode,
          cedula: editingClient.cedula,
          phone: editingClient.phone,
          address: editingClient.address,
          occupation: editingClient.occupation || '',
          workAddress: editingClient.workAddress || '',
          loanLimit: editingClient.loanLimit ? editingClient.loanLimit.toString() : '',
          guarantorName: editingClient.guarantorName,
          guarantorPhone: editingClient.guarantorPhone,
          collateral: editingClient.collateral || '',
          creditStartDate: editingClient.creditStartDate,
          notes: editingClient.notes || '',
          referrerId: editingClient.referrerId || '',
          referrerSearch: '',
          interestRate: editingClient.interestRate ? editingClient.interestRate.toString() : '0',
          interestType: editingClient.interestType || 'FIXED',
          paymentFrequency: editingClient.paymentFrequency || 'MONTHLY',
          loanTermMonths: editingClient.loanTermMonths ? editingClient.loanTermMonths.toString() : '1',
          hasInitialLoan: false, // Edit mode doesn't create new initial loan
          initialAmount: '',
          initialInterest: '',
          initialBankId: '',
          isRedirection: false,
          redirectionWaitDays: editingClient.redirectionWaitDays ? editingClient.redirectionWaitDays.toString() : '3'
        });
      } else {
        // New Client
        setClientForm({
          name: '',
          cardCode: nextCardCode,
          cedula: '',
          phone: '',
          address: '',
          occupation: '',
          workAddress: '',
          loanLimit: '',
          guarantorName: '',
          guarantorPhone: '',
          collateral: '',
          creditStartDate: getToday(),
          notes: '',
          referrerId: '',
          referrerSearch: '',
          interestRate: '10',
          interestType: 'FIXED',
          paymentFrequency: 'MONTHLY',
          loanTermMonths: '1',
          hasInitialLoan: true,
          initialAmount: '',
          initialInterest: '',
          initialBankId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
          isRedirection: false,
          redirectionWaitDays: '3'
        });
      }
    }
  }, [isOpen, editingClient, nextCardCode, bankAccounts]);

  // Derived Calculations
  const loanProjection = useMemo(() => {
    return calculateLoanProjection(clientForm);
  }, [clientForm.initialAmount, clientForm.interestRate, clientForm.interestType, clientForm.paymentFrequency, clientForm.loanTermMonths]);

  // Auto-set initial interest when projection changes (only for new loans)
  useEffect(() => {
    if (!editingClient && loanProjection && clientForm.hasInitialLoan && clientForm.initialInterest === '') {
       setClientForm(prev => ({ ...prev, initialInterest: formatNumberWithDots(loanProjection.firstPeriodInterest.toString()) }));
    }
  }, [loanProjection?.firstPeriodInterest, clientForm.hasInitialLoan, editingClient]);

  const filteredReferrals = useMemo(() => {
    if (!clientForm.referrerSearch) return [];
    const q = clientForm.referrerSearch.toLowerCase();
    return allClients.filter(c => c.name.toLowerCase().includes(q) || c.cedula.includes(q)).slice(0, 3);
  }, [allClients, clientForm.referrerSearch]);

  const selectedReferrer = useMemo(() => allClients.find(c => c.id === clientForm.referrerId), [allClients, clientForm.referrerId]);

  // CARD VALIDATION LOGIC
  const cardStatus = useMemo(() => {
     if (!clientForm.cardCode) return null;
     const code = clientForm.cardCode;
     
     // Find if any ACTIVE client has this code (excluding current editing client)
     const owner = allClients.find(c => 
        c.cardCode === code && 
        c.status === 'ACTIVE' && 
        c.id !== editingClient?.id
     );

     if (owner) {
        return { status: 'TAKEN', ownerName: owner.name };
     }
     
     // Optional: Check range
     const num = parseInt(code);
     if (num > maxCardLimit) return { status: 'WARNING', msg: `Supera el límite (${maxCardLimit})` };

     return { status: 'FREE' };
  }, [clientForm.cardCode, allClients, editingClient, maxCardLimit]);

  const availableGaps = useMemo(() => {
     if (!showAvailableGaps) return [];
     const activeCodes = new Set(allClients.filter(c => c.status === 'ACTIVE').map(c => parseInt(c.cardCode)));
     const gaps = [];
     for(let i=1; i<=maxCardLimit; i++) {
        if (!activeCodes.has(i)) {
           gaps.push(i);
           if(gaps.length >= 40) break; // Limit to showing first 40 gaps to avoid lag
        }
     }
     return gaps;
  }, [showAvailableGaps, allClients, maxCardLimit]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Block submission if card is taken
      if (cardStatus?.status === 'TAKEN') {
         alert(`Error: La tarjeta #${clientForm.cardCode} está en uso por ${cardStatus.ownerName}.`);
         return;
      }
      // Pass the state up to the parent
      onSubmit(clientForm);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
       <form onSubmit={handleSubmit} className="bg-white rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden h-full md:h-auto md:max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200">
         
         {/* HEADER */}
         <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            {editingClient ? <Pencil size={18}/> : <Plus size={18}/>}
            {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <div className="flex items-center gap-2">
             <span className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 font-mono hidden sm:inline-block">ESC para cancelar</span>
             <button type="button" onClick={onClose}><X size={20}/></button>
          </div>
        </div>

         {/* SCROLLABLE CONTENT */}
         <div className="p-4 md:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 relative">
          
          {/* PERSONAL DATA */}
          <div className="grid grid-cols-12 gap-3 md:gap-4">
             <div className="col-span-8">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                <input required autoFocus type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} />
             </div>
             <div className="col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cédula</label>
                <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.cedula} onChange={e => setClientForm({...clientForm, cedula: e.target.value})} />
             </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 md:gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                   Tarjeta N°
                   <button 
                     type="button" 
                     onClick={() => setShowAvailableGaps(!showAvailableGaps)}
                     className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                   >
                      <LayoutGrid size={10}/> Ver Libres
                   </button>
                </label>
                <div className="relative">
                    <input 
                        type="text" 
                        required
                        className={`w-full p-2 border rounded font-mono text-center font-bold outline-none pr-8
                            ${cardStatus?.status === 'TAKEN' ? 'border-red-500 bg-red-50 text-red-700' : 
                              cardStatus?.status === 'WARNING' ? 'border-yellow-500 bg-yellow-50' : 'border-slate-300 bg-white text-slate-700'}
                        `}
                        value={clientForm.cardCode}
                        onChange={e => setClientForm({...clientForm, cardCode: e.target.value})}
                    />
                    <div className="absolute right-2 top-2.5">
                        {cardStatus?.status === 'TAKEN' ? <X size={16} className="text-red-500"/> : <Check size={16} className="text-green-500"/>}
                    </div>
                </div>
                {/* Status Message */}
                <div className="text-[10px] mt-1 absolute left-0 -bottom-5 whitespace-nowrap">
                    {cardStatus?.status === 'TAKEN' && <span className="text-red-600 font-bold flex items-center gap-1"><AlertCircle size={10}/> En uso por: {cardStatus.ownerName}</span>}
                    {cardStatus?.status === 'WARNING' && <span className="text-yellow-600 font-bold">{cardStatus.msg}</span>}
                    {cardStatus?.status === 'FREE' && <span className="text-green-600 font-bold">Disponible para asignar</span>}
                </div>

                {/* AVAILABLE GAPS POPUP */}
                {showAvailableGaps && (
                   <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-xl border border-slate-200 z-50 p-3 animate-in fade-in zoom-in-95">
                      <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
                         <span className="text-xs font-bold text-slate-500">Primeros cupos libres</span>
                         <button onClick={() => setShowAvailableGaps(false)}><X size={14} className="text-slate-400"/></button>
                      </div>
                      <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                         {availableGaps.map(gap => (
                            <button
                               key={gap}
                               type="button"
                               onClick={() => { setClientForm({...clientForm, cardCode: gap.toString()}); setShowAvailableGaps(false); }}
                               className="bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-1.5 rounded border border-green-200"
                            >
                               {gap}
                            </button>
                         ))}
                      </div>
                      <div className="mt-2 text-[10px] text-center text-slate-400">
                         Mostrando primeros huecos hasta {maxCardLimit}
                      </div>
                   </div>
                )}
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfonos</label>
                <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio Crédito</label>
                <input required type="date" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.creditStartDate} onChange={e => setClientForm({...clientForm, creditStartDate: e.target.value})} />
             </div>
          </div>

           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                 <UserPlus size={14}/> Referido Por (Opcional)
              </label>
              {!selectedReferrer ? (
                 <div className="relative">
                    <input 
                       type="text" 
                       placeholder="Buscar cliente existente..." 
                       className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                       value={clientForm.referrerSearch}
                       onChange={e => setClientForm({...clientForm, referrerSearch: e.target.value})}
                    />
                    {clientForm.referrerSearch && filteredReferrals.length > 0 && (
                       <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-xl z-10 rounded-b mt-1">
                          {filteredReferrals.map(r => (
                             <div 
                                key={r.id} 
                                onClick={() => setClientForm({...clientForm, referrerId: r.id, referrerSearch: ''})}
                                className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 text-sm flex justify-between"
                             >
                                <span className="font-bold">{r.name}</span>
                                <span className="text-slate-400 text-xs">{r.cedula}</span>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              ) : (
                 <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-900 text-sm font-bold">
                       <Check size={16}/> {selectedReferrer.name}
                    </div>
                    <button type="button" onClick={() => setClientForm({...clientForm, referrerId: ''})} className="text-xs text-red-500 hover:underline">Remover</button>
                 </div>
              )}
           </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Casa</label>
            <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} />
          </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ocupación</label>
                <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.occupation} onChange={e => setClientForm({...clientForm, occupation: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dir. Trabajo</label>
                <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.workAddress} onChange={e => setClientForm({...clientForm, workAddress: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cupo Máximo</label>
                <div className="relative">
                    <span className="absolute left-2 top-2 text-slate-400">$</span>
                    <input 
                       type="text" 
                       className="w-full pl-6 p-2 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
                       placeholder="0" 
                       value={formatNumberWithDots(clientForm.loanLimit)} 
                       onChange={e => setClientForm({...clientForm, loanLimit: e.target.value})} 
                    />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Fiador</label>
              <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.guarantorName} onChange={e => setClientForm({...clientForm, guarantorName: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tel. Fiador</label>
              <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={clientForm.guarantorPhone} onChange={e => setClientForm({...clientForm, guarantorPhone: e.target.value})} />
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <label className="block text-xs font-bold text-orange-800 uppercase mb-1">Garantía / Prenda</label>
              <input 
                  type="text" 
                  className="w-full border border-orange-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-400 text-sm" 
                  placeholder="Descripción del artículo en garantía (Ej: Moto, TV, Título valor...)"
                  value={clientForm.collateral} 
                  onChange={e => setClientForm({...clientForm, collateral: e.target.value})} 
              />
          </div>

             {/* CALCULATOR / LOAN SETTINGS */}
             <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2">
                   <Calculator size={14}/> {editingClient ? 'Configuración (Edición)' : 'Simulador Préstamo'}
                </h4>
                
                <div className="grid grid-cols-12 gap-3 md:gap-4">
                   <div className="col-span-12 sm:col-span-5">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto a Prestar</label>
                       <div className="relative">
                          <span className="absolute left-2 top-2 text-slate-400">$</span>
                          <input 
                             type="text" 
                             className={`w-full pl-6 p-2 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg ${editingClient ? 'opacity-60 cursor-not-allowed' : ''}`}
                             placeholder="0" 
                             value={formatNumberWithDots(clientForm.initialAmount)} 
                             onChange={e => !editingClient && setClientForm({...clientForm, initialAmount: e.target.value})} 
                             readOnly={!!editingClient}
                          />
                       </div>
                   </div>

                   <div className="col-span-6 sm:col-span-3">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plazo (Meses)</label>
                       <input 
                          type="number" 
                          className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-center" 
                          placeholder="#" 
                          value={clientForm.loanTermMonths}
                          onChange={e => setClientForm({...clientForm, loanTermMonths: e.target.value})} 
                       />
                   </div>

                   <div className="col-span-6 sm:col-span-4">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frecuencia Pago</label>
                       <select 
                          className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          value={clientForm.paymentFrequency}
                          onChange={e => setClientForm({...clientForm, paymentFrequency: e.target.value as any})}
                       >
                          <option value="DAILY">Diario (Gota a Gota)</option>
                          <option value="WEEKLY">Semanal</option>
                          <option value="BIWEEKLY">Quincenal</option>
                          <option value="MONTHLY">Mensual</option>
                       </select>
                   </div>

                   <div className="col-span-4 sm:col-span-3">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tasa Mensual</label>
                       <div className="relative">
                          <input 
                             type="number" 
                             className="w-full p-2 pr-6 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold" 
                             placeholder="%" 
                             value={clientForm.interestRate}
                             onChange={e => setClientForm({...clientForm, interestRate: e.target.value})} 
                          />
                          <span className="absolute right-2 top-2 text-slate-400 font-bold">%</span>
                       </div>
                   </div>
                   
                   <div className="col-span-8 sm:col-span-9">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Interés</label>
                       <select 
                          className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          value={clientForm.interestType}
                          onChange={e => setClientForm({...clientForm, interestType: e.target.value as any})}
                       >
                          <option value="FIXED">Interés Fijo (Simple) - Tradicional</option>
                          <option value="DIMINISHING">Sobre Saldos (Amortización Real)</option>
                       </select>
                   </div>
                </div>

                {!editingClient && loanProjection && (
                   <div className="mt-4 bg-white p-3 md:p-4 rounded-xl border border-indigo-100 flex items-center justify-between shadow-sm animate-in fade-in">
                      <div className="text-center px-2 border-r border-slate-100">
                         <div className="text-[10px] text-slate-400 font-bold uppercase">N° Cuotas</div>
                         <div className="font-bold text-lg md:text-xl text-indigo-700">{loanProjection.totalInstallments}</div>
                      </div>
                      <div className="text-center px-2 border-r border-slate-100 flex-1">
                         <div className="text-[10px] text-slate-400 font-bold uppercase">Cuota Estimada</div>
                         <div className="font-bold text-lg md:text-xl text-emerald-600">{formatCurrency(loanProjection.quota)}</div>
                      </div>
                      <div className="text-center px-2">
                         <div className="text-[10px] text-slate-400 font-bold uppercase">Intereses</div>
                         <div className="font-bold text-md md:text-lg text-amber-600">{formatCurrency(loanProjection.totalInterest)}</div>
                      </div>
                   </div>
                )}
             </div>

          {!editingClient && (
              <div className="border-2 border-green-500 bg-green-50 rounded-xl p-4 mt-4">
                 <div className="flex items-center gap-2 mb-3 text-green-800 font-bold border-b border-green-200 pb-2">
                    <Landmark size={20}/>
                    <h3>Detalles del Desembolso</h3>
                 </div>

                 <div className="grid grid-cols-12 gap-3 md:gap-4">
                     <div className="col-span-6">
                         <label className="block text-xs font-bold text-green-800 uppercase mb-1">Monto a Entregar</label>
                         <div className="relative">
                             <span className="absolute left-3 top-2.5 text-green-600 font-bold">$</span>
                             <input 
                                readOnly 
                                className="w-full pl-7 p-2 bg-white/50 border border-green-200 rounded font-bold text-slate-600 cursor-not-allowed"
                                value={formatNumberWithDots(clientForm.initialAmount)}
                             />
                         </div>
                     </div>
                     
                     <div className="col-span-6">
                         <label className="block text-xs font-bold text-green-800 uppercase mb-1">Interés Anticipado</label>
                         <div className="relative">
                             <span className="absolute left-3 top-2.5 text-green-600 font-bold">$</span>
                             <input 
                                type="text" 
                                className="w-full pl-7 p-2 bg-white border border-green-300 rounded font-bold text-green-900 focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="0" 
                                value={formatNumberWithDots(clientForm.initialInterest)} 
                                onChange={e => setClientForm({...clientForm, initialInterest: e.target.value})} 
                             />
                         </div>
                     </div>

                     <div className="col-span-12 pt-2 border-t border-green-200">
                         <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-green-100 transition-colors">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${clientForm.isRedirection ? 'bg-orange-500' : 'bg-slate-300'}`}>
                               <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${clientForm.isRedirection ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <input type="checkbox" className="hidden" checked={clientForm.isRedirection} onChange={e => setClientForm({...clientForm, isRedirection: e.target.checked})} />
                            <div className="flex-1">
                               <div className={`font-bold text-sm ${clientForm.isRedirection ? 'text-orange-700' : 'text-slate-600'}`}>
                                  {clientForm.isRedirection ? 'Usar Redirección' : 'Desembolso Normal (Caja)'}
                               </div>
                            </div>
                         </label>

                         {clientForm.isRedirection ? (
                            <div className="mt-3 bg-orange-100 p-3 rounded border border-orange-200 animate-in slide-in-from-top-2">
                               <div className="text-xs text-orange-800 mb-2">
                                  El dinero será entregado por OTRO cliente. Configure el tiempo de espera permitido.
                               </div>
                               <div className="flex items-center gap-3">
                                  <label className="text-xs font-bold text-orange-800 uppercase">Días de Espera:</label>
                                  <input 
                                     type="number" 
                                     className="w-20 p-1 border border-orange-300 rounded bg-white font-bold text-center text-orange-900"
                                     value={clientForm.redirectionWaitDays}
                                     onChange={e => setClientForm({...clientForm, redirectionWaitDays: e.target.value})}
                                  />
                               </div>
                            </div>
                         ) : (
                            <div className="mt-3 animate-in slide-in-from-top-2">
                               <label className="block text-xs font-bold text-green-800 uppercase mb-1">Cuenta de Origen</label>
                               <select 
                                  className="w-full p-2 border border-green-300 bg-white text-slate-900 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                  value={clientForm.initialBankId}
                                  onChange={e => setClientForm({...clientForm, initialBankId: e.target.value})}
                               >
                                  {bankAccounts.length > 0 ? (
                                     bankAccounts.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} - ({formatCurrency(b.balance)})</option>
                                     ))
                                  ) : (
                                     <option value="">-- No hay cuentas --</option>
                                  )}
                               </select>
                            </div>
                         )}
                     </div>
                 </div>
              </div>
          )}

           <div className="pt-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas / Observaciones</label>
              <textarea className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 text-sm" value={clientForm.notes} onChange={e => setClientForm({...clientForm, notes: e.target.value})}></textarea>
           </div>
         </div>

         {/* FOOTER */}
         <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
            <button 
               type="submit" 
               disabled={cardStatus?.status === 'TAKEN'}
               className={`flex-1 py-3 font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2
                  ${cardStatus?.status === 'TAKEN' ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
               `}
            >
              <Save size={18}/> {editingClient ? 'Guardar' : 'Crear'}
            </button>
         </div>
       </form>
    </div>
  );
};
