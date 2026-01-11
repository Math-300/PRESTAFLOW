
import React, { useState } from 'react';
import { Transaction, TransactionType, Client } from '../../types';
import { 
  Clock, DollarSign, ArrowUpRight, ArrowDownLeft, TrendingUp, 
  ArrowRightLeft, User, CheckCircle, Paperclip, Pencil, Trash2, 
  X, FileText, Calendar, CreditCard, Hash, Image as ImageIcon, ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface TransactionHistoryProps {
  transactions: Transaction[];
  allClients: Client[];
  onViewReceipt: (url: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (tx: Transaction) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ 
  transactions, allClients, onViewReceipt, onEditTransaction, onDeleteTransaction 
}) => {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const getRelatedClientName = (id?: string) => {
    if(!id) return '';
    const found = allClients.find(c => c.id === id);
    return found ? found.name : 'Desconocido';
  };

  // Helper to determine visual styles based on transaction type
  const getTxStyles = (type: string) => {
      switch(type) {
        case TransactionType.PAYMENT_CAPITAL:
            return { icon: <ArrowUpRight size={20}/>, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Abono a Capital', isIncome: true };
        case TransactionType.PAYMENT_INTEREST:
            return { icon: <ArrowUpRight size={20}/>, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Pago de Intereses', isIncome: true };
        case TransactionType.DISBURSEMENT:
            return { icon: <ArrowDownLeft size={20}/>, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Desembolso', isIncome: false };
        case TransactionType.REFINANCE:
            return { icon: <TrendingUp size={20}/>, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Refinanciación', isIncome: false };
        case TransactionType.REDIRECT_OUT:
            return { icon: <ArrowRightLeft size={20}/>, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Redirección (Pago)', isIncome: true };
        case TransactionType.REDIRECT_IN:
            return { icon: <ArrowRightLeft size={20}/>, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Redirección (Cobro)', isIncome: false };
        case TransactionType.SETTLEMENT:
            return { icon: <CheckCircle size={20}/>, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', label: 'Cierre', isIncome: false };
        default:
            return { icon: <DollarSign size={20}/>, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Transacción', isIncome: false };
      }
  };

  return (
    <>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Clock size={18} className="text-slate-400"/> Historial de Movimientos
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase">{transactions.length} transacciones</span>
            </div>
            
            <table className="w-full text-left">
            <thead className="text-xs font-bold uppercase text-slate-400 bg-white border-b border-slate-100">
                <tr>
                    <th className="px-6 py-3">Operación</th>
                    <th className="px-6 py-3 text-right">Total Transacción</th>
                    <th className="px-6 py-3 text-right">Saldo Deuda</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {[...transactions].reverse().map((t) => {
                    const styles = getTxStyles(t.type);
                    const totalAmount = t.amount + (t.interestPaid || 0);

                    return (
                        <tr 
                            key={t.id} 
                            onClick={() => setSelectedTx(t)}
                            className="hover:bg-slate-50 transition-colors group cursor-pointer active:bg-slate-100"
                        >
                        <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${styles.bg} ${styles.color} shrink-0 mt-1 shadow-sm`}>
                                    {React.cloneElement(styles.icon as React.ReactElement<any>, { size: 16 })}
                                </div>
                                <div>
                                    <div className={`text-sm font-bold ${styles.color}`}>{styles.label}</div>
                                    <div className="text-xs text-slate-400 font-mono mb-1">{t.date}</div>
                                    
                                    {/* Description / Notes */}
                                    <div className="text-xs text-slate-600 max-w-md line-clamp-1">
                                    {t.notes && <span className="italic">"{t.notes}"</span>}
                                    
                                    {/* REDIRECTION DETAIL */}
                                    {t.relatedClientId && (
                                        <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide w-fit
                                            ${t.type === TransactionType.REDIRECT_OUT ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-orange-100 text-orange-800 border-orange-200'}
                                        `}>
                                            <User size={10}/>
                                            {t.type === TransactionType.REDIRECT_OUT ? 'A: ' : 'De: '}
                                            <span className="underline">{getRelatedClientName(t.relatedClientId)}</span>
                                        </div>
                                    )}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className={`text-sm font-bold ${styles.isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                {styles.isIncome ? '+' : '-'}{formatCurrency(totalAmount)}
                            </div>
                            {/* Breakdown */}
                            {(t.interestPaid > 0 || (t.amount > 0 && t.interestPaid > 0)) && (
                                <div className="text-[10px] text-slate-400 mt-1 flex flex-col items-end opacity-80">
                                    {t.amount > 0 && <span>Cap: {formatCurrency(t.amount)}</span>}
                                    {t.interestPaid > 0 && <span>Int: {formatCurrency(t.interestPaid)}</span>}
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="text-sm font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
                                {formatCurrency(t.balanceAfter)}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                {/* RECEIPT BUTTON */}
                                {t.receiptUrl && (
                                    <button 
                                    onClick={(e) => { e.stopPropagation(); onViewReceipt(t.receiptUrl!); }}
                                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded border border-slate-200 transition-colors bg-white shadow-sm"
                                    title="Ver Soporte / Recibo"
                                    >
                                    <Paperclip size={14}/>
                                    </button>
                                )}
                                
                                {onEditTransaction && (
                                    <button 
                                    onClick={(e) => { e.stopPropagation(); onEditTransaction(t); }}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                                    title="Editar Transacción"
                                    >
                                    <Pencil size={14}/>
                                    </button>
                                )}
                                {onDeleteTransaction && (
                                    <button 
                                    type="button"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        onDeleteTransaction(t);
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                    title="Eliminar Transacción"
                                    >
                                    <Trash2 size={14}/>
                                    </button>
                                )}
                            </div>
                        </td>
                        </tr>
                    );
                })}
            </tbody>
            </table>
        </div>

        {/* --- TRANSACTION DETAILS POPUP --- */}
        {selectedTx && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedTx(null)}>
                <div 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden scale-100 animate-in zoom-in-95 duration-200 relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header with dynamic color */}
                    <div className={`${getTxStyles(selectedTx.type).bg} p-6 border-b ${getTxStyles(selectedTx.type).border} relative`}>
                        <button 
                            onClick={() => setSelectedTx(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/50 hover:bg-white text-slate-500 transition-colors"
                        >
                            <X size={20}/>
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className={`p-3 rounded-full bg-white shadow-sm ${getTxStyles(selectedTx.type).color} mb-3`}>
                                {getTxStyles(selectedTx.type).icon}
                            </div>
                            <h3 className={`text-xl font-bold ${getTxStyles(selectedTx.type).color}`}>
                                {getTxStyles(selectedTx.type).label}
                            </h3>
                            <div className="text-slate-500 font-mono text-sm mt-1">{selectedTx.date}</div>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        
                        {/* MAIN AMOUNT */}
                        <div className="text-center">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Total</div>
                            <div className="text-3xl font-bold text-slate-900">
                                {formatCurrency(selectedTx.amount + (selectedTx.interestPaid || 0))}
                            </div>
                        </div>

                        {/* DETAILS GRID */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Capital</div>
                                <div className="font-bold text-slate-700 text-sm">{formatCurrency(selectedTx.amount)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Intereses</div>
                                <div className="font-bold text-slate-700 text-sm">{formatCurrency(selectedTx.interestPaid || 0)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Saldo Resultante</div>
                                <div className="font-bold text-slate-700 text-sm">{formatCurrency(selectedTx.balanceAfter)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">ID Transacción</div>
                                <div className="font-mono text-xs text-slate-500 truncate" title={selectedTx.id}>#{selectedTx.id.substring(0,8)}</div>
                            </div>
                        </div>

                        {/* NOTES */}
                        {selectedTx.notes && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                <FileText size={18} className="text-blue-500 shrink-0 mt-0.5"/>
                                <div>
                                    <div className="text-xs font-bold text-blue-700 uppercase mb-1">Observaciones</div>
                                    <p className="text-sm text-blue-900 italic">"{selectedTx.notes}"</p>
                                </div>
                            </div>
                        )}

                        {/* RECEIPT PREVIEW - CLICK TO OPEN FULLSCREEN */}
                        {selectedTx.receiptUrl ? (
                            <div 
                                className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-zoom-in h-40 flex items-center justify-center"
                                onClick={() => {
                                    onViewReceipt(selectedTx.receiptUrl!);
                                    // Optional: Close modal when opening full image, or keep it open. Keeping open is usually better UX.
                                }}
                            >
                                <img 
                                    src={selectedTx.receiptUrl} 
                                    alt="Soporte" 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <button className="bg-white/90 text-slate-800 px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-2">
                                        <ExternalLink size={14}/> Ver Pantalla Completa
                                    </button>
                                </div>
                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                                    <Paperclip size={10}/> Soporte Adjunto
                                </div>
                            </div>
                        ) : (
                            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-slate-300 gap-2 h-24">
                                <ImageIcon size={24}/>
                                <span className="text-xs font-medium">Sin soporte adjunto</span>
                            </div>
                        )}

                        {/* REDIRECTION / RELATIONSHIPS */}
                        {selectedTx.relatedClientId && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center border-t border-slate-100 pt-4">
                                <ArrowRightLeft size={14}/>
                                <span>Vinculado con cliente: <strong>{getRelatedClientName(selectedTx.relatedClientId)}</strong></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};
