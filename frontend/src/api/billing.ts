import api from './axios';

export interface Bill {
  id: number;
  customer_id: number;
  month: string;
  total_jars: number;
  jar_rate: number;
  subtotal: number;
  previous_pending: number;
  advance_used: number;
  total_amount: number;
  paid_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  due_date: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

export interface RevenuePoint {
  date?: string;
  month?: string;
  total: number;
  cash: number;
  online: number;
  count: number;
}

export interface RevenueSummary {
  today: number;
  this_month: number;
  all_time: number;
  cash_total: number;
  online_total: number;
  total_pending: number;
}

export interface PendingCustomer {
  id: number;
  name: string;
  phone: string;
  pending_amount: number;
  bill_count: number;
  oldest_due: string;
}

export interface StaffPerf {
  id: number;
  name: string;
  phone: string;
  deliveries: number;
  jars_delivered: number;
  cash_collected: number;
}

export const billingApi = {
  generate: (month: string) =>
    api.post('/billing/generate', { month }),

  list: (params?: Record<string, string>) =>
    api.get<{ bills: Bill[] }>('/billing', { params }),

  get: (id: number) =>
    api.get<{ bill: Bill }>(`/billing/${id}`),

  pdfUrl: (id: number) => `/api/billing/${id}/pdf`,

  recordPayment: (id: number, amount: number) =>
    api.patch(`/billing/${id}/pay`, { amount }),

  // Reports
  revenue: (params?: Record<string, string>) =>
    api.get<{ data: RevenuePoint[]; summary: RevenueSummary; period: string }>(
      '/billing/reports/revenue', { params }
    ),

  pending: () =>
    api.get<{ data: PendingCustomer[] }>('/billing/reports/pending'),

  staffPerformance: (month?: string) =>
    api.get<{ data: StaffPerf[] }>('/billing/reports/staff-performance', {
      params: month ? { month } : undefined,
    }),
};
