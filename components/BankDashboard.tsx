
import React, { useState } from 'react';
import { BankAccount, Transaction } from '../types';
import { Landmark, Plus, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard, History, Paperclip, Loader2, Image as ImageIcon, X, DollarSign, Calendar, Lock } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { compressImage } from '../utils/imageUtils';

interface BankDashboardProps {
   accounts: BankAccount[];
   transactions: Transaction[];
   onAddAccount: (acc: BankAccount) => void;
   onInternalMovement: (accountId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAWAL', note: string, receiptFile?: File | null) => void;
   onRefresh?: () => Promise<void>;
}

import { PullToRefresh } from './ui/PullToRefresh';

const formatNumberWithDots = (value: string | number) => {
   if (value === '' || value === undefined || value === null) return '';
   const numStr = value.toString().replace(/\D/g, '');
   return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseCurrency = (value: string) => {
   if (!value) return 0;
   return Number(value.replace(/\./g, ''));
};

export const BankDashboard: React.FC<BankDashboardProps> = ({ accounts, transactions, onAddAccount, onInternalMovement, onRefresh }) => {
   const { can } = useOrganization();
   const [showAddModal, setShowAddModal] = useState(false);
   const [newAccount, setNewAccount] = useState({ name: '', accountNumber: '', isCash: false, initialBalance: '' });

   // Movement State
   const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
   const [movementForm, setMovementForm] = useState({ type: 'DEPOSIT', amount: '', note: '' });
   const [movementFile, setMovementFile] = useState<File | null>(null);
   const [movementPreview, setMovementPreview] = useState<string>('');
   const [isCompressing, setIsCompressing] = useState(false);

   // History State
   const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);

   const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);
   };

   const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      onAddAccount({
         id: Math.random().toString(36).substr(2, 9),
         name: newAccount.name,
         accountNumber: newAccount.accountNumber,
         isCash: newAccount.isCash,
         balance: parseCurrency(newAccount.initialBalance) || 0
      });
      setShowAddModal(false);
      setNewAccount({ name: '', accountNumber: '', isCash: false, initialBalance: '' });
   };

   const handleMovementSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeAccountId || isCompressing) return;

      onInternalMovement(
         activeAccountId,
         parseCurrency(movementForm.amount),
         movementForm.type as 'DEPOSIT' | 'WITHDRAWAL',
         movementForm.note,
         movementFile
      );

      // Reset
      setActiveAccountId(null);
      setMovementForm({ type: 'DEPOSIT', amount: '', note: '' });
      setMovementFile(null);
      setMovementPreview('');
   };

   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
         const file = e.target.files[0];
         setIsCompressing(true);
         try {
            const compressed = await compressImage(file);
            setMovementFile(compressed);
            setMovementPreview(URL.createObjectURL(compressed));
         } catch (err) {
            setMovementFile(file);
            setMovementPreview(URL.createObjectURL(file));
         } finally {
            setIsCompressing(false);
         }
      }
   };

   const totalLiquidity = accounts.reduce((sum, acc) => sum + acc.balance, 0);

   // Filter transactions for history view
   const activeAccountHistory = historyAccountId
      ? transactions.filter(t => t.bankAccountId === historyAccountId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : [];

   const activeAccountDetails = accounts.find(a => a.id === historyAccountId);

   return (
      <PullToRefresh onRefresh={onRefresh || (async () => { })}>
         <div className="h-full overflow-y-auto p-2 pb-28 md:pb-2">
            {/* ... HEADER ... */}
            <div className="mb-6 bg-slate-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center" style={{ paddingTop: 'calc(1.5rem + var(--safe-area-top))' }}>
               <div>
                  <h2 className="text-xl md:text-2xl font-black flex items-center gap-2">
                     <Landmark className="text-yellow-400" /> Tesorería
                  </h2>
                  <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-wider">Liquidez General</p>
               </div>
               <div className="text-right">
                  <div className="text-2xl md:text-3xl font-black text-green-400">{formatCurrency(totalLiquidity)}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
               {accounts.map(acc => (
                  <div key={acc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative group hover:shadow-md transition-shadow flex flex-col">
                     <div className={`h-2 w-full ${acc.isCash ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                     <div className="p-5 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <h3 className="font-bold text-lg text-slate-800">{acc.name}</h3>
                              <p className="text-xs text-slate-500 font-mono">{acc.accountNumber}</p>
                           </div>
                           {acc.isCash ? <Wallet className="text-green-500 opacity-20" size={32} /> : <CreditCard className="text-blue-600 opacity-20" size={32} />}
                        </div>

                        <div className="text-2xl font-bold text-slate-900 mb-6">
                           {formatCurrency(acc.balance)}
                        </div>

                        <div className="mt-auto flex flex-col gap-2">
                           {can('manage_banks') ? (
                              <div className="grid grid-cols-2 gap-2">
                                 <button
                                    onClick={() => { setActiveAccountId(acc.id); setMovementForm(p => ({ ...p, type: 'DEPOSIT' })); }}
                                    className="bg-green-600 text-white hover:bg-green-700 py-3 md:py-2 rounded-xl md:rounded text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95 transition-transform"
                                 >
                                    <ArrowDownLeft size={16} /> Ingreso
                                 </button>
                                 <button
                                    onClick={() => { setActiveAccountId(acc.id); setMovementForm(p => ({ ...p, type: 'WITHDRAWAL' })); }}
                                    className="bg-red-500 text-white hover:bg-red-600 py-3 md:py-2 rounded-xl md:rounded text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95 transition-transform"
                                 >
                                    <ArrowUpRight size={16} /> Retiro
                                 </button>
                              </div>
                           ) : (
                              <div className="bg-slate-50 text-slate-400 py-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border border-slate-100 italic">
                                 <Lock size={12} /> Bloqueado (Sin permisos)
                              </div>
                           )}
                           <button
                              onClick={() => setHistoryAccountId(acc.id)}
                              className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 md:py-2 rounded-xl md:rounded text-xs font-black flex items-center justify-center gap-2 transition-colors"
                           >
                              <History size={16} /> Ver Movimientos
                           </button>
                        </div>
                     </div>
                  </div>
               ))}

               {can('manage_banks') && (
                  <button
                     onClick={() => setShowAddModal(true)}
                     className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors bg-slate-50 min-h-[220px]"
                  >
                     <Plus size={40} className="mb-2" />
                     <span className="font-bold">Nueva Cuenta</span>
                  </button>
               )}
            </div>

            {/* Internal Movement Modal */}
            {activeAccountId && (
               <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
                  <div
                     className="bg-white rounded-t-[32px] md:rounded-xl shadow-2xl w-full max-w-sm p-6 overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-none"
                     style={{ paddingBottom: 'var(--safe-area-bottom)' }}
                  >
                     {/* MOBILE DRAG HANDLE */}
                     <div className="md:hidden flex justify-center pb-4 opacity-30">
                        <div className="w-10 h-1 bg-slate-400 rounded-full"></div>
                     </div>
                     <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                        {movementForm.type === 'DEPOSIT' ? <ArrowDownLeft className="text-green-600" /> : <ArrowUpRight className="text-red-600" />}
                        {movementForm.type === 'DEPOSIT' ? 'Registrar Ingreso' : 'Registrar Retiro'}
                     </h3>
                     <form onSubmit={handleMovementSubmit} className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                           <div className="relative">
                              <span className="absolute left-3 top-3.5 text-slate-400 font-black text-lg">$</span>
                              <input
                                 autoFocus
                                 required
                                 type="text"
                                 inputMode="decimal"
                                 className="w-full border border-slate-300 bg-white text-slate-900 p-3 pl-8 rounded-2xl text-xl font-black outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                 value={formatNumberWithDots(movementForm.amount)}
                                 onChange={e => setMovementForm({ ...movementForm, amount: e.target.value })}
                              />
                           </div>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo / Nota</label>
                           <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium" placeholder="Ej: Inyección capital, Gastos..." value={movementForm.note} onChange={e => setMovementForm({ ...movementForm, note: e.target.value })} />
                        </div>

                        {/* FILE UPLOAD WITH PREVIEW */}
                        <div className={`bg-slate-50 border border-dashed rounded-lg p-3 ${movementPreview ? 'border-green-400' : 'border-slate-300'}`}>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1 cursor-pointer">
                              <Paperclip size={12} /> Soporte (Opcional)
                           </label>

                           <div className="flex items-center gap-3">
                              {isCompressing ? (
                                 <Loader2 size={24} className="animate-spin text-blue-500" />
                              ) : movementPreview ? (
                                 <div className="relative group shrink-0">
                                    <img src={movementPreview} alt="Preview" className="w-12 h-12 rounded object-cover border border-slate-200" />
                                    <button
                                       type="button"
                                       onClick={() => { setMovementFile(null); setMovementPreview(''); }}
                                       className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                       <Plus size={10} className="rotate-45" />
                                    </button>
                                 </div>
                              ) : (
                                 <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                    <ImageIcon size={20} />
                                 </div>
                              )}

                              <input
                                 type="file"
                                 accept="image/*"
                                 className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white file:text-blue-600 hover:file:bg-blue-50 cursor-pointer w-full"
                                 onChange={handleFileChange}
                              />
                           </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                           <button
                              type="submit"
                              disabled={isCompressing}
                              className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${movementForm.type === 'DEPOSIT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                           >
                              Confirmar {movementForm.type === 'DEPOSIT' ? 'Ingreso' : 'Retiro'}
                           </button>
                           <button type="button" onClick={() => { setActiveAccountId(null); setMovementFile(null); setMovementPreview(''); }} className="w-full bg-slate-100 py-3 rounded-2xl font-black text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                        </div>
                     </form>
                  </div>
               </div>
            )}

            {/* History Modal */}
            {historyAccountId && activeAccountDetails && (
               <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
                  <div
                     className="bg-white rounded-t-[32px] md:rounded-xl shadow-2xl w-full max-w-2xl h-[92vh] md:h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-none"
                     style={{ paddingBottom: 'var(--safe-area-bottom)' }}
                  >
                     {/* MOBILE DRAG HANDLE */}
                     <div className="md:hidden flex justify-center py-3 bg-slate-900 shrink-0 opacity-50">
                        <div className="w-10 h-1 bg-slate-600 rounded-full"></div>
                     </div>
                     <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                        <div>
                           <h3 className="font-bold flex items-center gap-2">
                              <History size={18} /> Historial de Movimientos
                           </h3>
                           <p className="text-xs text-slate-400">{activeAccountDetails.name}</p>
                        </div>
                        <button onClick={() => setHistoryAccountId(null)} className="hover:bg-slate-800 p-1 rounded"><X size={20} /></button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-0 md:p-4 bg-slate-50">
                        {activeAccountHistory.length === 0 ? (
                           <div className="text-center text-slate-400 py-10 font-bold uppercase tracking-widest text-xs">No hay movimientos.</div>
                        ) : (
                           <div className="divide-y divide-slate-200">
                              {/* Desktop Header (visible only on md+) */}
                              <div className="hidden md:grid grid-cols-3 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 border-b border-slate-200">
                                 <span>Fecha</span>
                                 <span>Descripción</span>
                                 <span className="text-right">Monto</span>
                              </div>

                              {activeAccountHistory.map(t => {
                                 let isNegative = ['DISBURSEMENT', 'REFINANCE', 'BANK_WITHDRAWAL'].includes(t.type);
                                 return (
                                    <div key={t.id} className="grid grid-cols-2 md:grid-cols-3 gap-1 p-4 bg-white md:bg-transparent items-center active:bg-slate-50 transition-colors">
                                       <div className="flex flex-col">
                                          <div className="text-[10px] font-black text-slate-400 font-mono uppercase truncate">{t.date}</div>
                                          <div className="md:hidden text-[10px] font-black text-slate-300 font-mono truncate">#{t.id.substring(0, 8)}</div>
                                       </div>

                                       <div className="md:block order-3 md:order-2 col-span-2 md:col-span-1 mt-1 md:mt-0">
                                          <div className="font-black text-[11px] md:text-sm text-slate-700 uppercase tracking-tight">{t.type}</div>
                                          {t.notes && <div className="text-[10px] md:text-xs text-slate-500 italic font-medium truncate">"{t.notes}"</div>}
                                       </div>

                                       <div className={`text-right font-black text-base md:text-sm order-2 md:order-3 ${isNegative ? 'text-red-500' : 'text-green-600'}`}>
                                          {isNegative ? '-' : '+'}{formatCurrency(t.amount)}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {/* Add Account Modal */}
            {showAddModal && (
               <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
                  <form
                     onSubmit={handleCreate}
                     className="bg-white rounded-t-[32px] md:rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom duration-300 md:animate-none"
                     style={{ paddingBottom: 'var(--safe-area-bottom)' }}
                  >
                     {/* MOBILE DRAG HANDLE */}
                     <div className="md:hidden flex justify-center pb-2 opacity-30">
                        <div className="w-10 h-1 bg-slate-400 rounded-full"></div>
                     </div>
                     <h3 className="font-bold text-lg text-slate-800">Agregar Nueva Cuenta</h3>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Entidad / Caja</label>
                        <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-base font-medium transition-all" placeholder="Ej: Bancolombia Principal" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Cuenta</label>
                        <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-3 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-base font-mono transition-all" placeholder="XXXX-XXXX" value={newAccount.accountNumber} onChange={e => setNewAccount({ ...newAccount, accountNumber: e.target.value })} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo Inicial</label>
                        <div className="relative">
                           <span className="absolute left-3 top-3.5 text-slate-400 font-black text-lg">$</span>
                           <input
                              required
                              type="text"
                              inputMode="decimal"
                              className="w-full border border-slate-300 bg-white text-slate-900 p-3 pl-8 rounded-2xl font-black focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-xl transition-all"
                              placeholder="0"
                              value={formatNumberWithDots(newAccount.initialBalance)}
                              onChange={e => setNewAccount({ ...newAccount, initialBalance: e.target.value })}
                           />
                        </div>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <input type="checkbox" id="isCash" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={newAccount.isCash} onChange={e => setNewAccount({ ...newAccount, isCash: e.target.checked })} />
                        <label htmlFor="isCash" className="text-sm text-slate-700 font-bold uppercase tracking-tight">Es efectivo / Caja fuerte</label>
                     </div>
                     <div className="flex flex-col gap-2 pt-4">
                        <button type="submit" className="w-full bg-slate-900 py-4 rounded-2xl font-black text-white hover:bg-black transition-all shadow-lg active:scale-95">Crear Cuenta</button>
                        <button type="button" onClick={() => setShowAddModal(false)} className="w-full bg-slate-100 py-3 rounded-2xl font-black text-slate-500 hover:bg-slate-200 transition-colors">Cancelar</button>
                     </div>
                  </form>
               </div>
            )}
         </div>
      </PullToRefresh>
   );
};
