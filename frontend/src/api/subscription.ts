import api from './axios';

export interface SubscriptionSlot {
  id?: number;
  subscription_id?: number;
  slot_label: string;
  delivery_time: string;
  quantity: number;
}

export interface Subscription {
  id: number;
  customer_id: number;
  address: string | null;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  slots: SubscriptionSlot[];
}

export interface CancelRequest {
  id: number;
  order_id: number;
  customer_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  total_amount: number;
  order_type: string;
}

export const subscriptionApi = {
  // Customer
  create: (data: { slots: { label: string; time: string; quantity: number }[]; address?: string; autoRenew?: boolean }) =>
    api.post<{ subscriptionId: number }>('/subscriptions', data),

  getMy: () =>
    api.get<{ subscription: Subscription | null }>('/subscriptions/my'),

  update: (id: number, data: { slots?: { label: string; time: string; quantity: number }[]; address?: string; autoRenew?: boolean }) =>
    api.patch(`/subscriptions/${id}`, data),

  pause: (id: number) =>
    api.patch(`/subscriptions/${id}/pause`),

  resume: (id: number) =>
    api.patch(`/subscriptions/${id}/resume`),

  renew: (id: number) =>
    api.patch(`/subscriptions/${id}/renew`),

  cancel: (id: number) =>
    api.delete(`/subscriptions/${id}`),

  // Admin
  getAll: () =>
    api.get<{ subscriptions: Subscription[] }>('/subscriptions/admin/all'),

  getCancelRequests: (status?: string) =>
    api.get<{ requests: CancelRequest[] }>('/subscriptions/admin/cancel-requests', {
      params: status ? { status } : undefined,
    }),

  reviewCancelRequest: (id: number, action: 'approved' | 'rejected') =>
    api.patch(`/subscriptions/admin/cancel-requests/${id}`, { action }),

  getTimeSlots: () =>
    api.get<{ start: string; end: string }>('/subscriptions/admin/time-slots'),

  updateTimeSlots: (start: string, end: string) =>
    api.patch('/subscriptions/admin/time-slots', { start, end }),

  adminCreate: (data: { customerId: number; slots: { label: string; time: string; quantity: number }[]; address?: string; autoRenew?: boolean }) =>
    api.post<{ subscriptionId: number }>('/subscriptions/admin/create', data),

  adminCancel: (id: number) =>
    api.delete(`/subscriptions/admin/${id}`),
};
