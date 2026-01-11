
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Settings, LogOut, Plus, Landmark, Folder,
  Wifi, Loader2, AlertTriangle, RefreshCw, Building2, Menu
} from 'lucide-react';
import { Client, Transaction, TransactionType, AppSettings, BankAccount, AppLog, TransactionFormInput } from './types';
import { ClientCard } from './components/ClientCard';
import { TransactionModal } from './components/TransactionModal';
import { AIChat } from './components/AIChat';
import { BankDashboard } from './components/BankDashboard';
import { ClientList } from './components/ClientList';
import { Sidebar } from './components/Sidebar';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { SettingsView } from './components/SettingsView';
import { ClientFormModal } from './components/ClientFormModal';
import { supabase, isConfigured } from './lib/supabaseClient';
import { useDataOperations } from './hooks/useDataOperations';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './components/AuthPage';
import { useOrganization } from './contexts/OrganizationContext';
import { useData } from './contexts/DataContext';
import { generateId, parseCurrency } from './utils/format';
import { calculateLoanProjection as calcProjection, calculateNextPaymentDate } from './services/loanUtils';

const App: React.FC = () => {
  // 1. Critical Configuration Check
  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border-t-4 border-red-500">
          <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
            <AlertTriangle size={48} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error de Configuración</h2>
          <p className="text-slate-600 mb-6">
            No se detectaron las credenciales de Supabase. La aplicación no puede iniciarse.
          </p>
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-left mb-6 text-xs font-mono text-red-800 overflow-auto">
            VITE_SUPABASE_URL<br />
            VITE_SUPABASE_ANON_KEY
          </div>
        </div>
      </div>
    );
  }

  const { user, loading: authLoading, signOut } = useAuth();
  const { currentOrg, isLoading: orgLoading, createOrganization, userRole } = useOrganization();

  // Use Centralized Data Context
  const {
    clients, transactions, bankAccounts, settings, systemLogs, loading: dataLoading, error: dataError,
    refreshData, setSettings
  } = useData();

  // --- Local UI State ---
  const [showOrgCreator, setShowOrgCreator] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Navigation State
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'CLIENTS_LIST' | 'SINGLE_CLIENT' | 'BANKS' | 'SETTINGS'>('CLIENTS_LIST');

  // Responsive Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  // Modals
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [transModalMode, setTransModalMode] = useState<'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT'>('PAYMENT');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Next Card Code State for Modal
  const [nextCardCode, setNextCardCode] = useState('');

  const addNotification = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initialize Operations Hook
  const dataOps = useDataOperations(addNotification);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        openNewClientModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bankAccounts, clients]);

  const activeClient = useMemo(() => clients.find(c => c.id === activeClientId) || null, [clients, activeClientId]);
  const activeTransactions = useMemo(() => {
    return transactions.filter(t => t.clientId === activeClientId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, activeClientId]);

  // --- ACTIONS ---

  const handleDeleteClientWrapper = async (client: Client) => {
    const success = await dataOps.deleteClient(client);
    if (success) {
      setActiveClientId(null);
      setCurrentView('CLIENTS_LIST');
    }
  };

  const handleUpdateClientWrapper = async (client: Client) => {
    await dataOps.updateClient(client);
  };

  const updateSettings = async (newSettings: AppSettings) => {
    if (!currentOrg) return;

    try {
      // 1. Optimistic Update (Immediate Feedback)
      setSettings(newSettings);

      const { id, ...cleanPayload } = newSettings as any;

      // MAPPING to Snake Case for DB
      const dbPayload = {
        organization_id: currentOrg.id,
        company_name: newSettings.companyName,
        default_interest_rate: newSettings.defaultInterestRate,
        use_openai: newSettings.useOpenAI,
        api_key: newSettings.apiKey,
        n8n_webhook_url: newSettings.n8nWebhookUrl,
        max_card_limit: newSettings.maxCardLimit,
        ai_provider: newSettings.aiProvider,
        ai_agent_name: newSettings.aiAgentName,
        ai_api_key: newSettings.aiApiKey,
        ai_system_prompt: newSettings.aiSystemPrompt
      };

      const { data: existingRows } = await supabase
        .from('settings')
        .select('id')
        .eq('organization_id', currentOrg.id)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        await supabase.from('settings').update(dbPayload).eq('id', existingRows[0].id);
      } else {
        await supabase.from('settings').insert(dbPayload);
      }
      addNotification("Configuración guardada.", 'success');
      dataOps.recordAudit('UPDATE', 'SETTINGS', 'Configuración actualizada', 'Cambios en ajustes generales');
    } catch (error: any) {
      addNotification("Error guardando: " + error.message, 'error');
      dataOps.recordAudit('UPDATE', 'SETTINGS', 'Error guardando config', error.message, 'ERROR');
    }
  };

  const handleClientSelection = (id: string) => {
    setActiveClientId(id);
    setCurrentView('SINGLE_CLIENT');
  };

  const handleAddAccount = async (acc: BankAccount) => {
    if (!currentOrg) return;
    const accWithOrg = { ...acc, organization_id: currentOrg.id };

    // We cannot optimistic set here because we removed local state setter access from App.
    // However, Realtime will pick it up instantly.
    // Or we use dataOps if we add createAccount there.
    // For now, let's just do Supabase insert.

    const { error } = await supabase.from('bank_accounts').insert(accWithOrg);

    if (!error) {
      dataOps.recordAudit('CREATE', 'BANK', `Nueva cuenta: ${acc.name}`, `Tipo: ${acc.isCash ? 'Efectivo' : 'Banco'}`);
      addNotification("Cuenta creada.", 'success');
    } else {
      addNotification(error.message, 'error');
    }
  }

  const handleTransactionSubmit = async (data: TransactionFormInput, receiptFile?: File | null) => {
    if (!activeClient) return false;
    return await dataOps.saveTransaction(data, activeClient, editingTransaction, receiptFile);
  };

  const openNewClientModal = () => {
    setEditingClient(null);

    const maxLimit = settings.maxCardLimit || 500;

    const activeCards = new Set(
      clients
        .filter(c => c.status === 'ACTIVE')
        .map(c => parseInt(c.cardCode))
        .filter(n => !isNaN(n))
    );

    let foundGap = 1;
    for (let i = 1; i <= maxLimit; i++) {
      if (!activeCards.has(i)) {
        foundGap = i;
        break;
      }
      if (i === maxLimit) foundGap = maxLimit + 1;
    }

    setNextCardCode(foundGap.toString());
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClient(client);
    setNextCardCode(client.cardCode);
    setIsClientModalOpen(true);
  };

  const handleCloseCredit = async () => {
    if (!activeClient) return;
    if (window.confirm('¿Está seguro de cerrar este crédito?')) {
      await dataOps.updateClient({ ...activeClient, status: 'INACTIVE' });
      addNotification("Crédito cerrado.", 'success');
    }
  };

  const handleClientSubmit = async (formData: any) => {
    const parsedLoanLimit = parseCurrency(formData.loanLimit);
    const parsedInitialAmount = parseCurrency(formData.initialAmount);

    const loanProjection = calcProjection({
      initialAmount: formData.initialAmount,
      interestRate: formData.interestRate,
      loanTermMonths: formData.loanTermMonths,
      paymentFrequency: formData.paymentFrequency,
      interestType: formData.interestType
    });

    if (editingClient) {
      const updated = {
        ...editingClient,
        name: formData.name,
        cardCode: formData.cardCode,
        phone: formData.phone,
        cedula: formData.cedula,
        address: formData.address,
        occupation: formData.occupation,
        workAddress: formData.workAddress,
        guarantorName: formData.guarantorName,
        guarantorPhone: formData.guarantorPhone,
        collateral: formData.collateral,
        notes: formData.notes,
        referrerId: formData.referrerId,
        interestRate: parseFloat(formData.interestRate) || 0,
        paymentFrequency: formData.paymentFrequency,
        interestType: formData.interestType,
        loanTermMonths: parseInt(formData.loanTermMonths) || 1,
        installmentAmount: loanProjection?.quota,
        installmentsCount: loanProjection?.totalInstallments
      };
      await dataOps.updateClient(updated);
    } else {
      const newId = generateId();

      const calculatedNextPayment = calculateNextPaymentDate(formData.creditStartDate, formData.paymentFrequency);

      const newClient: Client = {
        id: newId,
        organization_id: currentOrg?.id,
        name: formData.name,
        cardCode: formData.cardCode,
        cedula: formData.cedula,
        phone: formData.phone,
        address: formData.address,
        occupation: formData.occupation,
        workAddress: formData.workAddress,
        guarantorName: formData.guarantorName,
        guarantorPhone: formData.guarantorPhone,
        collateral: formData.collateral,
        creditStartDate: formData.creditStartDate,
        loanLimit: parsedLoanLimit || undefined,
        referrerId: formData.referrerId || undefined,
        status: 'ACTIVE',
        notes: formData.notes,
        createdAt: Date.now(),
        nextPaymentDate: calculatedNextPayment,
        pendingRedirectionBalance: (formData.hasInitialLoan && formData.isRedirection) ? parsedInitialAmount : 0,
        redirectionWaitDays: (formData.hasInitialLoan && formData.isRedirection) ? Number(formData.redirectionWaitDays) : undefined,
        interestRate: parseFloat(formData.interestRate) || 0,
        paymentFrequency: formData.paymentFrequency,
        interestType: formData.interestType,
        loanTermMonths: parseInt(formData.loanTermMonths) || 1,
        installmentsCount: loanProjection?.totalInstallments,
        installmentAmount: loanProjection?.quota
      };

      let initialTx = undefined;

      if (formData.hasInitialLoan && formData.initialAmount && !formData.isRedirection) {
        initialTx = {
          id: generateId(),
          organization_id: currentOrg?.id,
          clientId: newId,
          date: formData.creditStartDate,
          type: TransactionType.DISBURSEMENT,
          amount: parsedInitialAmount,
          interestPaid: 0,
          capitalPaid: 0,
          balanceAfter: parsedInitialAmount,
          notes: 'Desembolso Inicial (Tesorería)',
          bankAccountId: formData.initialBankId || undefined,
          createdAt: Date.now()
        };
      }

      await dataOps.createClient(newClient, initialTx);
    }
    setIsClientModalOpen(false);
  };

  const openTransactionModal = (mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT' = 'PAYMENT') => {
    setEditingTransaction(null);
    setTransModalMode(mode);
    setIsTransModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTransModalMode(tx.type === TransactionType.DISBURSEMENT ? 'DISBURSEMENT' : 'PAYMENT');
    setIsTransModalOpen(true);
  };

  const handleQuickAction = (client: Client, mode: 'PAYMENT' | 'DISBURSEMENT' | 'REDIRECT') => {
    setActiveClientId(client.id);
    setEditingTransaction(null);
    setTransModalMode(mode);
    setIsTransModalOpen(true);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName) return;
    const result = await createOrganization(newOrgName);

    if (result.success) {
      setShowOrgCreator(false);
      addNotification("Organización creada exitosamente.", 'success');
      dataOps.recordAudit('CREATE', 'SYSTEM', `Organización creada: ${newOrgName}`, 'Usuario inicializó empresa');
    } else {
      addNotification(`Error al crear: ${result.error}`, 'error');
    }
  };

  const handleViewChange = (view: any) => {
    setCurrentView(view);
    setActiveClientId(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // --- AUTH & LOADING STATES ---
  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 flex-col gap-6">
        <img src="/logo-dark.png" alt="PrestaFlow" className="h-20 w-auto object-contain animate-pulse" />
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Iniciando sistema seguro...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // --- FIRST TIME USER ONBOARDING ---
  if (!currentOrg && !dataLoading && !orgLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center animate-in zoom-in-95 border border-slate-200">
          <img src="/logo-light.png" alt="PrestaFlow Logo" className="h-16 w-auto object-contain mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Bienvenido a PrestaFlow</h2>
          <p className="text-slate-500 mb-8">Para comenzar, crea tu primera organización o negocio corporativo.</p>

          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Negocio</label>
              <input
                autoFocus
                required
                type="text"
                className="w-full border border-slate-300 bg-white text-slate-900 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Inversiones Global, Prestamos Rápidos..."
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transition-colors flex justify-center items-center gap-2">
              <Plus size={20} /> Crear Organización
            </button>
            <button type="button" onClick={signOut} className="text-sm text-slate-400 hover:text-slate-600">Cerrar Sesión</button>
          </form>
        </div>
      </div>
    );
  }

  // --- LOADING SCREEN ---
  // Only show if clients are empty to allow transparent refreshing
  if (dataLoading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
        <Loader2 size={48} className="text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">
          Sincronizando datos de {currentOrg?.name}...
        </p>
      </div>
    );
  }

  // --- ERROR SCREEN ---
  if (dataError) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border-t-4 border-red-500">
          <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
            <AlertTriangle size={48} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error de Conexión</h2>
          <p className="text-slate-600 mb-6">
            {dataError}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
              <RefreshCw size={18} /> Reintentar
            </button>
            <button onClick={signOut} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2 rounded-lg font-bold transition-colors">
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Mobile Backdrop */}
      {isSidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        currentView={currentView}
        onChangeView={handleViewChange}
        companyName={settings.companyName}
        userRole={userRole}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>

            <div className="text-slate-500 text-sm font-medium truncate flex-1">
              {currentView === 'SINGLE_CLIENT' && activeClient && (
                <span className="flex items-center gap-2 text-blue-900 font-bold bg-blue-50 px-3 py-1 rounded-full animate-in fade-in truncate max-w-[200px] sm:max-w-none">
                  <Users size={16} className="shrink-0" /> <span className="truncate">{activeClient.name}</span>
                </span>
              )}
              {currentView === 'BANKS' && (
                <span className="flex items-center gap-2 text-green-900 font-bold bg-green-50 px-3 py-1 rounded-full animate-in fade-in">
                  <Landmark size={16} /> <span className="hidden sm:inline">Tesorería</span><span className="sm:hidden">Bancos</span>
                </span>
              )}
              {currentView === 'CLIENTS_LIST' && (
                <span className="flex items-center gap-2 text-slate-900 font-bold animate-in fade-in">
                  <Folder size={16} /> <span className="hidden sm:inline">Gestión de Cartera</span><span className="sm:hidden">Clientes</span>
                </span>
              )}
              {currentView === 'SETTINGS' && (
                <span className="flex items-center gap-2 text-slate-900 font-bold animate-in fade-in">
                  <Settings size={16} /> <span className="hidden sm:inline">Configuración del Sistema</span><span className="sm:hidden">Ajustes</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="text-slate-400 text-xs italic hidden md:block">
              <span className="px-2 py-1 rounded-full text-[10px] font-bold mr-2 border flex inline-flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
                <Wifi size={10} /> ONLINE
              </span>
              {currentOrg?.name}
            </div>

            <button
              onClick={signOut}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-6 overflow-hidden bg-slate-100 relative w-full">
          {currentView === 'CLIENTS_LIST' && (
            <ClientList
              clients={clients}
              transactions={transactions}
              onSelectClient={handleClientSelection}
              onNewClient={openNewClientModal}
              onQuickAction={handleQuickAction}
              n8nWebhookUrl={settings.n8nWebhookUrl}
              onDeleteClient={handleDeleteClientWrapper}
            />
          )}

          {currentView === 'SINGLE_CLIENT' && activeClient && (
            <ClientCard
              client={activeClient}
              transactions={activeTransactions}
              allClients={clients}
              onAddTransaction={openTransactionModal}
              onBack={() => { setActiveClientId(null); setCurrentView('CLIENTS_LIST'); }}
              onUpdateClient={handleUpdateClientWrapper}
              onEditClient={openEditClientModal}
              onCloseCredit={handleCloseCredit}
              onDeleteClient={handleDeleteClientWrapper}
              onDeleteTransaction={dataOps.deleteTransaction}
              onEditTransaction={handleEditTransaction}
            />
          )}

          {currentView === 'BANKS' && (
            <BankDashboard
              accounts={bankAccounts}
              transactions={transactions}
              onAddAccount={handleAddAccount}
              onInternalMovement={dataOps.createBankMovement}
            />
          )}

          {currentView === 'SETTINGS' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              systemLogs={systemLogs}
              onClearLogs={() => {/* DataContext doesn't allow clear yet */ }}
              onAddNotification={addNotification}
            />
          )}

        </main>
      </div>

      <AIChat activeClient={activeClient} transactions={activeTransactions} />

      <ClientFormModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSubmit={handleClientSubmit}
        editingClient={editingClient}
        bankAccounts={bankAccounts}
        allClients={clients}
        nextCardCode={nextCardCode}
        maxCardLimit={settings.maxCardLimit}
      />

      {isTransModalOpen && activeClient && (
        <TransactionModal
          isOpen={isTransModalOpen}
          onClose={() => setIsTransModalOpen(false)}
          onSubmit={handleTransactionSubmit}
          activeClient={activeClient}
          allClients={clients}
          bankAccounts={bankAccounts}
          initialMode={transModalMode}
          editingTransaction={editingTransaction}
          clientTransactions={transactions.filter(t => t.clientId === activeClient.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
        />
      )}
    </div>
  );
};
export default App;
