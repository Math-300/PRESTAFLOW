
import React, { useState } from 'react';
import { BankAccount, Transaction } from '../types';
import { Landmark, Plus, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard, History, Paperclip, Loader2, Image as ImageIcon, X, DollarSign, Calendar } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

interface BankDashboardProps {
  accounts: BankAccount[];
  transactions: Transaction[];
  onAddAccount: (acc: BankAccount) => void;
  onInternalMovement: (accountId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAWAL', note: string, receiptFile?: File | null) => void; // Updated signature
}

const formatNumberWithDots = (value: string | number) => {
  if (value === '' || value === undefined || value === null) return '';
  const numStr = value.toString().replace(/\D/g, '');
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseCurrency = (value: string) => {
  if (!value) return 0;
  return Number(value.replace(/\./g, ''));
};

export const BankDashboard: React.FC<BankDashboardProps> = ({ accounts, transactions, onAddAccount, onInternalMovement }) => {
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
    <div className="h-full overflow-y-auto p-2">
      {/* ... HEADER ... */}
      <div className="mb-6 bg-slate-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold flex items-center gap-2">
             <Landmark className="text-yellow-400"/> Tesorería General
           </h2>
           <p className="text-slate-400 text-sm">Gestión de liquidez y cuentas bancarias</p>
        </div>
        <div className="text-right">
           <div className="text-xs text-slate-400 uppercase font-bold">Liquidez Total</div>
           <div className="text-3xl font-bold text-green-400">{formatCurrency(totalLiquidity)}</div>
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
                  {acc.isCash ? <Wallet className="text-green-500 opacity-20" size={32}/> : <CreditCard className="text-blue-600 opacity-20" size={32}/>}
               </div>
               
               <div className="text-2xl font-bold text-slate-900 mb-6">
                 {formatCurrency(acc.balance)}
               </div>

               <div className="mt-auto grid grid-cols-3 gap-2">
                 <button 
                   onClick={() => { setActiveAccountId(acc.id); setMovementForm(p => ({ ...p, type: 'DEPOSIT' })); }}
                   className="bg-green-50 text-green-700 hover:bg-green-100 py-2 rounded text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-colors"
                 >
                   <ArrowDownLeft size={14}/> Ingreso
                 </button>
                 <button 
                   onClick={() => { setActiveAccountId(acc.id); setMovementForm(p => ({ ...p, type: 'WITHDRAWAL' })); }}
                   className="bg-red-50 text-red-700 hover:bg-red-100 py-2 rounded text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-colors"
                 >
                   <ArrowUpRight size={14}/> Retiro
                 </button>
                 <button 
                   onClick={() => setHistoryAccountId(acc.id)}
                   className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-2 rounded text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-colors"
                 >
                   <History size={14}/> Historial
                 </button>
               </div>
            </div>
          </div>
        ))}

        <button 
          onClick={() => setShowAddModal(true)}
          className="border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors bg-slate-50 min-h-[220px]"
        >
          <Plus size={40} className="mb-2"/>
          <span className="font-bold">Nueva Cuenta</span>
        </button>
      </div>

      {/* Internal Movement Modal */}
      {activeAccountId && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 overflow-hidden animate-in zoom-in-95 duration-200">
               <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                 {movementForm.type === 'DEPOSIT' ? <ArrowDownLeft className="text-green-600"/> : <ArrowUpRight className="text-red-600"/>}
                 {movementForm.type === 'DEPOSIT' ? 'Registrar Ingreso' : 'Registrar Retiro'}
               </h3>
               <form onSubmit={handleMovementSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                    <div className="relative">
                        <span className="absolute left-2 top-2 text-slate-400">$</span>
                        <input 
                           autoFocus 
                           required 
                           type="text" 
                           className="w-full border border-slate-300 bg-white text-slate-900 p-2 pl-6 rounded text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                           value={formatNumberWithDots(movementForm.amount)} 
                           onChange={e => setMovementForm({...movementForm, amount: e.target.value})} 
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo / Nota</label>
                    <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Inyección capital, Gastos..." value={movementForm.note} onChange={e => setMovementForm({...movementForm, note: e.target.value})} />
                  </div>

                  {/* FILE UPLOAD WITH PREVIEW */}
                  <div className={`bg-slate-50 border border-dashed rounded-lg p-3 ${movementPreview ? 'border-green-400' : 'border-slate-300'}`}>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1 cursor-pointer">
                        <Paperclip size={12}/> Soporte (Opcional)
                     </label>
                     
                     <div className="flex items-center gap-3">
                        {isCompressing ? (
                            <Loader2 size={24} className="animate-spin text-blue-500"/>
                        ) : movementPreview ? (
                           <div className="relative group shrink-0">
                              <img src={movementPreview} alt="Preview" className="w-12 h-12 rounded object-cover border border-slate-200" />
                              <button 
                                 type="button"
                                 onClick={() => { setMovementFile(null); setMovementPreview(''); }}
                                 className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                 <Plus size={10} className="rotate-45"/>
                              </button>
                           </div>
                        ) : (
                           <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                              <ImageIcon size={20}/>
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

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => { setActiveAccountId(null); setMovementFile(null); setMovementPreview(''); }} className="flex-1 bg-slate-100 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                    <button 
                       type="submit" 
                       disabled={isCompressing}
                       className={`flex-1 py-2 rounded-lg font-bold text-white shadow-lg transition-colors flex items-center justify-center gap-2 ${movementForm.type === 'DEPOSIT' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                       Confirmar
                    </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* History Modal (Unchanged logic, just keeping for context if needed, but not modifying content heavily) */}
      {historyAccountId && activeAccountDetails && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                       <History size={18}/> Historial de Movimientos
                    </h3>
                    <p className="text-xs text-slate-400">{activeAccountDetails.name}</p>
                  </div>
                  <button onClick={() => setHistoryAccountId(null)} className="hover:bg-slate-800 p-1 rounded"><X size={20}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {activeAccountHistory.length === 0 ? (
                     <div className="text-center text-slate-400 py-10">No hay movimientos registrados en esta cuenta.</div>
                  ) : (
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-200">
                              <th className="pb-2">Fecha</th>
                              <th className="pb-2">Descripción</th>
                              <th className="pb-2 text-right">Monto</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {activeAccountHistory.map(t => {
                              let isNegative = false;
                              if (['DISBURSEMENT', 'REFINANCE', 'BANK_WITHDRAWAL'].includes(t.type)) {
                                 isNegative = true;
                              }

                              return (
                                 <tr key={t.id} className="text-sm">
                                    <td className="py-3 text-slate-500 font-mono text-xs">{t.date}</td>
                                    <td className="py-3 text-slate-700">
                                       <div className="font-bold text-xs">{t.type}</div>
                                       <div className="text-xs text-slate-500">{t.notes}</div>
                                    </td>
                                    <td className={`py-3 text-right font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                       {isNegative ? '-' : '+'}{formatCurrency(t.amount)}
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
             <h3 className="font-bold text-lg text-slate-800">Agregar Nueva Cuenta</h3>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Entidad / Caja</label>
               <input required type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Bancolombia Principal" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Cuenta</label>
               <input type="text" className="w-full border border-slate-300 bg-white text-slate-900 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="XXXX-XXXX" value={newAccount.accountNumber} onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saldo Inicial</label>
               <div className="relative">
                 <span className="absolute left-2 top-2 text-slate-400">$</span>
                 <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 bg-white text-slate-900 p-2 pl-6 rounded font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="0" 
                    value={formatNumberWithDots(newAccount.initialBalance)} 
                    onChange={e => setNewAccount({...newAccount, initialBalance: e.target.value})} 
                 />
               </div>
             </div>
             <div className="flex items-center gap-2">
                <input type="checkbox" id="isCash" checked={newAccount.isCash} onChange={e => setNewAccount({...newAccount, isCash: e.target.checked})} />
                <label htmlFor="isCash" className="text-sm text-slate-700">Es efectivo / Caja fuerte</label>
             </div>
             <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 py-2 rounded font-bold text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-900 py-2 rounded font-bold text-white">Crear Cuenta</button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};
