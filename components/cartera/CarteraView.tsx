// Contenedor de la vista Cartera. Mantiene EXACTAMENTE la misma firma de 11 props
// que tenía ClientList (cambio transparente para App.tsx) y reparte la UI en dos
// pestañas internas: "Resumen" (KPIs + agenda + mensajería masiva) y
// "Clientes" (buscador + filtros + tabla + cards móvil).
//
// Responsabilidades del contenedor:
//  - Estado de pestaña activa (default 'resumen').
//  - Cálculo ÚNICO (useMemo) de las derivaciones compartidas de clients/transactions.
//  - Estado de filtro (compartido para que la agenda en Resumen pueda saltar a Clientes).
//  - Modal global de confirmación de borrado + FAB móvil "Nuevo Cliente".
import React, { useState, useMemo } from 'react';
import { Client, Transaction, AppSettings } from '../../types';
import { getToday } from '../../utils/format';
import { AlertTriangle, Plus, LayoutDashboard, Users } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Tabs } from '../ui/Tabs';
import { CardStatsSkeleton, TableSkeleton } from '../ui/Skeleton';
import { ResumenTab } from './ResumenTab';
import { ClientesTab } from './ClientesTab';
import { CarteraDerived } from './types';

interface CarteraViewProps {
  clients: Client[];
  transactions: Transaction[];
  onSelectClient: (id: string) => void;
  onNewClient: () => void;
  onQuickAction: (client: Client, mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => void;
  n8nWebhookUrl?: string;
  onDeleteClient?: (client: Client) => void;
  isLoading?: boolean;
  settings: AppSettings;
  onOpenQuickSearch: () => void;
  onRefresh?: () => Promise<void>;
}

export const CarteraView: React.FC<CarteraViewProps> = ({
  clients, transactions, onSelectClient, onNewClient, onQuickAction,
  n8nWebhookUrl, onDeleteClient, isLoading, settings, onOpenQuickSearch, onRefresh
}) => {
  const { can } = useOrganization();

  const [activeTab, setActiveTab] = useState<'resumen' | 'clientes'>('resumen');

  // Filtro compartido: vive en el contenedor para que la agenda (Resumen) pueda
  // saltar a la pestaña Clientes con el filtro ya aplicado.
  const [filterMode, setFilterMode] = useState<'ALL' | 'TODAY' | 'LATE' | 'WAITING'>('ALL');

  // Custom Confirmation Modal State (global a la vista).
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // --- Advanced Calculations (Memoized) — calculado UNA sola vez y compartido. ---
  const derived = useMemo<CarteraDerived>(() => {
    const today = getToday();
    const activeClients = clients.filter(c => c.status === 'ACTIVE');

    // Group transactions by client
    const txByClient: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      if (!txByClient[t.clientId]) txByClient[t.clientId] = [];
      txByClient[t.clientId].push(t);
    });

    const metrics: Record<string, { balance: number, totalInterest: number, lastDate: string | null }> = {};
    let totalPortfolio = 0;
    let totalInterestPortfolio = 0;

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
        totalInterestPortfolio += interests;
      }
    });

    // 2. Metrics
    const paymentsTodayCount = activeClients.filter(c => c.nextPaymentDate === today).length;

    // Clientes a cobrar HOY (con saldo pendiente).
    const dueTodayList = activeClients.filter(c => {
      const bal = metrics[c.id]?.balance || 0;
      return c.nextPaymentDate === today && bal > 0;
    });

    // Filter Late Clients
    const lateList = activeClients.filter(c => {
      const bal = metrics[c.id]?.balance || 0;
      return c.nextPaymentDate && c.nextPaymentDate < today && bal > 0;
    }).sort((a, b) => (a.nextPaymentDate || '').localeCompare(b.nextPaymentDate || '')); // más atrasados primero

    return {
      clientMetrics: metrics,
      lateClientsList: lateList,
      dueTodayList,
      stats: { totalActive: activeClients.length, paymentsTodayCount, lateClientsCount: lateList.length, totalPortfolio, totalInterestPortfolio }
    };
  }, [clients, transactions]);

  // La agenda de Resumen puede saltar a Clientes con un filtro aplicado.
  const handleGoToFilter = (mode: 'TODAY' | 'LATE') => {
    setFilterMode(mode);
    setActiveTab('clientes');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">

      {isLoading ? (
        <>
          <CardStatsSkeleton />
          <div className="bg-surface p-6 rounded-2xl border border-fg/5 shadow-soft">
            <TableSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* Pestañas internas Resumen / Clientes */}
          <div className="shrink-0 mb-3 md:mb-5">
            <Tabs
              tabs={[
                { key: 'resumen', label: 'Resumen', icon: <LayoutDashboard size={16} /> },
                { key: 'clientes', label: 'Clientes', icon: <Users size={16} /> },
              ]}
              activeKey={activeTab}
              onChange={(k) => setActiveTab(k as 'resumen' | 'clientes')}
            />
          </div>

          {activeTab === 'resumen' ? (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <ResumenTab
                settings={settings}
                derived={derived}
                n8nWebhookUrl={n8nWebhookUrl}
                can={can}
                onSelectClient={onSelectClient}
                onQuickAction={onQuickAction}
                onNewClient={onNewClient}
                onOpenQuickSearch={onOpenQuickSearch}
                onGoToFilter={handleGoToFilter}
              />
            </div>
          ) : (
            <ClientesTab
              clients={clients}
              settings={settings}
              derived={derived}
              can={can}
              onSelectClient={onSelectClient}
              onQuickAction={onQuickAction}
              onDeleteClient={onDeleteClient}
              onRequestDelete={setClientToDelete}
              onRefresh={onRefresh}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
            />
          )}
        </>
      )}

      {/* --- CONFIRMATION MODAL (SAFE DELETE) --- */}
      {clientToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-pop max-w-sm w-full overflow-hidden border border-fg/8 animate-in zoom-in-95 duration-200">
            <div className="bg-danger/8 p-6 flex flex-col items-center text-center border-b border-danger/15">
              <div className="bg-danger/15 p-3 rounded-full mb-4">
                <AlertTriangle size={32} className="text-danger" />
              </div>
              <h3 className="text-xl font-bold text-fg">¿Eliminar Cliente?</h3>
              <p className="text-sm text-muted mt-2">
                Vas a eliminar permanentemente a <strong className="text-fg">{clientToDelete.name}</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="p-4 bg-surface flex gap-3">
              <button
                onClick={() => setClientToDelete(null)}
                className="flex-1 py-3 bg-fg/6 text-fg font-bold rounded-xl hover:bg-fg/10 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onDeleteClient) onDeleteClient(clientToDelete);
                  setClientToDelete(null);
                }}
                className="flex-1 py-3 bg-danger text-white font-bold rounded-xl hover:opacity-90 active:opacity-80 transition-all shadow-soft text-sm"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {can('create_clients') && (
        <button
          onClick={onNewClient}
          className="md:hidden fixed right-6 w-14 h-14 bg-primary text-white rounded-full shadow-pop flex items-center justify-center active:scale-95 transition-transform z-50 ring-4 ring-surface"
          style={{ bottom: 'calc(80px + var(--safe-area-bottom))' }}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};
