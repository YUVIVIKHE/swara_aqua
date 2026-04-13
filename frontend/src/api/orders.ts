import api from './axios';

export interface Order {
  id: number;
  customer_id: number;
  staff_id: number | null;
  type: 'instant' | 'preorder' | 'monthly' | 'bulk';
  quantity: number;
  price_per_jar: number;
  total_amount: number;
  status: string;
  delivery_date: string | null;
  notes: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  staff_name?: string;
}

export interface Delivery {
  id: number;
  order_id: number;
  staff_id: number;
  delivered_quantity: number;
  collected_amount: number;
  payment_mode: 'cash' | 'online' | 'advance';
  status: string;
  notes: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface TimelineEntry {
  id: number;
  order_id: number;
  status: string;
  note: string;
  actor_name: string | null;
  created_at: string;
}

export const ordersApi = {
  create: (data: Partial<Order> & { pricePerJar?: number; deliveryDate?: string }) =>
    api.post('/orders', data),

  list: (params?: Record<string, string>) =>
    api.get<{ orders: Order[] }>('/orders', { params }),

  get: (id: number) =>
    api.get<{ order: Order; timeline: TimelineEntry[]; delivery: Delivery | null }>(`/orders/${id}`),

  assign: (id: number, staffId: number) =>
    api.put(`/orders/${id}/assign`, { staffId }),

  updateStatus: (id: number, status: string) =>
    api.put(`/orders/${id}/status`, { status }),

  cancel: (id: number) =>
    api.delete(`/orders/${id}`),

  stats: () =>
    api.get('/orders/stats'),

  staffList: () =>
    api.get<{ staff: { id: number; name: string; phone: string }[] }>('/orders/staff-list'),

  completeDelivery: (data: {
    orderId: number;
    deliveredQuantity: number;
    collectedAmount: number;
    paymentMode: 'cash' | 'online' | 'advance';
    notes?: string;
  }) => api.post('/orders/deliveries', data),

  deliveries: () =>
    api.get<{ deliveries: Delivery[] }>('/orders/deliveries'),

  getDailySummary: () =>
    api.get<{
      today: string;
      deliveries_done: number;
      jars_delivered: number;
      cash_collected: number;
      pending_orders: number;
      assigned_jars: number;
      empty_collected: number;
      cash_in_hand: number;
    }>('/orders/daily-summary'),
};
