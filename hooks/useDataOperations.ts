
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Client, Transaction, BankAccount, TransactionType, TransactionFormInput, AppLog } from '../types';
import { recalculateClientTransactions } from '../services/transactionService';
import { generateId, getToday, getErrorMessage } from '../utils/format';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { hasPermission } from '../utils/permissions';

export const useDataOperations = (addNotification: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    // 1. TOP LEVEL HOOKS (Correct!)
    const {
        clients, setClients,
        transactions, setTransactions,
        bankAccounts, setBankAccounts,
        addLog
    } = useData();

    const [isOperationLoading, setIsOperationLoading] = useState(false);
    const { currentOrg, userRole } = useOrganization();
    const { user } = useAuth();

    const getOrgId = () => {
        if (!currentOrg) return null;
        return currentOrg.id;
    };

    const validateConfig = () => {
        if (!currentOrg || !user) {
            addNotification("Seguridad: Sesión de organización inválida.", 'error');
            return false;
        }
        return true;
    };

    // --- INTERNAL: AUDIT LOGGER HELPER ---
    const recordAudit = (
        action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SYSTEM',
        entity: 'CLIENT' | 'TRANSACTION' | 'SETTINGS' | 'BANK' | 'AUTH' | 'SYSTEM',
        message: string,
        details?: string,
        level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'SUCCESS'
    ) => {
        addLog(action, entity, message, details, level);
    };

    // --- HELPER: Bank Updates ---
    const updateBankBalance = async (bankId: string, amountChange: number) => {
        const bank = bankAccounts.find(b => b.id === bankId);
        if (!bank) return;

        const newBalance = bank.balance + amountChange;

        // Optimistic Update UI
        setBankAccounts(prev => prev.map(b => b.id === bankId ? { ...b, balance: newBalance } : b));

        // Production Sync
        const { error } = await supabase
            .from('bank_accounts')
            .update({ balance: newBalance })
            .eq('id', bankId);

        if (error) {
            console.error("Error sync banco:", error);
            const msg = getErrorMessage(error);
            recordAudit('SYSTEM', 'BANK', "Fallo de integridad bancaria", msg, 'ERROR');
            setBankAccounts(prev => prev.map(b => b.id === bankId ? { ...b, balance: bank.balance } : b));
            throw error;
        }
    };

    // --- HELPER: File Upload ---
    const uploadReceipt = async (file: File): Promise<string | null> => {
        try {
            const orgId = getOrgId() || 'public';
            const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
            const validExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];

            if (!validExts.includes(fileExt)) {
                throw new Error("Archivo no permitido. Solo imágenes o PDF.");
            }

            if (file.size > 5 * 1024 * 1024) {
                throw new Error("El archivo excede el límite de 5MB.");
            }

            const year = new Date().getFullYear();
            const fileName = `${orgId}/${year}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error: any) {
            addNotification(error.message, 'error');
            return null;
        }
    };

    // ============================================================================
    // GESTIÓN DE CLIENTES
    // ============================================================================

    const deleteClient = async (clientToDelete: Client) => {
        if (!validateConfig()) return false;
        if (!hasPermission(userRole, 'delete_clients')) {
            addNotification("No tienes permisos para eliminar clientes.", 'error');
            return false;
        }

        setIsOperationLoading(true);
        const previousClients = [...clients];
        const previousTransactions = [...transactions];

        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        setTransactions(prev => prev.filter(t => t.clientId !== clientToDelete.id));

        try {
            const { error } = await supabase.from('clients').delete().eq('id', clientToDelete.id);
            if (error) throw error;
            recordAudit('DELETE', 'CLIENT', `Cliente eliminado: ${clientToDelete.name}`);
            addNotification('Cliente eliminado exitosamente.', 'success');
            return true;
        } catch (error: any) {
            setClients(previousClients);
            setTransactions(previousTransactions);
            const errorMsg = getErrorMessage(error);
            addNotification(`Error al eliminar: ${errorMsg}`, 'error');
            return false;
        } finally {
            setIsOperationLoading(false);
        }
    };

    const updateClient = async (updatedClient: Client) => {
        if (!validateConfig()) return false;
        if (!hasPermission(userRole, 'edit_clients')) {
            addNotification("No tienes permisos para editar datos sensibles.", 'error');
            return false;
        }

        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));

        try {
            const { collateral, createdAt, ...safePayload } = updatedClient as any;
            if (collateral) safePayload.notes = (safePayload.notes || "") + ` [Garantía: ${collateral}]`;

            const { error } = await supabase.from('clients').update(safePayload).eq('id', updatedClient.id);
            if (error) throw error;
            recordAudit('UPDATE', 'CLIENT', `Datos actualizados: ${updatedClient.name}`);
            return true;
        } catch (error: any) {
            addNotification(`Error de sincronización: ${getErrorMessage(error)}`, 'error');
            return false;
        }
    };

    const createClient = async (newClient: Client, initialTransaction?: Transaction) => {
        if (!validateConfig()) return false;
        if (!hasPermission(userRole, 'create_clients')) {
            addNotification("No tienes permisos para crear clientes.", 'error');
            return false;
        }

        setIsOperationLoading(true);
        const orgId = getOrgId();
        const clientWithOrg = { ...newClient, organization_id: orgId || undefined };

        try {
            const { collateral, createdAt, ...clientPayload } = clientWithOrg as any;
            const { error: clientError } = await supabase.from('clients').insert(clientPayload);
            if (clientError) throw clientError;

            if (initialTransaction) {
                const txWithOrg = { ...initialTransaction, organization_id: orgId, created_at: new Date().toISOString() };
                const { error: txError } = await supabase.from('transactions').insert(txWithOrg);
                if (txError) throw txError;

                if (initialTransaction.bankAccountId) {
                    await updateBankBalance(initialTransaction.bankAccountId, -initialTransaction.amount);
                }
            }

            recordAudit('CREATE', 'CLIENT', `Nuevo cliente registrado: ${newClient.name}`);
            addNotification("Cliente registrado exitosamente.", 'success');
            return true;
        } catch (error: any) {
            addNotification(`Error registrando cliente: ${getErrorMessage(error)}`, 'error');
            return false;
        } finally {
            setIsOperationLoading(false);
        }
    };

    const deleteTransaction = async (txToDelete: Transaction) => {
        if (!validateConfig()) return false;
        if (!hasPermission(userRole, 'delete_transactions')) {
            addNotification("Solo Propietarios pueden eliminar transacciones.", 'error');
            return false;
        }

        setIsOperationLoading(true);
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', txToDelete.id);
            if (error) throw error;

            if (txToDelete.bankAccountId) {
                const isOutgoing = [TransactionType.DISBURSEMENT, TransactionType.REFINANCE].includes(txToDelete.type as TransactionType);
                const reversalAmount = isOutgoing ? txToDelete.amount : -(txToDelete.amount + (txToDelete.interestPaid || 0));
                await updateBankBalance(txToDelete.bankAccountId, reversalAmount);
            }

            const remainingTxs = transactions.filter(t => t.id !== txToDelete.id);
            await recalculateClientTransactions(txToDelete.clientId, remainingTxs);

            const amountFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(txToDelete.amount);
            recordAudit('DELETE', 'TRANSACTION', `Transacción eliminada: ${amountFmt}`, `Tipo: ${txToDelete.type} | ID: ${txToDelete.id}`);

            addNotification("Transacción eliminada.", 'success');
            return true;
        } catch (error: any) {
            addNotification("Error eliminando: " + getErrorMessage(error), 'error');
            return false;
        } finally {
            setIsOperationLoading(false);
        }
    };

    const saveTransaction = async (data: TransactionFormInput, activeClient: Client, editingTransaction: Transaction | null, receiptFile?: File | null) => {
        if (!validateConfig()) return false;
        setIsOperationLoading(true);

        try {
            let finalReceiptUrl = data.receiptUrl;
            if (receiptFile) {
                const uploadedUrl = await uploadReceipt(receiptFile);
                if (uploadedUrl) finalReceiptUrl = uploadedUrl;
            }

            const txId = editingTransaction ? editingTransaction.id : generateId();
            const transactionData: Transaction = {
                id: txId,
                organization_id: getOrgId() || undefined,
                clientId: activeClient.id,
                date: data.date,
                type: data.type,
                amount: Number(data.amount),
                interestPaid: Number(data.interest) || 0,
                capitalPaid: (data.type === TransactionType.PAYMENT_CAPITAL) ? Number(data.amount) : 0,
                balanceAfter: 0,
                notes: data.notes || '',
                bankAccountId: data.bankAccountId,
                receiptUrl: finalReceiptUrl,
                createdAt: editingTransaction?.createdAt || Date.now()
            };

            const { createdAt: txCreated, ...safeTxPayload } = transactionData as any;
            const dbPayload = { ...safeTxPayload, created_at: new Date(txCreated).toISOString() };

            const { error } = await supabase.from('transactions').upsert(dbPayload);
            if (error) throw error;

            if (data.bankAccountId) {
                const isOutgoing = [TransactionType.DISBURSEMENT, TransactionType.REFINANCE].includes(data.type);
                const newVal = isOutgoing ? -data.amount : data.amount + (data.interest || 0);
                await updateBankBalance(data.bankAccountId, newVal);
            }

            await recalculateClientTransactions(activeClient.id, [...transactions, transactionData]);

            const actionType = editingTransaction ? 'UPDATE' : 'CREATE';
            const amountFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.amount);
            recordAudit(actionType, 'TRANSACTION', `${actionType === 'CREATE' ? 'Nueva' : 'Edición'} Transacción: ${amountFmt}`, `Cliente: ${activeClient.name} | Tipo: ${data.type}`);

            addNotification("Transacción procesada.", 'success');
            return true;
        } catch (error: any) {
            addNotification("Error: " + getErrorMessage(error), 'error');
            return false;
        } finally {
            setIsOperationLoading(false);
        }
    };

    const createBankMovement = async (accountId: string, amount: number, type: 'DEPOSIT' | 'WITHDRAWAL', note: string, receiptFile?: File | null) => {
        if (!validateConfig()) return false;
        setIsOperationLoading(true);

        try {
            const movementType = type === 'DEPOSIT' ? 1 : -1;
            await updateBankBalance(accountId, amount * movementType);

            const tx: Transaction = {
                id: generateId(),
                organization_id: getOrgId() || undefined,
                clientId: 'BANK_INTERNAL',
                date: getToday(),
                type: type === 'DEPOSIT' ? 'BANK_DEPOSIT' as any : 'BANK_WITHDRAWAL' as any,
                amount: amount,
                interestPaid: 0,
                capitalPaid: 0,
                balanceAfter: 0,
                notes: note,
                bankAccountId: accountId,
                createdAt: Date.now()
            };

            const { createdAt: txCreated, ...safeTx } = tx as any;
            await supabase.from('transactions').insert({ ...safeTx, created_at: new Date(txCreated).toISOString() });

            const amountFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
            recordAudit('CREATE', 'BANK', `Movimiento Bancario: ${amountFmt}`, `Cuenta: ${accountId} | Nota: ${note}`);

            addNotification("Movimiento registrado.", 'success');
            return true;
        } catch (e: any) {
            addNotification(`Error: ${getErrorMessage(e)}`, 'error');
            return false;
        } finally {
            setIsOperationLoading(false);
        }
    };

    return {
        deleteClient,
        updateClient,
        createClient,
        deleteTransaction,
        saveTransaction,
        createBankMovement,
        isOperationLoading,
        uploadReceipt,
        recordAudit
    };
};
