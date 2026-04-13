import api from './axios';

export interface CalendarDay {
  date: string;
  jars_delivered: number;
  orders_count: number;
  total_amount: number;
}

export interface CustomerProfile {
  id: number;
  name: string;
  phone: string;
  role: string;
  status: string;
  jar_rate: number;
  advance_balance: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface CustomerProfileStats {
  total_jars_delivered: number;
  total_orders: number;
  total_collected: number;
  pending_amount: number;
  pending_bills: number;
}

export const calendarApi = {
  getCalendar: (month: string, customerId?: number) =>
    api.get<{ days: CalendarDay[] }>('/orders/calendar', {
      params: { month, ...(customerId ? { customerId } : {}) },
    }),

  getCustomerProfile: (id: number) =>
    api.get<{
      customer: CustomerProfile;
      stats: CustomerProfileStats;
      bills: any[];
      orders: any[];
    }>(`/admin/users/${id}/profile`),
};
