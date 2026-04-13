import api from './axios';

export interface Inventory {
  id: number;
  total_jars: number;
  available_jars: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface StaffInventory {
  id: number;
  staff_id: number;
  assigned_jars: number;
  empty_collected: number;
  updated_at: string;
  staff_name?: string;
}

export interface InventoryLog {
  id: number;
  type: 'add' | 'assign' | 'return' | 'delivered' | 'damaged';
  quantity: number;
  reference_id: number | null;
  note: string | null;
  created_by: number | null;
  actor_name: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  customer_id: number;
  order_id: number | null;
  amount: number;
  mode: 'cash' | 'online' | 'advance';
  type: 'credit' | 'debit';
  collected_by: number | null;
  status: 'pending' | 'completed';
  note: string | null;
  created_at: string;
  customer_name?: string;
  staff_name?: string;
}

export interface TransactionStats {
  total_collected: number;
  cash_total: number;
  online_total: number;
  pending_total: number;
  total_count: number;
}

export interface CashSubmission {
  id: number;
  staff_id: number;
  total_cash: number;
  note: string | null;
  status: 'pending' | 'verified' | 'rejected';
  verified_by: number | null;
  submitted_at: string;
  verified_at: string | null;
  staff_name?: string;
}

export interface CashHolding {
  staff_id: number;
  staff_name: string;
  staff_phone: string;
  cash_in_hand: number;
  transaction_count: number;
}

export const inventoryApi = {
  get: () =>
    api.get<{ inventory: Inventory; staffInventory: StaffInventory[] }>('/inventory'),

  addStock: (quantity: number, note?: string) =>
    api.post('/inventory/add', { quantity, note }),

  assignJars: (staffId: number, quantity: number) =>
    api.post('/inventory/assign', { staffId, quantity }),

  returnJars: (quantity: number) =>
    api.post('/inventory/return', { quantity }),

  reportDamaged: (quantity: number, note: string) =>
    api.post('/inventory/damaged', { quantity, note }),

  getLogs: (limit?: number) =>
    api.get<{ logs: InventoryLog[] }>('/inventory/logs', { params: { limit } }),

  getTransactions: (params?: Record<string, string>) =>
    api.get<{ transactions: Transaction[]; stats: TransactionStats | null }>(
      '/inventory/transactions', { params }
    ),

  submitCash: (totalCash: number, note?: string) =>
    api.post('/inventory/cash/submit', { totalCash, note }),

  getCashSubmissions: (params?: Record<string, string>) =>
    api.get<{ submissions: CashSubmission[] }>('/inventory/cash', { params }),

  getCashHoldings: () =>
    api.get<{ holdings: CashHolding[] }>('/inventory/cash/holdings'),

  verifyCash: (id: number, action: 'verified' | 'rejected') =>
    api.patch(`/inventory/cash/${id}/verify`, { action }),
};

