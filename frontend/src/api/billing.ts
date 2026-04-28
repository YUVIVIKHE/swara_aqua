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

export interface CustomerGrowthPoint {
  date?: string;
  month?: string;
  new_customers: number;
}

export const billingApi = {
  generate: (month: string) =>
    api.post('/billing/generate', { month }),

  list: (params?: Record<string, string>) =>
    api.get<{ bills: Bill[] }>('/billing', { params }),

  get: (id: number) =>
    api.get<{ bill: Bill }>(`/billing/${id}`),

  pdfUrl: (id: number) => {
    const token = localStorage.getItem('accessToken') || '';
    return `/api/billing/${id}/pdf?token=${encodeURIComponent(token)}`;
  },

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

  customerGrowth: (params?: Record<string, string>) =>
    api.get<{ data: CustomerGrowthPoint[]; period: string }>(
      '/billing/reports/customer-growth', { params }
    ),

  // Delivery report (flexible date range)
  deliveryReport: (params: { customerId?: number; startDate: string; endDate: string }) =>
    api.get<{ report: DeliveryReport }>('/billing/delivery-report', { params }),

  deliveryReportPdfUrl: (params: { customerId?: number; startDate: string; endDate: string }) => {
    const token = localStorage.getItem('accessToken') || '';
    const qs = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate, token });
    if (params.customerId) qs.set('customerId', String(params.customerId));
    return `/api/billing/delivery-report/pdf?${qs.toString()}`;
  },
};

export interface DeliveryReport {
  customer: { id: number; name: string; phone: string; jar_rate: number; address?: string };
  startDate: string;
  endDate: string;
  totalJars: number;
  jarRate: number;
  totalAmount: number;
  days: { date: string; jars: number }[];
}

