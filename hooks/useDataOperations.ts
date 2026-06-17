
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Client, Transaction, BankAccount, TransactionType, TransactionFormInput, AppLog } from '../types';
import { recalculateClientTransactions } from '../services/transactionService';
import { calculateNextPaymentDate } from '../services/loanUtils';
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
    const updateBankBalance = async (bankId: string, amountChange: number, allowNegative = false) => {
        const bank = bankAccounts.find(b => b.id === bankId);
        if (!bank) return;

        const optimistic = bank.balance + amountChange;

        // Guard rápido en cliente (la RPC vuelve a validarlo server-side).
        if (!allowNegative && optimistic < 0) {
            throw new Error("Fondos insuficientes en la cuenta para esta operación.");
        }

        // Optimistic Update UI
        setBankAccounts(prev => prev.map(b => b.id === bankId ? { ...b, balance: optimistic } : b));

        // Production Sync ATÓMICO: la RPC hace `balance = balance + delta` en la BD
        // (evita perder movimientos concurrentes) y devuelve el saldo autoritativo.
        const { data, error } = await supabase.rpc('bump_bank_balance', {
            p_bank_id: bankId,
            p_delta: amountChange,
            p_allow_negative: allowNegative,
        });

        if (error) {
            console.error("Error sync banco:", error);
            const msg = getErrorMessage(error);
            recordAudit('SYSTEM', 'BANK', "Fallo de integridad bancaria", msg, 'ERROR');
            setBankAccounts(prev => prev.map(b => b.id === bankId ? { ...b, balance: bank.balance } : b));
            throw error;
        }

        // Corrige el optimista con el saldo real devuelto por la BD.
        if (typeof data === 'number') {
            setBankAccounts(prev => prev.map(b => b.id === bankId ? { ...b, balance: data } : b));
        }
    };

    // --- HELPER: Patch puntual de campos de un cliente (optimista + DB) ---
    // No pasa por updateClient para no exigir el permiso `edit_clients` en
    // operaciones de cobro (avanzar fecha de pago, conciliar redirección). RLS
    // sigue gobernando el acceso; si el usuario no tiene permiso, la transacción
    // principal NO se revierte (solo se registra una advertencia).
    const patchClientFields = async (clientId: string, fields: Partial<Client>) => {
        const prevClients = clients;
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...fields } : c));
        const { error } = await supabase.from('clients').update(fields).eq('id', clientId);
        if (error) {
            console.error("Error actualizando cliente:", error);
            recordAudit('SYSTEM', 'CLIENT', "No se pudo actualizar el cliente", getErrorMessage(error), 'WARNING');
            setClients(prevClients);
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

            // SEGURIDAD: el bucket es privado. Guardamos el PATH (no una URL
            // pública permanente); al mostrar se genera una signed URL temporal.
            return fileName;
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
                // Quitar createdAt (camelCase) antes de insertar: la tabla transactions
                // usa created_at (snake). Si se filtra, PostgREST devuelve 400 y el
                // desembolso inicial del cliente nuevo no se registra.
                const { createdAt: _initTxCreated, ...initialTxClean } = initialTransaction as any;
                const txWithOrg = { ...initialTxClean, organization_id: orgId, created_at: new Date().toISOString() };
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
                // Reversión: se permite saldo negativo para no bloquear el borrado.
                await updateBankBalance(txToDelete.bankAccountId, reversalAmount, true);
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

        // Validación de rango: monto positivo, sin overflow, interés no negativo.
        const amountNum = Number(data.amount);
        const interestNum = Number(data.interest) || 0;
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            addNotification("El monto debe ser un número positivo.", 'error');
            return false;
        }
        if (amountNum > 1_000_000_000_000) {
            addNotification("El monto excede el límite permitido.", 'error');
            return false;
        }
        if (!Number.isFinite(interestNum) || interestNum < 0) {
            addNotification("El interés no puede ser negativo.", 'error');
            return false;
        }

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
                // Enlace a la contraparte cuando este cliente redirige un pago a otro.
                relatedClientId: (data.type === TransactionType.REDIRECT_OUT) ? data.targetClientId : (editingTransaction?.relatedClientId),
                relatedTransactionId: editingTransaction?.relatedTransactionId,
                createdAt: editingTransaction?.createdAt || Date.now()
            };

            const { createdAt: txCreated, ...safeTxPayload } = transactionData as any;
            const dbPayload = { ...safeTxPayload, created_at: new Date(txCreated).toISOString() };

            const { error } = await supabase.from('transactions').upsert(dbPayload);
            if (error) throw error;

            const isOutgoingType = (t: TransactionType | 'BANK_DEPOSIT' | 'BANK_WITHDRAWAL') =>
                [TransactionType.DISBURSEMENT, TransactionType.REFINANCE].includes(t as TransactionType);

            if (editingTransaction) {
                // FIX #1: al EDITAR, la fila se reemplaza vía upsert pero el efecto
                // bancario del monto ANTERIOR seguía aplicado → la caja duplicaba el
                // delta. Revertimos el viejo y aplicamos el nuevo, AGREGANDO por
                // cuenta: si es la misma cuenta, un solo update (updateBankBalance lee
                // el saldo del estado en memoria, que no se refresca entre llamadas).
                const deltas: Record<string, number> = {};
                if (editingTransaction.bankAccountId) {
                    const oldReversal = isOutgoingType(editingTransaction.type)
                        ? editingTransaction.amount
                        : -(editingTransaction.amount + (editingTransaction.interestPaid || 0));
                    deltas[editingTransaction.bankAccountId] = (deltas[editingTransaction.bankAccountId] || 0) + oldReversal;
                }
                if (data.bankAccountId) {
                    const newVal = isOutgoingType(data.type) ? -data.amount : data.amount + (data.interest || 0);
                    deltas[data.bankAccountId] = (deltas[data.bankAccountId] || 0) + newVal;
                }
                for (const [bankId, delta] of Object.entries(deltas)) {
                    if (delta !== 0) await updateBankBalance(bankId, delta, true);
                }
            } else if (data.bankAccountId) {
                const newVal = isOutgoingType(data.type) ? -data.amount : data.amount + (data.interest || 0);
                await updateBankBalance(data.bankAccountId, newVal);
            }

            await recalculateClientTransactions(activeClient.id, [...transactions, transactionData]);

            // FIX #3: avanzar la fecha de próximo pago del cliente. Antes nunca se
            // persistía → tras el primer vencimiento todo cliente activo quedaba en
            // "mora" permanente y se rompían filtros de cobro/notificaciones.
            const SCHEDULED_TYPES: TransactionType[] = [
                TransactionType.PAYMENT_CAPITAL,
                TransactionType.PAYMENT_INTEREST,
                TransactionType.DISBURSEMENT,
                TransactionType.REFINANCE,
            ];
            // Tipos de PAGO recurrente: al registrarlos, la cuota se considera cubierta
            // y el próximo vencimiento debe avanzar una frecuencia (semanal/diario/etc).
            const PAYMENT_TYPES: TransactionType[] = [
                TransactionType.PAYMENT_CAPITAL,
                TransactionType.PAYMENT_INTEREST,
            ];
            if (!editingTransaction && SCHEDULED_TYPES.includes(data.type)) {
                // 1) Si el usuario fijó la fecha a mano en el formulario, esa manda.
                let nextDate = data.nextPaymentDate;
                // 2) Si no, y es un pago de cuota, la calculamos automáticamente
                //    desde la fecha del pago según la frecuencia del cliente.
                if (!nextDate && PAYMENT_TYPES.includes(data.type) && activeClient.paymentFrequency) {
                    nextDate = calculateNextPaymentDate(data.date || getToday(), activeClient.paymentFrequency);
                }
                if (nextDate && nextDate !== activeClient.nextPaymentDate) {
                    await patchClientFields(activeClient.id, { nextPaymentDate: nextDate });
                }
            }

            // FIX #2: registrar la contraparte de una redirección. El cliente activo
            // PAGA (REDIRECT_OUT, ya guardado, reduce su deuda) y el dinero va a OTRO
            // cliente, cuya deuda debe AUMENTAR (REDIRECT_IN) y su saldo en espera
            // debe bajar. Antes solo se guardaba el lado del pagador → el dinero
            // desaparecía de los libros del receptor.
            if (!editingTransaction && data.type === TransactionType.REDIRECT_OUT && data.targetClientId) {
                const target = clients.find(c => c.id === data.targetClientId);
                if (target) {
                    const inboundTx: Transaction = {
                        id: generateId(),
                        organization_id: getOrgId() || undefined,
                        clientId: target.id,
                        date: data.date,
                        type: TransactionType.REDIRECT_IN,
                        amount: Number(data.amount),
                        interestPaid: 0,
                        capitalPaid: 0,
                        balanceAfter: 0,
                        notes: `Redirección recibida de ${activeClient.name}`,
                        relatedClientId: activeClient.id,
                        relatedTransactionId: txId,
                        createdAt: Date.now(),
                    };
                    const { createdAt: inCreated, ...safeIn } = inboundTx as any;
                    const { error: inErr } = await supabase.from('transactions').insert({ ...safeIn, created_at: new Date(inCreated).toISOString() });
                    if (inErr) throw inErr;

                    // Recalcular saldos del cliente receptor incluyendo la entrada.
                    await recalculateClientTransactions(target.id, [...transactions, transactionData, inboundTx]);

                    // Bajar el saldo en espera de redirección del receptor.
                    const remainingPending = Math.max(0, (target.pendingRedirectionBalance || 0) - Number(data.amount));
                    await patchClientFields(target.id, { pendingRedirectionBalance: remainingPending });
                }
            }

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

        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 1_000_000_000_000) {
            addNotification("El monto del movimiento debe ser un número positivo válido.", 'error');
            return false;
        }

        setIsOperationLoading(true);

        try {
            let receiptPath: string | undefined;
            if (receiptFile) { const uploaded = await uploadReceipt(receiptFile); if (uploaded) receiptPath = uploaded; }

            const movementType = type === 'DEPOSIT' ? 1 : -1;
            await updateBankBalance(accountId, amount * movementType);

            const tx: Transaction = {
                id: generateId(),
                organization_id: getOrgId() || undefined,
                // Movimiento interno: sin cliente. Antes era 'BANK_INTERNAL', que
                // violaba la FK transactions.clientId→clients(id) y hacía fallar el
                // insert (el saldo cambiaba pero el movimiento no se registraba).
                // El tipo BANK_DEPOSIT/BANK_WITHDRAWAL ya identifica el movimiento.
                clientId: null as any,
                date: getToday(),
                type: type === 'DEPOSIT' ? 'BANK_DEPOSIT' as any : 'BANK_WITHDRAWAL' as any,
                amount: amount,
                interestPaid: 0,
                capitalPaid: 0,
                balanceAfter: 0,
                notes: note,
                bankAccountId: accountId,
                receiptUrl: receiptPath,
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
