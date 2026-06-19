// Pestaña "Clientes" de la Cartera: buscador, filtros (Todos/Hoy/Mora/Espera),
// selector de columnas, tabla desktop (11 columnas toggleables + acciones por fila),
// vista cards móvil (SwipeableItem + PullToRefresh) y footer "Mostrando N de M".
// Lógica relocalizada desde ClientList.tsx (sin cambios de negocio).
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Client, AppSettings } from '../../types';
import {
  Search, Settings2, DollarSign, Eye, EyeOff, TrendingUp, ArrowRightLeft,
  CalendarCheck, AlertTriangle, Clock, ShieldCheck,
  BarChart3, Trash2, Hourglass, ListFilter, Lock,
} from 'lucide-react';
import { getToday } from '../../utils/format';
import { PullToRefresh } from '../ui/PullToRefresh';
import { SwipeableItem } from '../ui/SwipeableItem';
import { CarteraDerived, ColumnKey } from './types';

interface ClientesTabProps {
  clients: Client[];
  settings: AppSettings;
  derived: CarteraDerived;
  can: (permissionSlug: string) => boolean;
  onSelectClient: (id: string) => void;
  onQuickAction: (client: Client, mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => void;
  onDeleteClient?: (client: Client) => void;
  onRequestDelete: (client: Client) => void;
  onRefresh?: () => Promise<void>;
  // Filtro controlado desde CarteraView para que la agenda (Resumen) pueda aplicarlo.
  filterMode: 'ALL' | 'TODAY' | 'LATE' | 'WAITING';
  setFilterMode: (mode: 'ALL' | 'TODAY' | 'LATE' | 'WAITING') => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
};

export const ClientesTab: React.FC<ClientesTabProps> = ({
  clients, settings, derived, can,
  onSelectClient, onQuickAction, onDeleteClient, onRequestDelete, onRefresh,
  filterMode, setFilterMode,
}) => {
  const { clientMetrics, stats } = derived;
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // State for visible columns
  // Handle Initial Columns from Settings
  const initialColumns = useMemo(() => {
    const defaultCols = {
      card: true, name: true, guarantor: false, contact: false,
      last_activity: false, profit: true, balance: true,
      limit: false, dates: true, status: true, action: true
    };
    if (settings.uiConfig?.visibleColumns) {
      const saved = {} as any;
      Object.keys(defaultCols).forEach(k => {
        saved[k] = settings.uiConfig!.visibleColumns!.includes(k);
      });
      // Always ensure name and action are there if weird things happen
      saved.name = true;
      saved.action = true;
      return saved as Record<ColumnKey, boolean>;
    }
    return defaultCols as Record<ColumnKey, boolean>;
  }, [settings.uiConfig?.visibleColumns]);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(initialColumns);

  // Sync state if settings change
  useEffect(() => {
    setVisibleColumns(initialColumns);
  }, [initialColumns]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Filtering ---
  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const today = getToday();

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 2. Compact Search & Filters (Optimized for Mobile) */}
      <div className="glass-card p-3 md:p-5 rounded-2xl mb-4 md:mb-5 shrink-0">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar nombre, cédula..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-canvas border border-fg/8 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none text-fg transition-all text-sm placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-visible pr-1 sm:pr-0">
            {/* Control Filters - WRAPPED IN SCROLLABLE DIV ONLY */}
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex bg-fg/5 p-1 rounded-xl shrink-0 w-max gap-0.5">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${filterMode === 'ALL' ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg'}`}
                >
                  <ListFilter size={14} /> Todos
                </button>
                <button
                  onClick={() => setFilterMode('TODAY')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${filterMode === 'TODAY' ? 'bg-success/15 text-success shadow-soft' : 'text-muted hover:text-fg'}`}
                >
                  <CalendarCheck size={14} /> Hoy ({stats.paymentsTodayCount})
                </button>
                <button
                  onClick={() => setFilterMode('LATE')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${filterMode === 'LATE' ? 'bg-danger/12 text-danger shadow-soft' : 'text-muted hover:text-fg'}`}
                >
                  <AlertTriangle size={14} /> Mora
                </button>
                <button
                  onClick={() => setFilterMode('WAITING')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${filterMode === 'WAITING' ? 'bg-warning/15 text-warning shadow-soft' : 'text-muted hover:text-fg'}`}
                >
                  <Hourglass size={14} /> Espera
                </button>
              </div>
            </div>

            <div className="hidden md:block w-px h-6 bg-fg/10"></div>

            {/* Column Menu - OUTSIDE the scrollable part to fix clipping */}
            <div className="hidden md:flex relative z-[60]">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-surface border border-fg/8 text-fg rounded-xl font-bold text-xs hover:bg-canvas transition-colors whitespace-nowrap shadow-soft"
              >
                <Settings2 size={14} /> Columnas
              </button>

              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-2xl shadow-pop border border-fg/8 z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="text-xs font-bold text-muted uppercase px-2 py-1 mb-1">Mostrar Columnas</div>
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
                      className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl hover:bg-fg/5 text-fg transition-colors"
                    >
                      <span>{col.l}</span>
                      {visibleColumns[col.k as ColumnKey] ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-muted/40" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Rich Table (DESKTOP ONLY) & Cards (MOBILE ONLY) */}
      {/* NO blur on this scrolling container — would cause jank */}
      <div className="flex-1 bg-transparent md:bg-surface rounded-b-2xl md:border border-fg/5 shadow-soft overflow-hidden flex flex-col relative z-0">
        <div className="overflow-y-auto flex-1 scrollbar-thin">

          {/* MOBILE CARD LIST VIEW */}
          <div className="md:hidden pb-28">
            <PullToRefresh onRefresh={onRefresh || (async () => { })}>
              <div className="space-y-3 p-1">
                {filteredClients.map(client => {
                  const metrics = clientMetrics[client.id] || { balance: 0, totalInterest: 0, lastDate: null };
                  const balance = metrics.balance;
                  const isLate = !!client.nextPaymentDate && client.nextPaymentDate < getToday() && balance > 0;
                  const isWaitingFunds = (client.pendingRedirectionBalance || 0) > 0;

                  return (
                    <SwipeableItem
                      key={client.id}
                      onDelete={onDeleteClient ? () => onRequestDelete(client) : undefined}
                      onEdit={() => onSelectClient(client.id)}
                    >
                      <motion.div
                        onClick={() => onSelectClient(client.id)}
                        whileTap={{ scale: 0.975 }}
                        transition={{ duration: 0.12 }}
                        className={`bg-surface p-4 rounded-2xl border shadow-soft relative overflow-hidden
                        ${isLate ? 'border-l-4 border-l-danger border-y border-r border-fg/5' : isWaitingFunds ? 'border-l-4 border-l-warning border-y border-r border-fg/5' : 'border-l-4 border-l-primary border-y border-r border-fg/5'}
                      `}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-fg/5 text-fg/60 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg border border-fg/8">
                              {client.cardCode}
                            </span>
                            <h3 className="font-bold text-fg text-sm">{client.name}</h3>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-muted uppercase">Deuda</span>
                            <span className={`font-bold transition-all ${isLate ? 'text-danger' : 'text-fg'}`}>
                              {formatCurrency(balance)}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-muted mb-3">
                          <div className="flex items-center gap-1">
                            <CalendarCheck size={12} className="text-muted/60" />
                            <span>{client.nextPaymentDate || 'Sin fecha'}</span>
                            {isLate && <span className="bg-danger/10 text-danger px-1.5 rounded-md text-[10px] font-bold">MORA</span>}
                          </div>
                          {isWaitingFunds && (
                            <div className="flex items-center gap-1 text-warning font-bold bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                              <Hourglass size={10} /> Esperando
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-fg/5">
                          {can('create_transactions') ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'PAYMENT'); }}
                                className="flex-1 bg-success/10 text-success py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-success/15 active:scale-[0.97] transition-all duration-150 ease-out"
                              >
                                <DollarSign size={16} /> Abonar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'DISBURSEMENT'); }}
                                className="flex-1 bg-primary/8 text-primary py-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-primary/12 active:scale-[0.97] transition-all duration-150 ease-out"
                              >
                                <TrendingUp size={16} /> Prestar
                              </button>
                            </>
                          ) : (
                            <div className="flex-1 py-3 text-center text-[10px] text-muted font-bold uppercase flex items-center justify-center gap-1">
                              <Lock size={12} /> Bloqueado (Sin permisos)
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </SwipeableItem>
                  );
                })}
              </div>
            </PullToRefresh>
          </div>

          {/* DESKTOP TABLE VIEW */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead className="bg-canvas sticky top-0 z-10 shadow-soft">
              <tr>
                {visibleColumns.card && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider w-24 text-center">Tarjeta</th>}
                {visibleColumns.name && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider">Cliente</th>}
                {visibleColumns.guarantor && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider">Fiador</th>}
                {visibleColumns.contact && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider">Contacto</th>}
                {visibleColumns.last_activity && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider">Último Mov.</th>}
                {visibleColumns.profit && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider text-right">Rentabilidad</th>}
                {visibleColumns.limit && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider text-right">Cupo</th>}
                {visibleColumns.balance && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider text-right">Saldo / Deuda</th>}
                {visibleColumns.dates && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider">Próximo Pago</th>}
                {visibleColumns.status && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider text-center">Estado</th>}
                {visibleColumns.action && <th className="p-4 border-b border-fg/5 text-[11px] font-bold text-muted uppercase tracking-wider text-right w-40">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-fg/4">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="opacity-20" />
                      <span>No se encontraron resultados en esta vista.</span>
                      {filterMode !== 'ALL' && (
                        <button onClick={() => setFilterMode('ALL')} className="text-xs text-primary hover:underline">
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
                const isLate = !!client.nextPaymentDate && client.nextPaymentDate < getToday() && balance > 0;
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
                  ${isWaitingFunds ? 'bg-warning/5 border-warning hover:bg-warning/8' :
                        isLate ? 'bg-danger/5 border-danger hover:bg-danger/8' :
                          isPaid ? 'border-success hover:bg-success/5' :
                            'border-transparent hover:bg-primary/5'}`}
                  >

                    {visibleColumns.card && (
                      <td className="p-4 text-center">
                        <span className="inline-block px-2 py-1 bg-fg/5 rounded-lg text-xs font-mono font-bold text-fg/70 border border-fg/8 shadow-soft">
                          {client.cardCode}
                        </span>
                      </td>
                    )}

                    {visibleColumns.name && (
                      <td className="p-4">
                        <div className="font-bold text-fg text-sm group-hover:text-primary transition-colors">{client.name}</div>
                        {client.occupation && <div className="text-[10px] text-muted uppercase font-bold">{client.occupation}</div>}

                        {/* PRIORITY WAITING BADGE */}
                        {isWaitingFunds && (
                          <div className={`mt-1.5 flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-bold w-fit
                          ${remainingWait >= 0 ? 'bg-warning/10 text-warning border-warning/20' : 'bg-danger/10 text-danger border-danger/20 animate-pulse'}
                       `}>
                            <Hourglass size={12} className="shrink-0" />
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
                          <ShieldCheck size={14} className="text-muted shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-fg">{client.guarantorName}</div>
                            <div className="text-[10px] text-muted">{client.guarantorPhone}</div>
                          </div>
                        </div>
                      </td>
                    )}

                    {visibleColumns.contact && (
                      <td className="p-4">
                        <div className="text-xs font-mono text-fg/70 font-medium">{client.cedula}</div>
                        <div className="text-xs text-muted">{client.phone}</div>
                      </td>
                    )}

                    {visibleColumns.last_activity && (
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs text-fg/70">
                          <Clock size={12} className="text-muted" />
                          {metrics.lastDate ? metrics.lastDate : <span className="text-muted/40 italic">Sin mov.</span>}
                        </div>
                      </td>
                    )}

                    {visibleColumns.profit && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <BarChart3 size={12} className="text-success opacity-50" />
                          <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-lg border border-success/20 transition-all">
                            {formatCurrency(metrics.totalInterest)}
                          </span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.limit && (
                      <td className="p-4 text-right">
                        <div className="text-xs text-muted font-medium">{formatCurrency(client.loanLimit || 0)}</div>
                      </td>
                    )}

                    {visibleColumns.balance && (
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {balance > 0 ? (
                            <div className="text-right">
                              <div className={`font-bold text-sm transition-all ${isLate ? 'text-danger' : 'text-fg'}`}>
                                {formatCurrency(balance)}
                              </div>
                              {/* Mini Progress Bar of Debt vs Limit (Visual Cue) */}
                              {client.loanLimit && client.loanLimit > 0 && (
                                <div className="w-20 h-1 bg-fg/8 rounded-full ml-auto mt-1 overflow-hidden">
                                  <div className={`h-full rounded-full ${isLate ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${percentageUsed}%` }}></div>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {isWaitingFunds && (
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-bold text-muted uppercase tracking-tight">Por recibir</span>
                              <span className="text-sm font-bold text-warning transition-all">
                                {formatCurrency(client.pendingRedirectionBalance || 0)}
                              </span>
                            </div>
                          )}

                          {balance <= 0 && !isWaitingFunds && (
                            <div className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full inline-block border border-success/20">
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
                            <div className={`text-xs font-medium px-2 py-1 rounded-lg border ${isLate ? 'bg-danger/10 text-danger border-danger/20' : 'bg-fg/5 text-fg/70 border-fg/8'}`}>
                              {client.nextPaymentDate}
                            </div>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                          {isLate && <AlertTriangle size={14} className="text-danger animate-pulse" />}
                        </div>
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td className="p-4 text-center">
                        {isWaitingFunds ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 text-warning rounded-full text-[10px] font-bold border border-warning/20 shadow-soft">
                            En Espera
                          </span>
                        ) : client.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-full text-[10px] font-bold border border-success/20">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-fg/5 text-muted rounded-full text-[10px] font-bold border border-fg/8">
                            Inactivo
                          </span>
                        )}
                      </td>
                    )}

                    {visibleColumns.action && (
                      <td className="p-4 text-right">
                        <div className="flex gap-1 justify-end transition-opacity">
                          {/* Payment Button */}
                          {can('create_transactions') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'PAYMENT'); }}
                              className="bg-success/10 hover:bg-success text-success hover:text-white p-2 rounded-xl transition-colors border border-success/20 shadow-soft"
                              title="Registrar Pago"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}

                          {/* Redirection Button */}
                          {can('create_transactions') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'REDIRECT'); }}
                              className="bg-warning/10 hover:bg-warning text-warning hover:text-white p-2 rounded-xl transition-colors border border-warning/20 shadow-soft"
                              title="Redireccionar Pago"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                          )}

                          {/* Refinance/Disbursement Button */}
                          {can('create_transactions') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onQuickAction(client, 'DISBURSEMENT'); }}
                              className="bg-primary/8 hover:bg-primary text-primary hover:text-white p-2 rounded-xl transition-colors border border-primary/15 shadow-soft"
                              title="Refinanciar / Prestar"
                            >
                              <TrendingUp size={16} />
                            </button>
                          )}

                          {/* Delete Button (TRIGGER MODAL) */}
                          {onDeleteClient && can('delete_clients') && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRequestDelete(client); // Opens the safe modal
                              }}
                              className="bg-danger/8 hover:bg-danger text-danger hover:text-white p-2 rounded-xl transition-colors border border-danger/15 shadow-soft"
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
        <div className="p-2 border-t border-fg/5 bg-canvas text-[10px] text-muted text-center uppercase font-bold tracking-wider hidden md:block rounded-b-2xl">
          Mostrando {filteredClients.length} de {clients.length} clientes
        </div>
      </div>
    </div>
  );
};
