
import { supabase } from '../lib/supabaseClient';
import { Transaction, TransactionType } from '../types';

/**
 * Helper to ensure safe arithmetic (prevents -0 and floating point errors for currency)
 */
const safeAdd = (a: number, b: number) => Math.round((a + b) * 100) / 100;

/**
 * Recalculates the running balance for a specific client based on their transaction history.
 * AUDIT IMPROVEMENT: Deterministic sorting and organization_id preservation.
 * 
 * @param clientId The ID of the client.
 * @param currentTransactionsList The full list of transactions (used to filter for the specific client).
 * @returns The updated list of transactions for that client with correct balances.
 */
export const recalculateClientTransactions = async (clientId: string, currentTransactionsList: Transaction[]) => {
  // 1. Get all transactions for this client
  const clientTx = currentTransactionsList
    .filter(t => t.clientId === clientId)
    .sort((a, b) => {
        // Primary Sort: Date
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        
        // Secondary Sort: CreatedAt Timestamp (Critical for same-day operations)
        // If createdAt is missing, fallback to 0 to avoid NaN sort issues
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;

        // Tertiary Sort: ID (Deterministic tie-breaker)
        return a.id.localeCompare(b.id);
    });

  // 2. Recalculate running balance
  let runningBalance = 0;
  
  const updatedClientTx = clientTx.map(t => {
      let change = 0;
      // Ensure number safety against strings or undefined
      const amount = Number(t.amount) || 0; 

      switch (t.type) {
          case TransactionType.DISBURSEMENT:
          case TransactionType.REFINANCE:
          case TransactionType.REDIRECT_IN: // Receiving money increases debt
              change = amount;
              break;
              
          case TransactionType.PAYMENT_CAPITAL:
          case TransactionType.REDIRECT_OUT: // Sending money (paying someone else) reduces debt
              change = -amount;
              break;
              
          case TransactionType.SETTLEMENT:
              // Settlement reduces balance to 0, or reduces by specific amount if partial.
              // Logic: Usually settlements are "payments" to close debt.
              change = -amount; 
              break;
              
          case TransactionType.PAYMENT_INTEREST:
              // Interest payments do NOT affect capital balance in this model
              change = 0;
              break;
              
          default:
              change = 0;
      }
      
      runningBalance = safeAdd(runningBalance, change);
      
      // Force 0 if very close to 0 (floating point dust)
      if (Math.abs(runningBalance) < 0.01) runningBalance = 0;
      
      // Return transaction with updated balance AND ensure organization_id is preserved for RLS
      return { 
        ...t, 
        balanceAfter: runningBalance,
        // Fallback for legacy data without org_id, though createClient should catch this
        organization_id: t.organization_id 
      };
  });

  // 3. Update Supabase
  // We perform an upsert to ensure all calculated balances are saved to the backend.
  // In a high-scale production app, we would only update rows where balanceAfter changed.
  if (updatedClientTx.length > 0) {
      // Sanitize payload: Map camelCase TS types to snake_case DB types
      const cleanPayload = updatedClientTx.map((tx) => {
          const { id, organization_id, clientId, date, type, amount, interestPaid, capitalPaid, balanceAfter, notes, relatedTransactionId, relatedClientId, bankAccountId, receiptUrl, createdAt } = tx;
          
          return {
              id, 
              organization_id, 
              clientId, 
              date, 
              type, 
              amount, 
              interestPaid, 
              capitalPaid, 
              balanceAfter, 
              notes, 
              relatedTransactionId, 
              relatedClientId, 
              bankAccountId, 
              receiptUrl,
              created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString() // MAP createdAt -> created_at
          };
      });

      const { error } = await supabase.from('transactions').upsert(cleanPayload);
      
      if (error) {
        console.error("Error recalculating balances in DB:", error);
        // Don't throw immediately to allow UI to show state, but log specific error
        throw new Error(`Sync Error: ${error.message}`);
      }
  }

  return updatedClientTx;
};
