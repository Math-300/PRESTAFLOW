
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, Client } from '../../types';
import { TrendingUp, ArrowUpRight, Wallet, Calendar, CheckCircle, Filter, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, formatNumberWithDots } from '../../utils/format';
import { EditableField } from '../ui/EditableField';
import { CreditCard } from 'lucide-react';

interface ClientStatsProps {
  client: Client;
  transactions: Transaction[];
  currentBalance: number;
  isLate: boolean;
  onUpdateLimit: (val: number) => void;
  onCloseCredit: () => void;
}

// Custom Tooltip Component for Rich Information
const CustomTooltip = ({ active, payload, label }: any) => {
   if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPayment = data.changeAmount < 0; // In debt logic, payment reduces balance (negative change in delta, but we show as positive action)
      // Actually, let's look at the transaction type derived in data preparation
      const isPositiveAction = [TransactionType.PAYMENT_CAPITAL, TransactionType.PAYMENT_INTEREST, TransactionType.REDIRECT_OUT].includes(data.type);
      
      return (
         <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-2xl border border-slate-700 min-w-[200px]">
            <div className="font-bold text-slate-400 mb-1 border-b border-slate-700 pb-1 flex justify-between">
               <span>{label}</span>
               <span className="font-mono opacity-50">{data.typeLabel}</span>
            </div>
            
            <div className="space-y-1 mb-2">
               <div className="flex justify-between items-center">
                  <span className="opacity-70">Saldo:</span>
                  <span className="font-bold text-blue-400">{formatCurrency(data.balance)}</span>
               </div>
               
               {data.transactionAmount > 0 && (
                  <div className="flex justify-between items-center">
                     <span className="opacity-70">Movimiento:</span>
                     <span className={`font-bold ${isPositiveAction ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositiveAction ? '-' : '+'}{formatCurrency(data.transactionAmount)}
                     </span>
                  </div>
               )}
            </div>

            {data.notes && (
               <div className="text-[10px] italic text-slate-400 bg-slate-800 p-1.5 rounded border border-slate-700">
                  "{data.notes}"
               </div>
            )}
         </div>
      );
   }
   return null;
};

export const ClientStats: React.FC<ClientStatsProps> = ({ 
  client, transactions, currentBalance, isLate, onUpdateLimit, onCloseCredit 
}) => {
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');
  
  // --- Data Prep ---
  const totalInterest = transactions.reduce((sum, t) => sum + t.interestPaid, 0);
  const totalCapitalPaid = transactions.reduce((sum, t) => sum + t.capitalPaid, 0);
  const totalDisbursed = transactions
    .filter(t => t.type === TransactionType.DISBURSEMENT || t.type === TransactionType.REFINANCE || t.type === TransactionType.REDIRECT_IN)
    .reduce((sum, t) => sum + t.amount, 0);

  // --- Chart Data Logic ---
  const chartData = useMemo(() => {
    // 1. Filter by Date Range
    const now = new Date();
    let startDate = new Date(0); // Epoch

    if (timeRange === '1M') startDate.setMonth(now.getMonth() - 1);
    else if (timeRange === '3M') startDate.setMonth(now.getMonth() - 3);
    else if (timeRange === '6M') startDate.setMonth(now.getMonth() - 6);
    else if (timeRange === '1Y') startDate.setFullYear(now.getFullYear() - 1);

    const filteredTxs = transactions.filter(t => new Date(t.date) >= startDate);
    
    // Add initial point if filtering (to avoid chart starting from 0 if there was previous balance)
    let initialBalancePoint = null;
    if (timeRange !== 'ALL' && filteredTxs.length > 0) {
       // Find the balance right before the first transaction in range
       const firstTxIndex = transactions.findIndex(t => t.id === filteredTxs[0].id);
       if (firstTxIndex > 0) {
          const prevTx = transactions[firstTxIndex - 1];
          initialBalancePoint = {
             name: 'Inicio',
             rawDate: startDate.toISOString(),
             balance: prevTx.balanceAfter,
             transactionAmount: 0,
             type: 'INITIAL',
             typeLabel: 'Saldo Anterior',
             notes: 'Saldo arrastrado'
          };
       }
    }

    // Map transactions to chart format
    const points = filteredTxs.map(t => {
       // Determine human readable type label
       let typeLabel = 'Movimiento';
       if (t.type === TransactionType.PAYMENT_CAPITAL) typeLabel = 'Abono';
       if (t.type === TransactionType.PAYMENT_INTEREST) typeLabel = 'Int.';
       if (t.type === TransactionType.DISBURSEMENT) typeLabel = 'Préstamo';
       if (t.type === TransactionType.REFINANCE) typeLabel = 'Refin.';

       return {
        name: t.date.substring(5), // MM-DD for axis
        rawDate: t.date,
        balance: t.balanceAfter,
        transactionAmount: t.amount + (t.interestPaid || 0),
        type: t.type,
        typeLabel,
        notes: t.notes
      };
    });

    return initialBalancePoint ? [initialBalancePoint, ...points] : points;
  }, [transactions, timeRange]);

  const paymentData = [
    { name: 'Capital Pagado', value: totalCapitalPaid, color: '#10b981' }, 
    { name: 'Intereses', value: totalInterest, color: '#f59e0b' },
    { name: 'Deuda Pendiente', value: currentBalance, color: '#64748b' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COL: BALANCE & TRENDS */}
        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Balance */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Pendiente</div>
                 <div className={`text-3xl font-bold ${currentBalance > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                    {formatCurrency(currentBalance)}
                 </div>
                 <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Wallet size={60} />
                 </div>
              </div>

               {/* Card 2: Next Payment */}
               <div className={`p-5 rounded-xl border shadow-sm relative overflow-hidden ${isLate ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                 <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isLate ? 'text-red-500' : 'text-slate-400'}`}>Próximo Pago</div>
                 <div className={`text-2xl font-bold flex items-center gap-2 ${isLate ? 'text-red-700' : 'text-slate-800'}`}>
                    {client.nextPaymentDate || 'N/A'}
                    {isLate && <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full">MORA</span>}
                 </div>
                 <div className="absolute top-0 right-0 p-3 opacity-5">
                    <Calendar size={60} />
                 </div>
              </div>

              {/* Card 3: Total Disbursed */}
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Prestado</div>
                 <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(totalDisbursed)}
                 </div>
                 
                 <div className="mt-1">
                    <EditableField 
                       label="Cupo Máx" 
                       value={client.loanLimit?.toString() || ''} 
                       icon={CreditCard}
                       type="text"
                       isCurrency
                       onSave={(v) => onUpdateLimit(Number(v.replace(/\./g, '')))} 
                    />
                 </div>
              </div>
           </div>

           {/* CHART: BALANCE TREND */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col relative">
              
              {/* Chart Header Controls */}
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                 <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-500"/> Comportamiento de Deuda
                 </h3>
                 
                 {/* Time Range Selector */}
                 <div className="flex bg-slate-100 rounded-lg p-0.5">
                    {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
                       <button
                          key={r}
                          onClick={() => setTimeRange(r as any)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all
                             ${timeRange === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                          `}
                       >
                          {r === 'ALL' ? 'Todo' : r}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="flex-1 w-full min-h-0 relative z-0">
                 {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                           <defs>
                              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                           <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fill: '#94a3b8'}} 
                              minTickGap={30}
                           />
                           <YAxis hide domain={['auto', 'auto']} />
                           
                           <Tooltip content={<CustomTooltip />} />
                           
                           {/* Reference Line for Credit Limit */}
                           {client.loanLimit && (
                              <ReferenceLine 
                                 y={client.loanLimit} 
                                 stroke="#ef4444" 
                                 strokeDasharray="3 3" 
                                 label={{ position: 'top', value: 'Cupo', fill: '#ef4444', fontSize: 10 }} 
                              />
                           )}

                           <Area 
                              type="monotone" 
                              dataKey="balance" 
                              stroke="#3b82f6" 
                              strokeWidth={3} 
                              fillOpacity={1} 
                              fill="url(#colorBalance)" 
                              activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                           />
                        </AreaChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                       <Wallet size={48} className="mb-2 opacity-20"/>
                       <p className="text-xs font-bold">Sin movimientos en este periodo</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* RIGHT COL: PAYMENT BREAKDOWN */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
           <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2 shrink-0">
              <ArrowUpRight size={16} className="text-green-500"/> Distribución de Pagos
           </h3>
           
           <div className="flex-1 w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={paymentData} layout="vertical" margin={{left: 0, right: 30}}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} formatter={(val: number) => formatCurrency(val)}/>
                    <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                       {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>

           <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 shrink-0">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div> Capital Retornado
                 </div>
                 <div className="font-bold text-sm text-green-700">{formatCurrency(totalCapitalPaid)}</div>
              </div>
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> Intereses Ganados
                 </div>
                 <div className="font-bold text-sm text-amber-700">{formatCurrency(totalInterest)}</div>
              </div>
           </div>
           
           {currentBalance === 0 && client.status === 'ACTIVE' && transactions.length > 0 && (
              <button 
                 onClick={onCloseCredit}
                 className="mt-6 w-full py-3 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                 <CheckCircle size={16}/> Cerrar Ciclo de Crédito
              </button>
           )}
        </div>
    </div>
  );
};
