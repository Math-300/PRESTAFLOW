
import React, { useMemo, useState } from 'react';
import { Client, Transaction } from '../types';
import { 
  TrendingUp, ArrowRightLeft, ArrowLeft, CheckCircle, Ban, DollarSign, 
  User, Calendar, MapPin, Phone, Briefcase, UserPlus, FileText, 
  AlertTriangle, Trash2, Pencil, ExternalLink, X, Clock, ShieldCheck
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { EditableField } from './ui/EditableField';
import { ClientStats } from './client/ClientStats';
import { TransactionHistory } from './client/TransactionHistory';

interface ClientCardProps {
  client: Client;
  transactions: Transaction[];
  allClients: Client[];
  onAddTransaction: (mode?: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => void;
  onBack: () => void;
  onUpdateClient?: (client: Client) => void;
  onEditClient?: (client: Client) => void;
  onCloseCredit: () => void;
  onDeleteClient?: (client: Client) => void;
  onDeleteTransaction?: (tx: Transaction) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client, transactions, allClients, onAddTransaction, onBack, onUpdateClient, onEditClient, onCloseCredit, onDeleteClient, onDeleteTransaction, onEditTransaction }) => {
  
  // State for image lightbox
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // State for Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<{ type: 'CLIENT' | 'TRANSACTION', data: any } | null>(null);

  // --- Derived Data & Metrics ---
  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : 0;
  const isLate = client.nextPaymentDate && new Date(client.nextPaymentDate) < new Date() && currentBalance > 0;
  const isWaitingFunds = (client.pendingRedirectionBalance || 0) > 0;

  // Calculate remaining days for priority
  const daysPassed = Math.floor((new Date().getTime() - new Date(client.creditStartDate).getTime()) / (1000 * 60 * 60 * 24));
  const totalWaitDays = client.redirectionWaitDays || 0;
  const remainingWaitDays = totalWaitDays - daysPassed;

  // --- Helpers ---
  // Helper to get referrer name
  const referrerName = useMemo(() => {
    if (!client.referrerId) return '';
    const ref = allClients.find(c => c.id === client.referrerId);
    return ref ? ref.name : 'No encontrado';
  }, [client.referrerId, allClients]);

  const updateField = (key: keyof Client, val: any) => {
    if (onUpdateClient) {
      onUpdateClient({ ...client, [key]: val });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden relative">
      
      {/* 1. TOP HEADER & ACTIONS (STICKY) */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm z-20 relative">
         
         {/* Top Bar: Nav + Main Status */}
         <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3 w-full">
                <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <ArrowLeft size={20}/>
                </button>
                <div className="flex-1 overflow-hidden">
                   {/* Name is also editable now */}
                   <EditableField 
                      label="Nombre Cliente" 
                      value={client.name} 
                      onSave={(v) => updateField('name', v)} 
                      className="mb-1"
                   />
                   <div className="flex items-center gap-2">
                       <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono font-bold border border-slate-200">
                         #{client.cardCode}
                       </span>
                       {client.status === 'ACTIVE' ? (
                          <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-bold border border-green-100 flex items-center gap-1">
                             <CheckCircle size={10}/> ACTIVO
                          </span>
                       ) : (
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs font-bold border border-slate-200 flex items-center gap-1">
                             <Ban size={10}/> CERRADO
                          </span>
                       )}
                   </div>
                </div>
            </div>

            {/* ACTION BUTTONS: Updated to use flex-wrap and remove scrollbar */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto mt-0 items-center justify-start sm:justify-end">
                <button 
                  onClick={() => onAddTransaction('PAYMENT')} 
                  disabled={client.status === 'INACTIVE'}
                  className="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs md:text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <DollarSign size={16}/> Abonar
                </button>
                
                <button 
                  onClick={() => onAddTransaction('REDIRECT')} 
                  disabled={client.status === 'INACTIVE'}
                  className="flex-1 sm:flex-none px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs md:text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <ArrowRightLeft size={16}/> Redirigir
                </button>
                
                <button 
                  onClick={() => onAddTransaction('DISBURSEMENT')} 
                  disabled={client.status === 'INACTIVE' && currentBalance > 0}
                  className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs md:text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <TrendingUp size={16}/> Prestar
                </button>

                <div className="flex gap-1 ml-auto sm:ml-0 pl-1 border-l border-slate-200 sm:border-0 sm:pl-0">
                    {onEditClient && (
                      <button 
                        type="button"
                        onClick={() => onEditClient(client)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 shrink-0"
                        title="Modificar Datos / Préstamo"
                      >
                         <Pencil size={18}/>
                      </button>
                    )}

                    {onDeleteClient && (
                      <button 
                        type="button"
                        onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setDeletingItem({ type: 'CLIENT', data: client }); // OPEN MODAL
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer shrink-0"
                        title="Eliminar Cliente"
                      >
                         <Trash2 size={18}/>
                      </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* 2. DASHBOARD AREA (Scrollable) */}
      <div className="flex-1 overflow-y-auto bg-slate-100 relative">
         
         {/* DETAILS GRID - MOVED TO SCROLLABLE AREA TO FIX MOBILE LAYOUT */}
         <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-sm mb-4">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4">
                 <EditableField 
                    label="Cédula" 
                    value={client.cedula} 
                    icon={User}
                    type="number"
                    onSave={(v) => updateField('cedula', v)} 
                 />
                 <EditableField 
                    label="Teléfono" 
                    value={client.phone} 
                    icon={Phone}
                    type="number"
                    onSave={(v) => updateField('phone', v)} 
                 />
                 <EditableField 
                    label="Dirección Casa" 
                    value={client.address} 
                    icon={MapPin}
                    onSave={(v) => updateField('address', v)} 
                 />
                 <EditableField 
                    label="Ocupación" 
                    value={client.occupation || ''} 
                    icon={Briefcase}
                    placeholder="Sin definir"
                    onSave={(v) => updateField('occupation', v)} 
                 />
                 
                 <div className="col-span-2 sm:col-span-1">
                     <EditableField 
                        label="Garantía / Prenda" 
                        value={client.collateral || ''} 
                        icon={ShieldCheck}
                        placeholder="Sin garantía registrada"
                        onSave={(v) => updateField('collateral', v)} 
                        className="text-orange-700"
                     />
                 </div>

                  <EditableField 
                    label="Fiador" 
                    value={client.guarantorName} 
                    icon={User}
                    onSave={(v) => updateField('guarantorName', v)} 
                 />
                  <EditableField 
                    label="Tel. Fiador" 
                    value={client.guarantorPhone} 
                    icon={Phone}
                    type="number"
                    onSave={(v) => updateField('guarantorPhone', v)} 
                 />
                 
                 {/* Referrer - Read Only */}
                 <div className="hidden sm:block">
                     <EditableField 
                        label="Referido Por" 
                        value={referrerName}
                        icon={UserPlus}
                        readOnly
                        placeholder="Ninguno"
                     />
                 </div>

                 {/* Start Date - Read Only */}
                 <div className="hidden sm:block">
                     <EditableField 
                        label="Fecha Inicio"
                        value={client.creditStartDate}
                        icon={Calendar}
                        readOnly
                     />
                 </div>

                 {/* Notes - Editable Text */}
                 <div className="col-span-2 md:col-span-5 lg:col-span-1">
                    <EditableField 
                      label="Notas / Observaciones" 
                      value={client.notes || ''} 
                      icon={FileText}
                      onSave={(v) => updateField('notes', v)} 
                      placeholder="Agregar nota..."
                    />
                 </div>
             </div>
         </div>

         <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* STATUS ALERTS */}
            {isWaitingFunds && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                   <div className="bg-white p-3 rounded-full shadow-sm text-orange-500 hidden sm:block">
                      <Clock size={24}/>
                   </div>
                   <div className="flex-1">
                      <h3 className="text-orange-900 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                          <Clock size={16} className="sm:hidden"/> Fondos en Espera (Prioridad)
                      </h3>
                      <div className="text-orange-800 text-sm mt-1">
                         Este cliente está esperando recibir <span className="font-bold text-lg">{formatCurrency(client.pendingRedirectionBalance || 0)}</span>.
                         <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="opacity-80">Tiempo acordado: {totalWaitDays} días.</span>
                            {remainingWaitDays >= 0 ? (
                               <span className="font-bold bg-orange-200 text-orange-900 px-2 rounded text-xs border border-orange-300">
                                  Faltan {remainingWaitDays} días
                               </span>
                            ) : (
                               <span className="font-bold bg-red-100 text-red-700 px-2 rounded text-xs border border-red-200 animate-pulse flex items-center gap-1">
                                  <AlertTriangle size={10}/> Vencido hace {Math.abs(remainingWaitDays)} días
                               </span>
                            )}
                         </div>
                      </div>
                   </div>
                   <div className="ml-auto">
                      <span className="px-3 py-1 bg-white text-orange-600 text-xs font-bold rounded-full border border-orange-200 shadow-sm">Pendiente</span>
                   </div>
                </div>
            )}

            {/* CHARTS COMPONENT */}
            <ClientStats 
                client={client}
                transactions={transactions}
                currentBalance={currentBalance}
                isLate={isLate}
                onUpdateLimit={(v) => updateField('loanLimit', v)}
                onCloseCredit={onCloseCredit}
            />

            {/* TRANSACTION HISTORY COMPONENT */}
            <TransactionHistory 
                transactions={transactions}
                allClients={allClients}
                onViewReceipt={setViewingReceiptUrl}
                onEditTransaction={onEditTransaction}
                onDeleteTransaction={(tx) => setDeletingItem({ type: 'TRANSACTION', data: tx })}
            />
            
            {/* Bottom Spacer for FAB and Navigation */}
            <div className="h-24 sm:h-12"></div>
         </div>
      </div>

      {/* --- CONFIRMATION MODAL (SAFE DELETE) --- */}
      {deletingItem && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
               <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
                  <div className="bg-red-100 p-3 rounded-full mb-4">
                     <AlertTriangle size={32} className="text-red-600"/>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                     {deletingItem.type === 'CLIENT' ? '¿Eliminar Cliente?' : '¿Eliminar Transacción?'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                     {deletingItem.type === 'CLIENT' 
                        ? `Vas a eliminar permanentemente a ${deletingItem.data.name}.` 
                        : `Vas a eliminar esta transacción de ${formatCurrency(deletingItem.data.amount + (deletingItem.data.interestPaid || 0))}.`
                     }
                     <br/>Esta acción no se puede deshacer.
                  </p>
               </div>
               <div className="p-4 bg-white flex gap-3">
                  <button 
                     onClick={() => setDeletingItem(null)}
                     className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                  >
                     Cancelar
                  </button>
                  <button 
                     onClick={() => {
                        if (deletingItem.type === 'CLIENT' && onDeleteClient) {
                           onDeleteClient(deletingItem.data);
                        } else if (deletingItem.type === 'TRANSACTION' && onDeleteTransaction) {
                           onDeleteTransaction(deletingItem.data);
                        }
                        setDeletingItem(null);
                     }}
                     className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                  >
                     Sí, Eliminar
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* --- PROFESSIONAL IMAGE VIEWER OVERLAY --- */}
      {viewingReceiptUrl && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 flex gap-2">
               <a 
                  href={viewingReceiptUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
                  title="Abrir original"
               >
                  <ExternalLink size={24}/>
               </a>
               <button 
                  onClick={() => setViewingReceiptUrl(null)}
                  className="bg-white/20 hover:bg-red-500 text-white p-2 rounded-full transition-colors"
               >
                  <X size={24}/>
               </button>
            </div>

            {/* Image Container */}
            <div className="max-w-4xl max-h-[85vh] overflow-auto rounded-lg shadow-2xl bg-black">
               <img 
                  src={viewingReceiptUrl} 
                  alt="Recibo" 
                  className="max-w-full max-h-[80vh] object-contain"
               />
            </div>
            
            <div className="absolute bottom-4 text-white/50 text-xs font-mono">
               Visualizando Soporte
            </div>
         </div>
      )}

    </div>
  );
};
