// Tipos compartidos para la vista Cartera (CarteraView + ResumenTab + ClientesTab).
import { Client } from '../../types';

// Columnas toggleables de la tabla de Clientes.
export type ColumnKey =
  | 'card' | 'name' | 'guarantor' | 'contact' | 'last_activity'
  | 'profit' | 'balance' | 'limit' | 'dates' | 'status' | 'action';

// Métricas derivadas por cliente (saldo, intereses, último movimiento).
export interface ClientMetric {
  balance: number;
  totalInterest: number;
  lastDate: string | null;
}

export type ClientMetrics = Record<string, ClientMetric>;

// KPIs agregados de la cartera.
export interface CarteraStats {
  totalActive: number;
  paymentsTodayCount: number;
  lateClientsCount: number;
  totalPortfolio: number;
  totalInterestPortfolio: number;
}

// Derivaciones compartidas calculadas una sola vez en CarteraView.
export interface CarteraDerived {
  clientMetrics: ClientMetrics;
  stats: CarteraStats;
  lateClientsList: Client[];
  dueTodayList: Client[];
}
