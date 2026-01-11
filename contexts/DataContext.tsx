
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    Client, Transaction, BankAccount, AppSettings, AppLog
} from '../types';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';
import { createLog } from '../services/auditService';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DataContextType {
    clients: Client[];
    transactions: Transaction[];
    bankAccounts: BankAccount[];
    settings: AppSettings;
    systemLogs: AppLog[];

    loading: boolean;
    error: string | null;

    // Actions
    refreshData: () => Promise<void>;
    addLog: (action: AppLog['action'], entity: AppLog['entity'], message: string, details?: string, level?: AppLog['level']) => void;

    // Optimistic Setters (Internal use)
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { currentOrg } = useOrganization();

    const [clients, setClients] = useState<Client[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [systemLogs, setSystemLogs] = useState<AppLog[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- HELPER: Add Log ---
    const addLog = useCallback((action: AppLog['action'], entity: AppLog['entity'], message: string, details?: string, level: AppLog['level'] = 'INFO') => {
        const newLog = createLog(user?.email || 'Sistema', action, entity, message, details, level, currentOrg?.id);
        setSystemLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep local buffer small
    }, [user, currentOrg]);

    // --- FETCHER ---
    const fetchData = useCallback(async () => {
        if (!currentOrg) return;

        setLoading(true);
        setError(null);
        try {
            console.log(`[DataContext] Fetching for ${currentOrg.name}`);

            const [settingsRes, clientsRes, txRes, banksRes, logsRes] = await Promise.all([
                supabase.from('settings').select('*').eq('organization_id', currentOrg.id).limit(1).maybeSingle(),
                supabase.from('clients').select('*').eq('organization_id', currentOrg.id).limit(2000),
                supabase.from('transactions').select('*').eq('organization_id', currentOrg.id).limit(2000),
                supabase.from('bank_accounts').select('*').eq('organization_id', currentOrg.id).limit(50),
                supabase.from('audit_logs').select('*').eq('organization_id', currentOrg.id).order('created_at', { ascending: false }).limit(50)
            ]);

            if (settingsRes.error) throw settingsRes.error;
            if (clientsRes.error) throw clientsRes.error;
            if (txRes.error) throw txRes.error;
            if (logsRes.error && logsRes.error.code !== '42P01') {
                // Ignore table missing error (42P01) for logs, as it might not be created yet 
                console.warn("Could not fetch logs:", logsRes.error);
            }

            if (settingsRes.data) {
                const s = settingsRes.data;
                const mappedSettings: AppSettings = {
                    id: s.id,
                    organization_id: s.organization_id,
                    // Robust mapping: check snake_case first (DB standard), then camelCase (legacy/bug fallback)
                    companyName: s.company_name || s.companyName || currentOrg.name,
                    defaultInterestRate: s.default_interest_rate || s.defaultInterestRate || 5,
                    useOpenAI: s.use_openai || s.useOpenAI || false,
                    apiKey: s.api_key || s.apiKey,
                    n8nWebhookUrl: s.n8n_webhook_url || s.n8nWebhookUrl,
                    maxCardLimit: s.max_card_limit || s.maxCardLimit || 500,
                    // AI Fields
                    aiProvider: s.ai_provider || s.aiProvider || 'GEMINI',
                    aiApiKey: s.ai_api_key || s.aiApiKey,
                    aiAgentName: s.ai_agent_name || s.aiAgentName || 'LuchoBot',
                    aiSystemPrompt: s.ai_system_prompt || s.aiSystemPrompt
                };
                setSettings(mappedSettings);
            } else {
                setSettings({
                    companyName: currentOrg.name,
                    defaultInterestRate: 5,
                    useOpenAI: false,
                    maxCardLimit: 500,
                    aiProvider: 'GEMINI',
                    aiAgentName: 'LuchoBot'
                } as AppSettings);
            }

            setClients(clientsRes.data || []);
            setTransactions(txRes.data || []);
            setBankAccounts(banksRes.data || []);
            if (logsRes.data) {
                // Map DB logs to AppLog
                const mappedLogs: AppLog[] = logsRes.data.map((l: any) => ({
                    id: l.id,
                    timestamp: l.created_at,
                    displayTime: new Date(l.created_at).toLocaleTimeString(),
                    level: l.level,
                    message: l.message,
                    actor: l.actor,
                    action: l.action,
                    entity: l.entity,
                    details: l.details
                }));
                setSystemLogs(mappedLogs);
            }

        } catch (err: any) {
            console.error("[DataContext] Error loading data:", err);
            setError(err.message || 'Error cargando datos');
        } finally {
            setLoading(false);
        }
    }, [currentOrg]);

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        if (!currentOrg) return;

        let channel: RealtimeChannel;

        const setupSubscription = () => {
            channel = supabase.channel(`org-db-changes-${currentOrg.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'clients', filter: `organization_id=eq.${currentOrg.id}` },
                    (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setClients(prev => {
                                if (prev.find(c => c.id === payload.new.id)) return prev; // Dedupe
                                return [...prev, payload.new as Client];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            setClients(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...(payload.new as Client) } : c));
                        } else if (payload.eventType === 'DELETE') {
                            setClients(prev => prev.filter(c => c.id !== payload.old.id));
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'transactions', filter: `organization_id=eq.${currentOrg.id}` },
                    (payload) => {
                        // We only react to INSERT/DELETE for the list, Updates are tricky because of balance recalc
                        // ideally we just refetch specific client data or assume the trigger handles it, 
                        // but for now, we just sync the list state. The `recalculate` logic in Hook is still authoritative for balance.
                        if (payload.eventType === 'INSERT') {
                            setTransactions(prev => {
                                if (prev.find(t => t.id === payload.new.id)) return prev;
                                return [...prev, payload.new as Transaction];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            setTransactions(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...(payload.new as Transaction) } : t));
                        } else if (payload.eventType === 'DELETE') {
                            setTransactions(prev => prev.filter(t => t.id !== payload.old.id));
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'bank_accounts', filter: `organization_id=eq.${currentOrg.id}` },
                    (payload) => {
                        if (payload.eventType === 'UPDATE') {
                            setBankAccounts(prev => prev.map(b => b.id === payload.new.id ? { ...b, ...(payload.new as BankAccount) } : b));
                        } else if (payload.eventType === 'INSERT') {
                            setBankAccounts(prev => [...prev, payload.new as BankAccount]);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'settings', filter: `organization_id=eq.${currentOrg.id}` },
                    (payload) => {
                        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                            const s = payload.new as any;
                            const mappedSettings: AppSettings = {
                                id: s.id,
                                organization_id: s.organization_id,
                                // Robust mapping: check snake_case first (DB standard), then camelCase (legacy/bug fallback)
                                companyName: s.company_name || s.companyName || 'PrestaFlow',
                                defaultInterestRate: s.default_interest_rate || s.defaultInterestRate || 5,
                                useOpenAI: s.use_openai || s.useOpenAI || false,
                                apiKey: s.api_key || s.apiKey,
                                n8nWebhookUrl: s.n8n_webhook_url || s.n8nWebhookUrl,
                                maxCardLimit: s.max_card_limit || s.maxCardLimit || 500,
                                // AI Fields
                                aiProvider: s.ai_provider || s.aiProvider || 'GEMINI',
                                aiApiKey: s.ai_api_key || s.aiApiKey,
                                aiAgentName: s.ai_agent_name || s.aiAgentName || 'LuchoBot',
                                aiSystemPrompt: s.ai_system_prompt || s.aiSystemPrompt
                            };
                            setSettings(mappedSettings);
                        }
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [currentOrg]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Initial Settings Default
    const safeSettings = useMemo(() => settings || {
        companyName: 'PrestaFlow',
        defaultInterestRate: 5,
        useOpenAI: false,
        maxCardLimit: 500
    }, [settings]);

    return (
        <DataContext.Provider value={{
            clients,
            transactions,
            bankAccounts,
            settings: safeSettings,
            systemLogs,
            loading,
            error,
            refreshData: fetchData,
            addLog,
            // Expose Setters
            setClients,
            setTransactions,
            setBankAccounts,
            setSettings
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
