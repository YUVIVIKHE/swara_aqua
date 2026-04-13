import api from './axios';

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

export const walletApi = {
  get: () =>
    api.get<{ balance: number; transactions: WalletTransaction[] }>('/wallet'),

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
};
