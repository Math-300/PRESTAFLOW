// Pestaña "Resumen" de la Cartera: agenda (a cobrar hoy / en mora),
// KPIs (capital, ganancia, clientes activos, cobro rápido, mora+notificar, nuevo cliente)
// y mensajería masiva a morosos. Lógica relocalizada desde ClientList.tsx (sin cambios).
import React, { useState } from 'react';
import { Client, AppSettings } from '../../types';
import {
  CalendarCheck, AlertTriangle, DollarSign, Wallet, TrendingUp, Zap,
  ChevronRight, CreditCard, Megaphone, UserCheck, Users, Plus,
} from 'lucide-react';
import { CarteraDerived } from './types';

interface ResumenTabProps {
  settings: AppSettings;
  derived: CarteraDerived;
  n8nWebhookUrl?: string;
  can: (permissionSlug: string) => boolean;
  onSelectClient: (id: string) => void;
  onQuickAction: (client: Client, mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => void;
  onNewClient: () => void;
  onOpenQuickSearch: () => void;
  // Permite que la agenda navegue a la pestaña Clientes con un filtro aplicado.
  onGoToFilter: (mode: 'TODAY' | 'LATE') => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
};

export const ResumenTab: React.FC<ResumenTabProps> = ({
  settings, derived, n8nWebhookUrl, can,
  onSelectClient, onQuickAction, onNewClient, onOpenQuickSearch, onGoToFilter,
}) => {
  const { clientMetrics, stats, lateClientsList, dueTodayList } = derived;
  const [isSendingMassMsg, setIsSendingMassMsg] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  // --- Mass Messaging Handler ---
  const handleMassNotification = async () => {
    if (!n8nWebhookUrl) {
      alert("⚠️ Error: No has configurado la URL del Webhook de n8n en Configuración.");
      return;
    }
    // Validate the webhook is a well-formed HTTPS URL before sending client PII to it
    let validatedWebhook: URL;
    try {
      validatedWebhook = new URL(n8nWebhookUrl);
      if (validatedWebhook.protocol !== 'https:') throw new Error('protocol');
    } catch {
      alert("⚠️ Error: La URL del Webhook de n8n no es válida. Debe ser una URL HTTPS.");
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
      const response = await fetch(validatedWebhook.toString(), {
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
    <div className="flex flex-col">
      {/* 0. AGENDA / AVISOS: a cobrar hoy y en mora (accionable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6 shrink-0">
        {/* A COBRAR HOY */}
        <div className="glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 font-black text-sm uppercase tracking-tight">
              <CalendarCheck size={18} /> A cobrar hoy
            </div>
            <span className="text-xs font-black bg-blue-600 text-white rounded-full px-2.5 py-0.5">{dueTodayList.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {dueTodayList.length === 0 ? (
              <div className="px-4 py-5 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin cobros para hoy ✓</div>
            ) : (
              dueTodayList.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <button onClick={() => onSelectClient(c.id)} className="flex-1 text-left min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs font-black text-slate-900">{formatCurrency(clientMetrics[c.id]?.balance || 0)}</div>
                  </button>
                  {can('create_transactions') && (
                    <button onClick={() => onQuickAction(c, 'PAYMENT')} className="shrink-0 bg-blue-600 text-white text-[11px] font-black px-3 py-1.5 rounded-lg hover:bg-blue-700 active:scale-95 transition-all">Cobrar</button>
                  )}
                </div>
              ))
            )}
            {dueTodayList.length > 4 && (
              <button onClick={() => onGoToFilter('TODAY')} className="w-full px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors">
                Ver los {dueTodayList.length} <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* EN MORA */}
        <div className="glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-2 text-red-700 font-black text-sm uppercase tracking-tight">
              <AlertTriangle size={18} /> En mora
            </div>
            <span className="text-xs font-black bg-red-600 text-white rounded-full px-2.5 py-0.5">{lateClientsList.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {lateClientsList.length === 0 ? (
              <div className="px-4 py-5 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Nadie en mora ✓</div>
            ) : (
              lateClientsList.slice(0, 4).map(c => {
                const daysLate = Math.max(0, Math.round((new Date(today).getTime() - new Date(c.nextPaymentDate!).getTime()) / 86400000));
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <button onClick={() => onSelectClient(c.id)} className="flex-1 text-left min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{c.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-red-600">{formatCurrency(clientMetrics[c.id]?.balance || 0)}</span>
                        <span className="text-[10px] font-bold text-red-400">{daysLate} {daysLate === 1 ? 'día' : 'días'}</span>
                      </div>
                    </button>
                    {can('create_transactions') && (
                      <button onClick={() => onQuickAction(c, 'PAYMENT')} className="shrink-0 bg-red-600 text-white text-[11px] font-black px-3 py-1.5 rounded-lg hover:bg-red-700 active:scale-95 transition-all">Cobrar</button>
                    )}
                  </div>
                );
              })
            )}
            {lateClientsList.length > 4 && (
              <button onClick={() => onGoToFilter('LATE')} className="w-full px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors">
                Ver los {lateClientsList.length} <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. Dashboard Metrics (Horizontal Scroll on Mobile) */}
      <div className="flex overflow-x-auto md:grid md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 shrink-0 pb-3 md:pb-0 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {settings.uiConfig?.dashboardCards?.portfolio !== false && (
          <div className="min-w-[280px] md:min-w-0 bg-slate-900 text-white p-4 md:p-4 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden group shrink-0 md:shrink">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80} /></div>
            <div className="flex items-center gap-1 md:gap-2 mb-1 text-slate-300">
              <Wallet size={16} /> <span className="text-[10px] md:text-xs font-bold uppercase">Capital en la Calle</span>
            </div>
            <div className={`text-lg md:text-2xl font-bold transition-all ${settings.uiConfig?.privacyMode ? 'filter blur-md select-none' : ''}`}>
              {settings.uiConfig?.privacyMode ? '$ ••••••' : formatCurrency(stats.totalPortfolio)}
            </div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">{stats.totalActive} clientes</div>
          </div>
        )}

        {settings.uiConfig?.dashboardCards?.profit !== false && (
          <div className="min-w-[280px] md:min-w-0 bg-emerald-600 text-white p-4 md:p-4 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden group shrink-0 md:shrink">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={80} /></div>
            <div className="flex items-center gap-1 md:gap-2 mb-1 text-emerald-100">
              <Zap size={16} /> <span className="text-[10px] md:text-xs font-bold uppercase">Ganancia Estimada</span>
            </div>
            <div className={`text-lg md:text-2xl font-bold transition-all ${settings.uiConfig?.privacyMode ? 'filter blur-md select-none' : ''}`}>
              {settings.uiConfig?.privacyMode ? '$ ••••••' : formatCurrency(stats.totalInterestPortfolio)}
            </div>
            <div className="text-[10px] md:text-xs text-emerald-100/70 mt-0.5">Intereses generados</div>
          </div>
        )}

        {settings.uiConfig?.dashboardCards?.activeClients !== false && (
          <div className="min-w-[200px] md:min-w-0 bg-white p-4 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden group shrink-0 md:shrink">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Users size={60} /></div>
            <div className="flex items-center gap-1 md:gap-2 mb-1 text-slate-500">
              <UserCheck size={16} /> <span className="text-[10px] md:text-xs font-bold uppercase">Clientes Activos</span>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-extrabold text-slate-800">{stats.totalActive}</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">En cartera vigente</div>
            </div>
          </div>
        )}

        {/* PROFESSIONAL QUICK ACTION CARD */}
        {/* PROFESSIONAL QUICK ACTION CARD (HIDDEN ON MOBILE - MOVED TO BOTTOM NAV) */}
        {can('create_transactions') && settings.uiConfig?.dashboardCards?.quickPay !== false && (
          <div
            className="hidden md:flex min-w-[200px] md:min-w-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 md:p-4 rounded-xl shadow-lg flex-col justify-between cursor-pointer hover:shadow-xl transition-all transform hover:-translate-y-1 relative overflow-hidden group md:shrink"
            onClick={onOpenQuickSearch}
          >
            <div className="absolute right-0 bottom-0 opacity-10 p-2"><Zap size={80} /></div>
            <div className="flex items-center gap-2 mb-1 text-emerald-100">
              <CreditCard size={16} /> <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Cobro Rápido</span>
            </div>
            <div>
              <div className="text-md md:text-xl font-bold flex items-center gap-1">
                Cobrar <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="text-[10px] md:text-xs text-emerald-100 mt-0.5 opacity-90 hidden md:block">Clic aquí o presione 'P'</div>
            </div>
          </div>
        )}

        {/* LATE CLIENTS & MASS ACTION */}
        <div className="min-w-[200px] md:min-w-0 bg-white p-4 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden shrink-0 md:shrink">
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

        {/* NEW CLIENT (HIDDEN ON MOBILE - MOVED TO FAB) */}
        {can('create_clients') && (
          <div className="hidden md:flex min-w-[200px] md:min-w-0 bg-blue-50 p-4 md:p-4 rounded-xl border border-blue-100 shadow-sm flex-col justify-center items-center text-center cursor-pointer hover:bg-blue-100 transition-colors group md:shrink" onClick={onNewClient}>
            <div className="bg-blue-600 text-white p-2 md:p-3 rounded-full mb-1 shadow-lg shadow-blue-200 group-hover:rotate-90 transition-transform duration-300">
              <Plus size={18} />
            </div>
            <span className="font-bold text-blue-900 text-xs md:text-sm">Nuevo Cliente</span>
          </div>
        )}
      </div>
    </div>
  );
};
