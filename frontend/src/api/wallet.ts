import api from './axios';

export type WalletAccess = 'none' | 'pending' | 'approved' | 'rejected';

export interface WalletTransaction {
  id: number;
  user_id: number;
  type: 'credit' | 'debit';
  amount: number;
  mode: 'razorpay' | 'cash' | 'wallet' | 'refund';
  status: 'pending' | 'completed' | 'failed';
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export interface WalletAccessRequest {
  id: number;
  name: string;
  phone: string;
  wallet_access: WalletAccess;
  wallet_balance: number;
  created_at: string;
}

export const walletApi = {
  get: () =>
    api.get<{ balance: number; walletAccess: WalletAccess; transactions: WalletTransaction[] }>('/wallet'),

  requestAccess: () =>
    api.post<{ message: string; walletAccess: WalletAccess }>('/wallet/request-access'),

  createTopupOrder: (amount: number) =>
    api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
      '/wallet/topup/order', { amount }
    ),

  verifyTopup: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: number;
  }) => api.post<{ balance: number }>('/wallet/topup/verify', data),

  payOrder: (orderId: number) =>
    api.post<{ balance: number }>('/wallet/pay-order', { orderId }),

  payBill: (billId: number) =>
    api.patch<{ message: string }>(`/billing/${billId}/pay-wallet`),

  // Admin
  getAccessRequests: (status: WalletAccess = 'pending') =>
    api.get<{ requests: WalletAccessRequest[] }>('/wallet/access-requests', { params: { status } }),

  approveAccess: (userId: number) =>
    api.patch<{ message: string }>(`/wallet/access-requests/${userId}/approve`),

  rejectAccess: (userId: number, reason?: string) =>
    api.patch<{ message: string }>(`/wallet/access-requests/${userId}/reject`, { reason }),
};
