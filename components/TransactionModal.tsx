
import React, { useState, useEffect, useMemo } from 'react';
import { Client, TransactionType, BankAccount, Transaction, TransactionFormInput } from '../types';
import { X, ArrowRightLeft, DollarSign, Calendar, Search, Landmark, AlertTriangle, TrendingUp, Paperclip, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { calculateLoanProjection } from '../services/loanUtils';
import { formatNumberWithDots, parseCurrency, formatCurrency } from '../utils/format';
import { compressImage } from '../utils/imageUtils';

interface TransactionModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSubmit: (data: TransactionFormInput, receiptFile?: File | null) => Promise<boolean>;
   activeClient: Client;
   allClients: Client[];
   bankAccounts: BankAccount[];
   initialMode?: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT';
   editingTransaction?: Transaction | null;
   clientTransactions?: Transaction[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
   isOpen, onClose, onSubmit, activeClient, allClients, bankAccounts, initialMode = 'PAYMENT', editingTransaction, clientTransactions = []
}) => {
   const [tab, setTab] = useState<'ENTRY' | 'EXIT'>('ENTRY');
   const [sourceType, setSourceType] = useState<'TREASURY' | 'REDIRECTION'>('TREASURY');
   const [redirectionWaitDays, setRedirectionWaitDays] = useState<string>('3');

   const [simRate, setSimRate] = useState<string>('');
   const [simTerm, setSimTerm] = useState<string>('');
   const [simFreq, setSimFreq] = useState<'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('MONTHLY');
   const [simType, setSimType] = useState<'FIXED' | 'DIMINISHING'>('FIXED');

   const [paymentMode, setPaymentMode] = useState<'QUOTA' | 'CUSTOM'>('QUOTA');
   const [isRedirectionEntry, setIsRedirectionEntry] = useState(false);

   const [isProcessing, setIsProcessing] = useState(false);
   const [isCompressing, setIsCompressing] = useState(false);

   const [amount, setAmount] = useState<string>('');
   const [interest, setInterest] = useState<string>('');
   const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
   const [nextPaymentDate, setNextPaymentDate] = useState<string>('');
   const [notes, setNotes] = useState('');

   const [receiptFile, setReceiptFile] = useState<File | null>(null);
   const [receiptPreview, setReceiptPreview] = useState<string>('');
   const [existingReceiptUrl, setExistingReceiptUrl] = useState<string>('');

   const [newCardCode, setNewCardCode] = useState('');
   const [targetClientId, setTargetClientId] = useState<string>('');
   const [targetSearch, setTargetSearch] = useState('');
   const [isTargetSearchFocused, setIsTargetSearchFocused] = useState(false);
   const [selectedBankId, setSelectedBankId] = useState<string>('');

   // --- DERIVED DATA ---
   const currentDebt = useMemo(() => {
      if (clientTransactions.length === 0) return 0;
      return clientTransactions[clientTransactions.length - 1].balanceAfter;
   }, [clientTransactions]);

   const isRefinance = currentDebt > 0 && tab === 'EXIT';

   const entryCalc = useMemo(() => {
      if (!activeClient || tab !== 'ENTRY') return { capital: 0, interest: 0, total: 0 };

      const rate = (activeClient.interestRate || 0) / 100;
      let freqDiv = 1;
      if (activeClient.paymentFrequency === 'BIWEEKLY') freqDiv = 2;
      if (activeClient.paymentFrequency === 'WEEKLY') freqDiv = 4;
      if (activeClient.paymentFrequency === 'DAILY') freqDiv = 30;

      const periodicRate = rate / freqDiv;
      const calculatedInterest = Math.round(currentDebt * periodicRate);
      const quota = activeClient.installmentAmount || 0;
      let calculatedCapital = 0;

      if (quota > 0) {
         calculatedCapital = Math.max(0, quota - calculatedInterest);
      }

      return {
         capital: calculatedCapital,
         interest: calculatedInterest,
         total: calculatedCapital + calculatedInterest,
      };
   }, [activeClient, currentDebt, tab]);

   const exitSimulation = useMemo(() => {
      const newMoney = parseCurrency(amount);
      const totalNewDebt = isRefinance ? currentDebt + newMoney : newMoney;

      const projection = calculateLoanProjection({
         initialAmount: totalNewDebt.toString(),
         interestRate: simRate,
         loanTermMonths: simTerm,
         paymentFrequency: simFreq,
         interestType: simType
      });

      return {
         totalNewDebt,
         newQuota: projection?.quota || 0,
         totalInterest: projection?.totalInterest || 0
      };
   }, [amount, currentDebt, isRefinance, simRate, simTerm, simFreq, simType]);


   useEffect(() => {
      if (isOpen && activeClient) {
         if (editingTransaction) {
            setAmount(editingTransaction.amount.toString());
            setInterest(editingTransaction.interestPaid ? editingTransaction.interestPaid.toString() : '');
            setDate(editingTransaction.date);
            setNotes(editingTransaction.notes || '');
            setNextPaymentDate(activeClient.nextPaymentDate || '');
            setExistingReceiptUrl(editingTransaction.receiptUrl || '');
            setReceiptPreview(editingTransaction.receiptUrl || '');
            setReceiptFile(null);
            setPaymentMode('CUSTOM');

            if (editingTransaction.type === TransactionType.DISBURSEMENT || editingTransaction.type === TransactionType.REFINANCE) {
               setTab('EXIT');
               if (!editingTransaction.bankAccountId) {
                  setSourceType('REDIRECTION');
               } else {
                  setSourceType('TREASURY');
                  setSelectedBankId(editingTransaction.bankAccountId);
               }
            } else {
               setTab('ENTRY');
               if (editingTransaction.type === TransactionType.REDIRECT_OUT) {
                  setIsRedirectionEntry(true);
                  if (editingTransaction.relatedClientId) setTargetClientId(editingTransaction.relatedClientId);
               } else {
                  setIsRedirectionEntry(false);
                  if (editingTransaction.bankAccountId) setSelectedBankId(editingTransaction.bankAccountId);
               }
            }

         } else {
            setNotes('');
            setTargetClientId('');
            setTargetSearch('');
            setReceiptFile(null);
            setReceiptPreview('');
            setExistingReceiptUrl('');

            setSelectedBankId(bankAccounts.length > 0 ? bankAccounts[0].id : '');
            setNewCardCode(activeClient.cardCode);

            setSimRate(activeClient.interestRate ? activeClient.interestRate.toString() : '10');
            setSimTerm(activeClient.loanTermMonths ? activeClient.loanTermMonths.toString() : '1');
            setSimFreq(activeClient.paymentFrequency || 'MONTHLY');
            setSimType(activeClient.interestType || 'FIXED');

            if (activeClient.pendingRedirectionBalance && activeClient.pendingRedirectionBalance > 0) {
               setAmount(activeClient.pendingRedirectionBalance.toString());
            } else {
               setAmount('');
            }

            if (activeClient.redirectionWaitDays) {
               setRedirectionWaitDays(activeClient.redirectionWaitDays.toString());
            }

            if (initialMode === 'DISBURSEMENT') {
               setTab('EXIT');
               setSourceType('TREASURY');
            } else if (initialMode === 'REDIRECT') {
               setTab('ENTRY');
               setIsRedirectionEntry(true);
               setPaymentMode('QUOTA');
            } else {
               setTab('ENTRY');
               setIsRedirectionEntry(false);
               setPaymentMode('QUOTA');
            }

            const d = new Date();
            d.setDate(d.getDate() + 30);
            setNextPaymentDate(d.toISOString().split('T')[0]);
         }
      }
   }, [isOpen, bankAccounts, initialMode, activeClient, editingTransaction]);

   useEffect(() => {
      if (isOpen && !editingTransaction && tab === 'ENTRY' && paymentMode === 'QUOTA' && entryCalc.total > 0) {
         setAmount(entryCalc.capital.toString());
         setInterest(entryCalc.interest.toString());
      }
   }, [isOpen, paymentMode, entryCalc, tab, editingTransaction]);

   const filteredTargets = useMemo(() => {
      if (!activeClient || (!targetSearch && !isTargetSearchFocused)) return [];
      const q = targetSearch.toLowerCase();

      const candidates = allClients.filter(c =>
         c.id !== activeClient.id &&
         c.status === 'ACTIVE' &&
         (c.name.toLowerCase().includes(q) || c.cedula.includes(q))
      );

      return candidates.sort((a, b) => {
         const aWaiting = (a.pendingRedirectionBalance || 0) > 0;
         const bWaiting = (b.pendingRedirectionBalance || 0) > 0;
         if (aWaiting && !bWaiting) return -1;
         if (!aWaiting && bWaiting) return 1;
         return 0;
      }).slice(0, 10);
   }, [allClients, activeClient, targetSearch, isTargetSearchFocused]);

   const selectedTarget = useMemo(() => allClients.find(c => c.id === targetClientId), [allClients, targetClientId]);
   const selectedBank = useMemo(() => bankAccounts.find(b => b.id === selectedBankId), [bankAccounts, selectedBankId]);

   const getTransactionType = () => {
      if (editingTransaction) return editingTransaction.type;
      if (tab === 'ENTRY') {
         if (isRedirectionEntry) return TransactionType.REDIRECT_OUT;
         return TransactionType.PAYMENT_CAPITAL;
      } else {
         return isRefinance ? TransactionType.REFINANCE : TransactionType.DISBURSEMENT;
      }
   };

   const parsedAmount = parseCurrency(amount);
   const parsedInterest = parseCurrency(interest);

   const insufficientFunds = !editingTransaction && (tab === 'EXIT') && sourceType === 'TREASURY' && selectedBank && selectedBank.balance < parsedAmount;

   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const file = e.target.files[0];
         setIsCompressing(true);
         try {
            const compressed = await compressImage(file);
            setReceiptFile(compressed);
            setReceiptPreview(URL.createObjectURL(compressed));
         } catch (err) {
            setReceiptFile(file);
            setReceiptPreview(URL.createObjectURL(file));
         } finally {
            setIsCompressing(false);
         }
      }
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (insufficientFunds) return;
      // VALIDATION
      if (!parsedAmount && !parsedInterest) return;

      setIsProcessing(true);

      let clientUpdates: any = {};
      if (tab === 'EXIT') {
         clientUpdates = {
            interestRate: parseFloat(simRate),
            loanTermMonths: parseInt(simTerm),
            paymentFrequency: simFreq,
            interestType: simType,
            redirectionWaitDays: sourceType === 'REDIRECTION' ? parseInt(redirectionWaitDays) : undefined,
            installmentAmount: exitSimulation.newQuota,
            installmentsCount: calculateLoanProjection({
               initialAmount: exitSimulation.totalNewDebt.toString(),
               interestRate: simRate,
               loanTermMonths: simTerm,
               paymentFrequency: simFreq,
               interestType: simType
            })?.totalInstallments
         };
         if (activeClient.pendingRedirectionBalance && activeClient.pendingRedirectionBalance > 0) {
            clientUpdates.pendingRedirectionBalance = 0;
         }
      }

      const isRedirection = (tab === 'ENTRY' && isRedirectionEntry) || (tab === 'EXIT' && sourceType === 'REDIRECTION');
      const bankIdToSend = !isRedirection && selectedBankId ? selectedBankId : undefined;

      await onSubmit({
         type: getTransactionType() as TransactionType,
         amount: parsedAmount || 0,
         interest: parsedInterest || 0,
         date,
         nextPaymentDate,
         notes,
         targetClientId: (tab === 'ENTRY' && isRedirectionEntry) ? targetClientId : undefined,
         bankAccountId: bankIdToSend,
         newCardCode: (tab === 'EXIT') ? newCardCode : undefined,
         receiptUrl: existingReceiptUrl,
         ...clientUpdates
      }, receiptFile);

      setIsProcessing(false);
      onClose();
   };

   if (!isOpen || !activeClient) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 transition-opacity duration-300">
         <div
            className="bg-white rounded-t-[32px] md:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[92vh] md:h-auto md:max-h-[95vh] animate-in slide-in-from-bottom duration-300 md:animate-none"
            style={{ paddingBottom: 'var(--safe-area-bottom)' }}
         >
            {/* MOBILE DRAG HANDLE */}
            <div className="md:hidden flex justify-center pt-3 pb-1 bg-slate-900 shrink-0">
               <div className="w-12 h-1.5 bg-slate-700 rounded-full opacity-50"></div>
            </div>

            <div className="bg-slate-900 pt-2 md:pt-4 px-5 pb-0 text-white flex flex-col gap-4 shrink-0">
               <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg md:text-xl flex items-center gap-2">
                     {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
                  </h3>
                  <button
                     onClick={onClose}
                     className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
                  >
                     <X size={20} />
                  </button>
               </div>

               {!editingTransaction && (
                  <div className="flex gap-1 p-0.5 bg-slate-800 rounded-xl">
                     <button
                        onClick={() => { setTab('ENTRY'); setIsRedirectionEntry(false); setPaymentMode('QUOTA'); }}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${tab === 'ENTRY' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                     >
                        <DollarSign size={16} /> Cobrar
                     </button>
                     <button
                        onClick={() => { setTab('EXIT'); setSourceType('TREASURY'); }}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${tab === 'EXIT' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                     >
                        <TrendingUp size={16} /> Prestar
                     </button>
                  </div>
               )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5 overflow-y-auto bg-slate-50 flex-1 scrollbar-thin">

               {tab === 'EXIT' && (
                  <div className="space-y-6">
                     <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Origen de los Fondos</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
                           <button
                              type="button"
                              onClick={() => setSourceType('TREASURY')}
                              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all
                            ${sourceType === 'TREASURY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                         `}
                           >
                              <Landmark size={16} /> Tesorería / Caja
                           </button>
                           <button
                              type="button"
                              onClick={() => setSourceType('REDIRECTION')}
                              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all
                            ${sourceType === 'REDIRECTION' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
                         `}
                           >
                              <ArrowRightLeft size={16} /> Redirección
                           </button>
                        </div>

                        {sourceType === 'TREASURY' ? (
                           <div>
                              <select
                                 required
                                 value={selectedBankId}
                                 onChange={e => setSelectedBankId(e.target.value)}
                                 className="w-full p-2 border border-slate-300 rounded bg-slate-50 font-medium text-slate-900 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                 {bankAccounts.length > 0 ? (
                                    bankAccounts.map(b => (
                                       <option key={b.id} value={b.id}>{b.name} - (Saldo: {formatCurrency(b.balance)})</option>
                                    ))
                                 ) : (
                                    <option value="">-- No hay cuentas creadas --</option>
                                 )}
                              </select>
                              {insufficientFunds && (
                                 <div className="flex items-center gap-2 text-red-600 text-xs font-bold mt-2 animate-pulse bg-red-50 p-2 rounded border border-red-200">
                                    <AlertTriangle size={14} /> FONDOS INSUFICIENTES
                                 </div>
                              )}
                           </div>
                        ) : (
                           <div className="bg-orange-50 p-3 rounded border border-orange-200 flex items-center gap-4">
                              <div className="flex-1">
                                 <label className="text-[10px] font-bold text-orange-800 uppercase block mb-1">Días de Espera (Gabela)</label>
                                 <input
                                    type="number"
                                    className="w-full p-2 border border-orange-300 rounded bg-white text-slate-900 font-bold outline-none text-center"
                                    value={redirectionWaitDays}
                                    onChange={e => setRedirectionWaitDays(e.target.value)}
                                 />
                              </div>
                           </div>
                        )}
                     </div>

                     <div>
                        <label className="text-xs font-bold text-blue-700 uppercase block mb-1">
                           {isRefinance ? 'Monto Adicional a Prestar' : 'Monto a Prestar'}
                        </label>
                        <div className="relative">
                           <span className="absolute left-3 top-3.5 text-blue-500 font-bold text-lg">$</span>
                           <input
                              autoFocus
                              type="text"
                              placeholder="0"
                              value={formatNumberWithDots(amount)}
                              onChange={e => setAmount(e.target.value)}
                              className="w-full pl-8 pr-3 py-3 text-2xl font-bold border border-blue-200 bg-blue-50/30 text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tasa %</label>
                           <input
                              type="number"
                              value={simRate}
                              onChange={e => setSimRate(e.target.value)}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-center font-bold text-sm"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Plazo (Meses)</label>
                           <input
                              type="number"
                              value={simTerm}
                              onChange={e => setSimTerm(e.target.value)}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-center font-bold text-sm"
                           />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Frecuencia</label>
                           <select
                              value={simFreq}
                              onChange={e => setSimFreq(e.target.value as any)}
                              className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 font-bold text-sm"
                           >
                              <option value="DAILY">Diario</option>
                              <option value="WEEKLY">Semanal</option>
                              <option value="BIWEEKLY">Quincenal</option>
                              <option value="MONTHLY">Mensual</option>
                           </select>
                        </div>
                     </div>
                  </div>
               )}

               {tab === 'ENTRY' && (
                  <div className="space-y-5">
                     <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                           <button
                              type="button"
                              onClick={() => setIsRedirectionEntry(false)}
                              className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${!isRedirectionEntry ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              <Landmark size={14} /> Efectivo / Banco
                           </button>
                           <button
                              type="button"
                              onClick={() => setIsRedirectionEntry(true)}
                              className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${isRedirectionEntry ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              <ArrowRightLeft size={14} /> Redirección
                           </button>
                        </div>

                        {!isRedirectionEntry ? (
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cuenta de Destino</label>
                              <select
                                 required
                                 value={selectedBankId}
                                 onChange={e => setSelectedBankId(e.target.value)}
                                 className="w-full p-2 border border-slate-300 rounded bg-white font-medium text-slate-900 text-sm"
                              >
                                 {bankAccounts.length > 0 ? (
                                    bankAccounts.map(b => (
                                       <option key={b.id} value={b.id}>{b.name} - (Saldo: {formatCurrency(b.balance)})</option>
                                    ))
                                 ) : (
                                    <option value="">-- No hay cuentas creadas --</option>
                                 )}
                              </select>
                           </div>
                        ) : (
                           <div className="bg-orange-50 p-3 rounded border border-orange-200">
                              <label className="text-xs font-bold text-orange-800 uppercase block mb-1">¿A quién le prestas este dinero?</label>
                              {!selectedTarget ? (
                                 <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                    <input
                                       type="text"
                                       placeholder="Buscar Cliente..."
                                       value={targetSearch}
                                       onChange={e => setTargetSearch(e.target.value)}
                                       onFocus={() => setIsTargetSearchFocused(true)}
                                       onBlur={() => setTimeout(() => setIsTargetSearchFocused(false), 200)}
                                       className="w-full pl-9 p-2 border border-orange-300 rounded bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                    {(isTargetSearchFocused || targetSearch) && filteredTargets.length > 0 && (
                                       <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-b-lg mt-1 z-50 max-h-56 overflow-y-auto">
                                          {filteredTargets.map(c => (
                                             <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => { setTargetClientId(c.id); setTargetSearch(''); }}
                                                className="w-full text-left p-2 hover:bg-slate-50 text-sm flex justify-between items-center"
                                             >
                                                <div>
                                                   <div className="font-bold text-slate-800">{c.name}</div>
                                                </div>
                                             </button>
                                          )
                                          )}
                                       </div>
                                    )}
                                 </div>
                              ) : (
                                 <div className="flex justify-between items-center bg-white p-2 rounded border border-orange-200">
                                    <span className="font-bold text-sm text-slate-900">{selectedTarget.name}</span>
                                    <button type="button" onClick={() => setTargetClientId('')} className="text-xs text-red-500 font-bold hover:underline">Cambiar</button>
                                 </div>
                              )}
                           </div>
                        )}
                     </div>

                     <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-500">Abono Capital</label>
                              <input
                                 type="text"
                                 value={formatNumberWithDots(amount)}
                                 onChange={e => setAmount(e.target.value)}
                                 className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500"
                              />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-500">Pago Intereses</label>
                              <input
                                 type="text"
                                 value={formatNumberWithDots(interest)}
                                 onChange={e => setInterest(e.target.value)}
                                 className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded font-bold outline-none focus:ring-2 focus:ring-blue-500"
                              />
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                     <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                           type="date"
                           required
                           value={date}
                           onChange={e => setDate(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg outline-none font-medium text-sm"
                        />
                     </div>
                  </div>

                  <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Próximo Pago</label>
                     <input
                        type="date"
                        value={nextPaymentDate}
                        onChange={e => setNextPaymentDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-lg outline-none font-medium text-sm"
                     />
                  </div>
               </div>

               <div className={`bg-white p-3 rounded-xl border border-dashed transition-colors ${receiptPreview ? 'border-green-400 bg-green-50/30' : 'border-slate-300 hover:border-blue-400'}`}>
                  <div className="flex items-center gap-4">
                     {isCompressing ? (
                        <Loader2 size={16} className="animate-spin text-blue-500" />
                     ) : receiptPreview ? (
                        <div className="relative w-10 h-10 shrink-0 group">
                           <img src={receiptPreview} alt="Preview" className="w-full h-full object-cover rounded-lg shadow-sm" />
                           <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(''); setExistingReceiptUrl(''); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={8} /></button>
                        </div>
                     ) : (
                        <ImageIcon size={16} className="text-slate-300" />
                     )}

                     <div className="flex-1">
                        <input type="file" id="fileUpload" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <label htmlFor="fileUpload" className="cursor-pointer text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                           <Paperclip size={12} /> {receiptPreview ? 'Cambiar Soporte' : 'Adjuntar Comprobante'}
                        </label>
                     </div>
                  </div>
               </div>

               <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 bg-white text-slate-900 rounded-lg outline-none text-sm"
                  placeholder="Observaciones..."
               />

            </form>

            <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0">
               <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200">
                  Cancelar
               </button>
               <button
                  onClick={handleSubmit}
                  disabled={isProcessing || isCompressing || (tab === 'EXIT' && insufficientFunds)}
                  className={`flex-1 py-3 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2
                 ${tab === 'ENTRY' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                 disabled:opacity-50 disabled:cursor-not-allowed`}
               >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> Confirmar</>}
               </button>
            </div>
         </div>
      </div>
   );
};
