
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, Transaction } from '../types';
import { Search, Plus, CalendarCheck, AlertTriangle, ArrowRight, Settings2, DollarSign, Wallet, Eye, EyeOff, TrendingUp, ArrowRightLeft, Zap, X, ChevronRight, CreditCard, Send, Megaphone, UserCheck, Clock, ShieldCheck, BarChart3, Trash2, Hourglass, Calendar, ListFilter } from 'lucide-react';

interface ClientListProps {
  clients: Client[];
  transactions: Transaction[];
  onSelectClient: (id: string) => void;
  onNewClient: () => void;
  onQuickAction: (client: Client, mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => void;
  n8nWebhookUrl?: string;
  onDeleteClient?: (client: Client) => void;
}

// Columns definition for the toggler
type ColumnKey = 'card' | 'name' | 'guarantor' | 'contact' | 'last_activity' | 'profit' | 'balance' | 'limit' | 'dates' | 'status' | 'action';

export const ClientList: React.FC<ClientListProps> = ({ clients, transactions, onSelectClient, onNewClient, onQuickAction, n8nWebhookUrl, onDeleteClient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [isSendingMassMsg, setIsSendingMassMsg] = useState(false);
  
  // FILTER MODE FOR CONTROL
  const [filterMode, setFilterMode] = useState<'ALL' | 'TODAY' | 'LATE' | 'WAITING'>('ALL');
  
  // Custom Confirmation Modal State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  
  // Quick Pay Modal State
  const [isQuickPayOpen, setIsQuickPayOpen] = useState(false);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Focus input when Quick Pay opens
  useEffect(() => {
    if (isQuickPayOpen && quickInputRef.current) {
        setTimeout(() => quickInputRef.current?.focus(), 50);
    }
  }, [isQuickPayOpen]);

  // Handle Escape key to close quick pay
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsQuickPayOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  
  // State for visible columns
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    card: true,
    name: true,
    guarantor: true,
    contact: true,
    last_activity: true,
    profit: true,
    balance: true,
    limit: false, 
    dates: true,
    status: true,
    action: true
  });

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  // --- Advanced Calculations (Memoized) ---
  const { clientMetrics, stats, lateClientsList } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const activeClients = clients.filter(c => c.status === 'ACTIVE');
    
    // Group transactions by client
    const txByClient: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      if (!txByClient[t.clientId]) txByClient[t.clientId] = [];
      txByClient[t.clientId].push(t);
    });

    const metrics: Record<string, { balance: number, totalInterest: number, lastDate: string | null }> = {};
    let totalPortfolio = 0;

    clients.forEach(c => {
       const cTx = txByClient[c.id] || [];
       // Sort by date to get last balance
       const sorted = cTx.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
       
       const bal = sorted.length > 0 ? sorted[sorted.length - 1].balanceAfter : 0;
       const interests = sorted.reduce((sum, t) => sum + t.interestPaid, 0);
       const lastTxDate = sorted.length > 0 ? sorted[sorted.length - 1].date : null;

       metrics[c.id] = {
         balance: bal,
         totalInterest: interests,
         lastDate: lastTxDate
       };
       
       if (c.status === 'ACTIVE') {
         totalPortfolio += bal;
       }
    });

    // 2. Metrics
    const paymentsTodayCount = activeClients.filter(c => c.nextPaymentDate === today).length;
    
    // Filter Late Clients
    const lateList = activeClients.filter(c => {
      const bal = metrics[c.id]?.balance || 0;
      return c.nextPaymentDate && c.nextPaymentDate < today && bal > 0;
    });
    
    return { 
      clientMetrics: metrics, 
      lateClientsList: lateList,
      stats: { totalActive: activeClients.length, paymentsTodayCount, lateClientsCount: lateList.length, totalPortfolio } 
    };
  }, [clients, transactions]);

  // --- Filtering ---
  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    return clients.filter(c => {
       // 1. Text Search
       const matchesSearch = 
        c.name.toLowerCase().includes(q) || 
        c.cardCode.includes(q) || 
        c.cedula.includes(q) || 
        c.phone.includes(q) ||
        c.guarantorName.toLowerCase().includes(q);
      
      if (!matchesSearch) return false;

      // 2. Mode Filter (Control)
      if (filterMode === 'TODAY') return c.nextPaymentDate === today && c.status === 'ACTIVE';
      
      const metrics = clientMetrics[c.id];
      if (filterMode === 'LATE') return c.nextPaymentDate && c.nextPaymentDate < today && c.status === 'ACTIVE' && (metrics?.balance || 0) > 0;
      if (filterMode === 'WAITING') return (c.pendingRedirectionBalance || 0) > 0;
      
      return true;
    });
  }, [clients, searchTerm, filterMode, clientMetrics]);

  // --- Quick Pay Filtering ---
  const quickPayResults = useMemo(() => {
      if (!quickSearchTerm) return [];
      const q = quickSearchTerm.toLowerCase();
      // Only show active clients with debt or active status
      return clients.filter(c => 
        (c.status === 'ACTIVE') &&
        (c.name.toLowerCase().includes(q) || c.cardCode.includes(q) || c.cedula.includes(q))
      ).slice(0, 5); // Limit to 5 results for clean UI
  }, [clients, quickSearchTerm]);

  // --- Mass Messaging Handler ---
  const handleMassNotification = async () => {
    if (!n8nWebhookUrl) {
      alert("⚠️ Error: No has configurado la URL del Webhook de n8n en Configuración.");
      return;
    }
    if (lateClientsList.length === 0) {
      alert("No hay clientes en mora para notificar.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de enviar notificaciones de cobro a ${lateClientsList.length} clientes en mora?`)) {
      return;
    }

    setIsSendingMassMsg(true);
    
    try {
      // Construct payload
      const payload = {
        timestamp: new Date().toISOString(),
        totalLateClients: lateClientsList.length,
        clients: lateClientsList.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          cedula: c.cedula,
          cardCode: c.cardCode,
          debtAmount: clientMetrics[c.id].balance,
          dueDate: c.nextPaymentDate
        }))
      };

      // Send to N8N
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("✅ Notificaciones enviadas exitosamente al sistema de mensajería (n8n).");
      } else {
        alert("❌ Error al contactar con n8n. Verifica la URL.");
      }

    } catch (error) {
      console.error(error);
      alert("❌ Error de red al intentar enviar los datos.");
    } finally {
      setIsSendingMassMsg(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      
      {/* 1. Dashboard Metrics (Scrollable on small screens) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6 shrink-0">
         <div className="bg-slate-900 text-white p-3 md:p-4 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
            <div className="flex items-center gap-1 md:gap-2 mb-1 text-slate-300">
               <Wallet size={16}/> <span className="text-[10px] md:text-xs font-bold uppercase">Capital en la Calle</span>
            </div>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(stats.totalPortfolio)}</div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">{stats.totalActive} clientes</div>
         </div>

         {/* PROFESSIONAL QUICK ACTION CARD */}
         <div 
           className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3 md:p-4 rounded-xl shadow-lg flex flex-col justify-between cursor-pointer hover:shadow-xl transition-all transform hover:-translate-y-1 relative overflow-hidden group"
           onClick={() => { setIsQuickPayOpen(true); setQuickSearchTerm(''); }}
         >
             <div className="absolute right-0 bottom-0 opacity-10 p-2"><Zap size={80}/></div>
             <div className="flex items-center gap-2 mb-1 text-emerald-100">
                <CreditCard size={16}/> <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Cobro Rápido</span>
             </div>
             <div>
                <div className="text-md md:text-xl font-bold flex items-center gap-1">
                   Cobrar <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform"/>
                </div>
                <div className="text-[10px] md:text-xs text-emerald-100 mt-0.5 opacity-90 hidden md:block">Clic aquí o presione 'P'</div>
             </div>
         </div>

         {/* LATE CLIENTS & MASS ACTION */}
         <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-3 bg-red-100 text-red-600 rounded-lg shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="text-xl md:text-2xl font-bold text-slate-800 leading-none">{stats.lateClientsCount}</div>
                <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase">En Mora</div>
              </div>
            </div>
            
            {stats.lateClientsCount > 0 && (
              <button 
                onClick={handleMassNotification}
                disabled={isSendingMassMsg}
                className="mt-2 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-[10px] md:text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
              >
                {isSendingMassMsg ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <Megaphone size={12} /> Notificar
                  </>
                )}
              </button>
            )}
         </div>

         <div className="bg-blue-50 p-3 md:p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center items-center text-center cursor-pointer hover:bg-blue-100 transition-colors group" onClick={onNewClient}>
            <div className="bg-blue-600 text-white p-2 md:p-3 rounded-full mb-1 shadow-lg shadow-blue-200 group-hover:rotate-90 transition-transform duration-300">
               <Plus size={18}/>
            </div>
            <span className="font-bold text-blue-900 text-xs md:text-sm">Nuevo Cliente</span>
         </div>
      </div>

      {/* 2. Advanced Toolbar & FILTERS */}
      <div className="bg-white p-3 rounded-xl md:rounded-b-none md:rounded-t-xl border border-slate-200 md:border-b-0 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 mb-3 md:mb-0">
        <div className="relative w-full sm:w-96">
           <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
           <input 
             type="text" 
             placeholder="Buscar nombre, cédula..." 
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
             className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 transition-all text-sm"
           />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {/* Control Filters */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button 
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${filterMode === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <ListFilter size={14}/> Todos
                </button>
                <button 
                  onClick={() => setFilterMode('TODAY')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${filterMode === 'TODAY' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <CalendarCheck size={14}/> Hoy ({stats.paymentsTodayCount})
                </button>
                <button 
                  onClick={() => setFilterMode('LATE')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${filterMode === 'LATE' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <AlertTriangle size={14}/> Mora
                </button>
                <button 
                  onClick={() => setFilterMode('WAITING')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${filterMode === 'WAITING' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <Hourglass size={14}/> Espera
                </button>
            </div>

            <div className="hidden md:block w-px h-6 bg-slate-200 mx-1"></div>

            <div className="hidden md:flex relative">
                <button 
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                    <Settings2 size={14}/> Columnas
                </button>
                
                {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-xs font-bold text-slate-400 uppercase px-2 py-1 mb-1">Mostrar Columnas</div>
                    {[
                        { k: 'card', l: 'Tarjeta / ID' },
                        { k: 'name', l: 'Cliente' },
                        { k: 'guarantor', l: 'Fiador' },
                        { k: 'contact', l: 'Contacto' },
                        { k: 'last_activity', l: 'Último Movimiento' },
                        { k: 'profit', l: 'Intereses (Ganancia)' },
                        { k: 'balance', l: 'Saldo Pendiente' },
                        { k: 'limit', l: 'Cupo Total' },
                        { k: 'dates', l: 'Fechas' },
                        { k: 'status', l: 'Estado' },
                    ].map((col) => (
                        <button
                        key={col.k}
                        onClick={() => toggleColumn(col.k as ColumnKey)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-slate-50 text-slate-700"
                        >
                        <span>{col.l}</span>
                        {visibleColumns[col.k as ColumnKey] ? <Eye size={14} className="text-blue-600"/> : <EyeOff size={14} className="text-slate-300"/>}
                        </button>
                    ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. The Rich Table (DESKTOP ONLY) & Cards (MOBILE ONLY) */}
      <div className="flex-1 bg-transparent md:bg-white rounded-b-xl md:border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0">
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          
          {/* MOBILE CARD LIST VIEW */}
          <div className="md:hidden space-y-3 pb-20">
             {filteredClients.map(client => {
                const metrics = clientMetrics[client.id] || { balance: 0, totalInterest: 0, lastDate: null };
                const balance = metrics.balance;
                const isLate = client.nextPaymentDate && new Date(client.nextPaymentDate) < new Date() && balance > 0;
                const isWaitingFunds = (client.pendingRedirectionBalance || 0) > 0;

                return (
                  <div 
                    key={client.id}
                    onClick={() => onSelectClient(client.id)}
                    className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform
                        ${isLate ? 'border-l-4 border-l-red-500' : isWaitingFunds ? 'border-l-4 border-l-orange-500' : 'border-l-4 border-l-blue-500'}
                    `}
                  >
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                           <span className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                              {client.cardCode}
                           </span>
                           <h3 className="font-bold text-slate-800 text-sm">{client.name}</h3>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-xs font-bold text-slate-400 uppercase">Deuda</span>
                           <span className={`font-bold ${isLate ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(balance)}</span>
                        </div>
                     </div>

                     <div className="flex justify-between items-center text-xs text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                           <CalendarCheck size={12} className="text-slate-400"/> 
                           <span>{client.nextPaymentDate || 'Sin fecha'}</span>
                           {isLate && <span className="bg-red-100 text-red-600 px-1.5 rounded-[4px] text-[10px] font-bold">MORA</span>}
                        </div>
                        {isWaitingFunds && (
                           <div className="flex items-center gap-1 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                              <Hourglass size={10}/> Esperando
                           </div>
                        )}
                     </div>

                     <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                        <button
                           onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'PAYMENT'); }}
                           className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-100"
                        >
                           <DollarSign size={14}/> Abonar
                        </button>
                        <button
                           onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'DISBURSEMENT'); }}
                           className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-100"
                        >
                           <TrendingUp size={14}/> Prestar
                        </button>
                     </div>
                  </div>
                );
             })}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {visibleColumns.card && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-24 text-center">Tarjeta</th>}
                {visibleColumns.name && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>}
                {visibleColumns.guarantor && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fiador</th>}
                {visibleColumns.contact && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contacto</th>}
                {visibleColumns.last_activity && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Último Mov.</th>}
                {visibleColumns.profit && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Rentabilidad</th>}
                {visibleColumns.limit && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Cupo</th>}
                {visibleColumns.balance && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Saldo / Deuda</th>}
                {visibleColumns.dates && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Próximo Pago</th>}
                {visibleColumns.status && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Estado</th>}
                {visibleColumns.action && <th className="p-4 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right w-40">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                       <Search size={32} className="opacity-20"/>
                       <span>No se encontraron resultados en esta vista.</span>
                       {filterMode !== 'ALL' && (
                           <button onClick={() => setFilterMode('ALL')} className="text-xs text-blue-500 hover:underline">
                               Ver Todos los Clientes
                           </button>
                       )}
                    </div>
                  </td>
                </tr>
              )}
              {filteredClients.map(client => {
                const metrics = clientMetrics[client.id] || { balance: 0, totalInterest: 0, lastDate: null };
                const balance = metrics.balance;
                const isLate = client.nextPaymentDate && new Date(client.nextPaymentDate) < new Date() && balance > 0;
                const isPaid = balance <= 0 && client.status === 'ACTIVE';
                const percentageUsed = client.loanLimit ? Math.min(100, (balance / client.loanLimit) * 100) : 0;
                
                // Redirection Waiting Logic
                const isWaitingFunds = (client.pendingRedirectionBalance || 0) > 0;
                const daysPassed = Math.floor((new Date().getTime() - new Date(client.creditStartDate).getTime()) / (1000 * 60 * 60 * 24));
                const remainingWait = (client.redirectionWaitDays || 0) - daysPassed;

                return (
                  <tr 
                    key={client.id} 
                    onClick={() => onSelectClient(client.id)}
                    className={`group transition-colors border-l-4 cursor-pointer 
                      ${isWaitingFunds ? 'bg-orange-50/20 border-orange-400 hover:bg-orange-50/40' : 
                        isLate ? 'bg-red-50/30 border-red-500 hover:bg-red-50' : 
                        isPaid ? 'border-green-500 hover:bg-green-50/30' : 
                        'border-transparent hover:bg-blue-50/30'}`}
                  >
                    
                    {visibleColumns.card && (
                      <td className="p-4 text-center">
                        <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs font-mono font-bold text-slate-700 border border-slate-300 shadow-sm">
                          {client.cardCode}
                        </span>
                      </td>
                    )}
                    
                    {visibleColumns.name && (
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700">{client.name}</div>
                        {client.occupation && <div className="text-[10px] text-slate-400 uppercase font-bold">{client.occupation}</div>}
                        
                        {/* PRIORITY WAITING BADGE */}
                        {isWaitingFunds && (
                           <div className={`mt-1.5 flex items-center gap-2 px-2 py-1 rounded-md border text-[10px] font-bold w-fit
                              ${remainingWait >= 0 ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-red-50 text-red-800 border-red-200 animate-pulse'}
                           `}>
                              <Hourglass size={12} className="shrink-0"/>
                              <div className="flex flex-col leading-none gap-0.5">
                                 <span className="uppercase opacity-70 text-[9px]">Esperando Desembolso</span>
                                 <span>{remainingWait === 0 ? 'HOY' : remainingWait > 0 ? `En ${remainingWait} días` : `Retraso de ${Math.abs(remainingWait)} días`}</span>
                              </div>
                           </div>
                        )}
                      </td>
                    )}

                    {visibleColumns.guarantor && (
                      <td className="p-4">
                         <div className="flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-slate-400 shrink-0"/>
                            <div>
                               <div className="text-xs font-semibold text-slate-700">{client.guarantorName}</div>
                               <div className="text-[10px] text-slate-400">{client.guarantorPhone}</div>
                            </div>
                         </div>
                      </td>
                    )}

                    {visibleColumns.contact && (
                      <td className="p-4">
                        <div className="text-xs font-mono text-slate-600 font-medium">{client.cedula}</div>
                        <div className="text-xs text-slate-400">{client.phone}</div>
                      </td>
                    )}

                    {visibleColumns.last_activity && (
                       <td className="p-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                             <Clock size={12} className="text-slate-400"/>
                             {metrics.lastDate ? metrics.lastDate : <span className="text-slate-300 italic">Sin mov.</span>}
                          </div>
                       </td>
                    )}

                    {visibleColumns.profit && (
                       <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                             <BarChart3 size={12} className="text-emerald-500 opacity-50"/>
                             <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {formatCurrency(metrics.totalInterest)}
                             </span>
                          </div>
                       </td>
                    )}

                    {visibleColumns.limit && (
                      <td className="p-4 text-right">
                         <div className="text-xs text-slate-500 font-medium">{formatCurrency(client.loanLimit || 0)}</div>
                      </td>
                    )}

                    {visibleColumns.balance && (
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                            {balance > 0 ? (
                               <div className="text-right">
                                 <div className={`font-bold text-sm ${isLate ? 'text-red-600' : 'text-slate-800'}`}>
                                   {formatCurrency(balance)}
                                 </div>
                                 {/* Mini Progress Bar of Debt vs Limit (Visual Cue) */}
                                 {client.loanLimit && client.loanLimit > 0 && (
                                    <div className="w-20 h-1 bg-slate-100 rounded-full ml-auto mt-1 overflow-hidden">
                                       <div className={`h-full rounded-full ${isLate ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${percentageUsed}%` }}></div>
                                    </div>
                                 )}
                               </div>
                            ) : null}

                            {isWaitingFunds && (
                                <div className="flex flex-col items-end">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Por recibir</span>
                                   <span className="text-sm font-bold text-orange-600">
                                      {formatCurrency(client.pendingRedirectionBalance || 0)}
                                   </span>
                                </div>
                            )}

                            {balance <= 0 && !isWaitingFunds && (
                               <div className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full inline-block">
                                 PAZ Y SALVO
                               </div>
                            )}
                        </div>
                      </td>
                    )}

                    {visibleColumns.dates && (
                      <td className="p-4">
                         <div className="flex items-center gap-2">
                            {client.nextPaymentDate ? (
                              <div className={`text-xs font-medium px-2 py-1 rounded border ${isLate ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {client.nextPaymentDate}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                            {isLate && <AlertTriangle size={14} className="text-red-500 animate-pulse"/>}
                         </div>
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td className="p-4 text-center">
                        {isWaitingFunds ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-[10px] font-bold border border-orange-200 shadow-sm">
                              En Espera
                            </span>
                        ) : client.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-200">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200">
                            Inactivo
                          </span>
                        )}
                      </td>
                    )}

                    {visibleColumns.action && (
                      <td className="p-4 text-right">
                        <div className="flex gap-1 justify-end transition-opacity">
                          {/* Payment Button - ALWAYS VISIBLE */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'PAYMENT'); }}
                            className="bg-green-100 hover:bg-green-600 text-green-700 hover:text-white p-2 rounded-lg transition-colors border border-green-200 shadow-sm"
                            title="Registrar Pago"
                          >
                            <DollarSign size={16} />
                          </button>
                          
                          {/* Redirection Button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'REDIRECT'); }}
                            className="bg-yellow-100 hover:bg-yellow-500 text-yellow-700 hover:text-white p-2 rounded-lg transition-colors border border-yellow-200 shadow-sm"
                            title="Redireccionar Pago"
                          >
                            <ArrowRightLeft size={16} />
                          </button>

                           {/* Refinance/Disbursement Button */}
                           <button
                            onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'DISBURSEMENT'); }}
                            className="bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white p-2 rounded-lg transition-colors border border-blue-200 shadow-sm"
                            title="Refinanciar / Prestar"
                          >
                            <TrendingUp size={16} />
                          </button>

                          {/* Delete Button (TRIGGER MODAL) */}
                          {onDeleteClient && (
                            <button
                              onClick={(e) => { 
                                 e.preventDefault(); 
                                 e.stopPropagation(); 
                                 setClientToDelete(client); // Opens the safe modal
                              }}
                              className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white p-2 rounded-lg transition-colors border border-red-200 shadow-sm"
                              title="Eliminar Cliente"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center uppercase font-bold tracking-wider hidden md:block">
           Mostrando {filteredClients.length} de {clients.length} clientes
        </div>
      </div>

      {/* --- CONFIRMATION MODAL (SAFE DELETE) --- */}
      {clientToDelete && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
               <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
                  <div className="bg-red-100 p-3 rounded-full mb-4">
                     <AlertTriangle size={32} className="text-red-600"/>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">¿Eliminar Cliente?</h3>
                  <p className="text-sm text-slate-600 mt-2">
                     Vas a eliminar permanentemente a <strong>{clientToDelete.name}</strong>. Esta acción no se puede deshacer.
                  </p>
               </div>
               <div className="p-4 bg-white flex gap-3">
                  <button 
                     onClick={() => setClientToDelete(null)}
                     className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                  >
                     Cancelar
                  </button>
                  <button 
                     onClick={() => {
                        if (onDeleteClient) onDeleteClient(clientToDelete);
                        setClientToDelete(null);
                     }}
                     className="flex-1 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                  >
                     Sí, Eliminar
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* --- PROFESSIONAL QUICK SEARCH / COMMAND PALETTE MODAL --- */}
      {isQuickPayOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 px-4 transition-opacity duration-300"
          onClick={() => setIsQuickPayOpen(false)}
        >
           <div 
             className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
             onClick={e => e.stopPropagation()} // Prevent close on modal click
           >
              {/* Header Input */}
              <div className="p-5 border-b border-slate-200 flex items-center gap-4 bg-white">
                 <Search className="text-slate-400" size={24} />
                 <input 
                   ref={quickInputRef}
                   type="text" 
                   className="flex-1 text-xl font-medium outline-none text-slate-900 bg-white placeholder:text-slate-300"
                   placeholder="Buscar cliente por nombre o tarjeta..."
                   value={quickSearchTerm}
                   onChange={e => setQuickSearchTerm(e.target.value)}
                 />
                 <button onClick={() => setIsQuickPayOpen(false)} className="text-slate-400 hover:text-slate-600">
                   <div className="text-[10px] font-bold border border-slate-200 rounded px-2 py-1 bg-slate-50">ESC</div>
                 </button>
              </div>
              
              {/* Results List */}
              <div className="max-h-[60vh] overflow-y-auto bg-slate-50/50 p-2">
                 {quickSearchTerm.trim() === '' ? (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                       <Zap size={32} className="text-slate-300"/>
                       <span className="text-sm">Escribe para encontrar un cliente y registrar un pago rápido.</span>
                    </div>
                 ) : quickPayResults.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                       No se encontraron clientes activos.
                    </div>
                 ) : (
                    <div className="space-y-2">
                      {quickPayResults.map(client => {
                         const metrics = clientMetrics[client.id] || { balance: 0 };
                         const balance = metrics.balance;
                         return (
                           <button
                             key={client.id}
                             onClick={() => {
                               setIsQuickPayOpen(false);
                               onQuickAction(client, 'PAYMENT');
                             }}
                             className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:ring-1 hover:ring-emerald-400 transition-all flex justify-between items-center group text-left"
                           >
                              <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-slate-100 text-slate-600 text-xs font-mono px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                                      {client.cardCode}
                                    </span>
                                    <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                                      {client.name}
                                    </h4>
                                 </div>
                                 <div className="text-xs text-slate-400">{client.cedula}</div>
                              </div>
                              
                              <div className="text-right">
                                 <div className="text-xs text-slate-400 uppercase font-bold">Deuda Actual</div>
                                 <div className="text-lg font-bold text-slate-900 group-hover:text-emerald-600">
                                   {formatCurrency(balance)}
                                 </div>
                              </div>
                           </button>
                         );
                      })}
                    </div>
                 )}
              </div>
              
              <div className="bg-slate-50 p-2 border-t border-slate-200 text-center text-[10px] text-slate-400 font-medium">
                 Seleccione un cliente para abrir la caja de cobro inmediatamente
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
