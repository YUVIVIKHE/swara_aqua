import { useState, useEffect, useCallback } from 'react';
import { ordersApi, Order } from '../api/orders';

export const useOrders = () => {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ordersApi.list();
      setOrders(data.orders ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { orders, loading, error, refresh };
};
