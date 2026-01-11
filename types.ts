
export enum TransactionType {
  DISBURSEMENT = 'DISBURSEMENT', // Money given to client (creates debt)
  REFINANCE = 'REFINANCE', // Adding money to existing debt (Re-tanqueo)
  PAYMENT_CAPITAL = 'PAYMENT_CAPITAL', // Payment reducing principal
  PAYMENT_INTEREST = 'PAYMENT_INTEREST', // Payment for interest only
  REDIRECT_OUT = 'REDIRECT_OUT', // This client PAYS, but money goes to Another Client (Reduces This Client's debt)
  REDIRECT_IN = 'REDIRECT_IN', // This client RECEIVES money from Another Client (Increases This Client's debt)
  SETTLEMENT = 'SETTLEMENT', // Closing the credit manually
}

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'BAD_DEBT';
export type UserRole = 'owner' | 'admin' | 'member';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  owner_id?: string;
  created_at?: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  // Joined profile data for UI
  profile?: UserProfile;
  created_at?: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  invited_email: string;
  invited_by_user_id: string; // Added to match DB
  role: UserRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired'; // Lowercase to match DB enum/check
  expires_at?: string; // Added to match DB
  created_at: string;
}

export interface BankAccount {
  id: string;
  organization_id?: string;
  name: string; // e.g., "Bancolombia Ahorros"
  accountNumber: string;
  balance: number;
  isCash: boolean; // true if it is "Efectivo" or "Caja Menor"
}

export interface Client {
  id: string;
  organization_id?: string;
  cardCode: string; // "Tarjeta Numero XX"
  cedula: string; // National ID
  name: string;
  phone: string;
  address: string;
  occupation?: string;
  workAddress?: string;
  loanLimit?: number;
  referrerId?: string; // Who referred this client?

  // Credit Lifecycle
  status: ClientStatus;
  creditStartDate: string; // YYYY-MM-DD
  nextPaymentDate?: string; // YYYY-MM-DD

  // Financial Configuration
  interestRate?: number; // Monthly percentage (e.g. 5 for 5%)
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  interestType?: 'FIXED' | 'DIMINISHING'; // Fijo sobre capital inicial vs Sobre Saldos
  loanTermMonths?: number; // Total duration in months
  installmentsCount?: number; // Total number of payments calculated
  installmentAmount?: number; // The fixed quota value

  // Redirection / Funding Logic
  pendingRedirectionBalance?: number; // How much money this client is WAITING to receive
  redirectionWaitDays?: number; // Days promised to wait for funds

  guarantorName: string;
  guarantorPhone: string;
  collateral?: string; // Description of the collateral/guarantee (Prenda)
  notes: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  organization_id?: string;
  clientId: string; // Can be 'BANK_INTERNAL' for non-client movements
  date: string; // YYYY-MM-DD
  type: TransactionType | 'BANK_DEPOSIT' | 'BANK_WITHDRAWAL';
  amount: number;
  interestPaid: number;
  capitalPaid: number;
  balanceAfter: number; // Client balance after
  notes: string;

  // Relationships
  relatedTransactionId?: string;
  relatedClientId?: string;

  // Bank Integration
  bankAccountId?: string; // Which bank was affected?

  // Proof / Support
  receiptUrl?: string; // URL to the image/pdf in storage

  // Audit
  createdAt?: number; // Timestamp for precise sorting
}

// DTO for Forms
export interface TransactionFormInput {
  type: TransactionType;
  amount: number;
  interest: number;
  date: string;
  nextPaymentDate?: string;
  notes: string;
  targetClientId?: string;
  bankAccountId?: string;
  newCardCode?: string;
  receiptUrl?: string;
  // Simulator props
  installmentAmount?: number;
  installmentsCount?: number;
  interestRate?: number;
  loanTermMonths?: number;
  paymentFrequency?: any;
  interestType?: any;
  pendingRedirectionBalance?: number;
  redirectionWaitDays?: number;
}

export interface AppSettings {
  id?: string; // UUID in DB
  organization_id?: string;
  companyName: string;
  defaultInterestRate: number;
  useOpenAI: boolean;
  apiKey?: string;
  n8nWebhookUrl?: string; // URL for mass messaging automation
  maxCardLimit?: number; // NEW: Maximum number of physical cards (e.g., 500)

  // AI Agent Configuration
  aiProvider?: 'GEMINI' | 'SUPABASE' | 'OPENAI';
  aiApiKey?: string;
  aiAgentName?: string;
  aiSystemPrompt?: string;
}

// ENHANCED AUDIT LOG
export interface AppLog {
  id: string;
  timestamp: string; // ISO String for better sorting
  displayTime: string; // Human readable
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;

  // Audit Fields
  actor: string; // User email or name
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SYSTEM';
  entity: 'CLIENT' | 'TRANSACTION' | 'SETTINGS' | 'BANK' | 'AUTH' | 'SYSTEM';
  details?: string; // JSON string or detailed text
}
