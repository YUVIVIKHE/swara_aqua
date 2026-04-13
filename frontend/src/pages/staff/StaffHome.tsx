import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, CheckCircle, Clock, IndianRupee, Package,
  Droplets, ArrowRight, Wallet,
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ordersApi, Order } from '../../api/orders';
import { useSSE } from '../../hooks/useSSE';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

interface DailySummary {
  today: string;
  deliveries_done: number;
  jars_delivered: number;
  cash_collected: number;
  pending_orders: number;
  assigned_jars: number;
  empty_collected: number;
  cash_in_hand: number;
}

export const StaffHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [pending, setPending] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sumRes, ordRes] = await Promise.all([
        ordersApi.getDailySummary(),
        ordersApi.list(),
      ]);
      setSummary(sumRes.data);
      setPending(ordRes.data.orders.filter(o => o.status === 'assigned'));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // SSE: auto-refresh when deliveries change
  useSSE({
    order_created:      () => load(),
    order_assigned:     () => load(),
    order_updated:      () => load(),
    delivery_completed: () => load(),
  });

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Greeting header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-brand-700 to-aqua-600 rounded-3xl p-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute right-14 -bottom-4 w-20 h-20 rounded-full bg-white/10" />
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">{today}</p>
          <h2 className="text-white font-bold text-xl mb-0.5">Hi, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-white/60 text-sm">Ready for today's deliveries.</p>
        </div>
        <div className="relative z-10 hidden sm:flex w-14 h-14 bg-white/15 rounded-2xl items-center justify-center shrink-0">
          <Truck className="w-7 h-7 text-white" />
        </div>
      </motion.div>

      {/* ── Today's Summary ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Today's Summary</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            {/* Deliveries done */}
            <motion.div variants={fadeUp}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center mb-2">
                <CheckCircle className="w-4.5 h-4.5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">{summary?.deliveries_done ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">Deliveries done</p>
            </motion.div>

            {/* Jars delivered */}
            <motion.div variants={fadeUp}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-xl flex items-center justify-center mb-2">
                <Droplets className="w-4.5 h-4.5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">{summary?.jars_delivered ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">Jars delivered</p>
            </motion.div>

            {/* Cash collected today */}
            <motion.div variants={fadeUp}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-400 rounded-xl flex items-center justify-center mb-2">
                <IndianRupee className="w-4.5 h-4.5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">₹{Number(summary?.cash_collected ?? 0).toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-400 mt-0.5">Collected today</p>
            </motion.div>

            {/* Pending orders */}
            <motion.div variants={fadeUp}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-400 rounded-xl flex items-center justify-center mb-2">
                <Clock className="w-4.5 h-4.5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">{summary?.pending_orders ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">Pending orders</p>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* ── Jar & Cash Status ── */}
      {!loading && summary && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3">

          {/* Jars remaining */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-brand-500" />
              <p className="text-xs font-bold text-brand-600 uppercase tracking-wide">Jars with you</p>
            </div>
            <p className="text-3xl font-extrabold text-brand-700">{summary.assigned_jars}</p>
            <p className="text-xs text-brand-400 mt-1">{summary.empty_collected} empties collected</p>
          </div>

          {/* Cash in hand */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Cash in hand</p>
            </div>
            <p className="text-3xl font-extrabold text-amber-700">₹{Number(summary.cash_in_hand).toLocaleString('en-IN')}</p>
            <p className="text-xs text-amber-400 mt-1">Pending submission</p>
          </div>
        </motion.div>
      )}

      {/* ── Pending deliveries list ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Assigned to you ({pending.length})
          </p>
          <button onClick={() => navigate('/staff/deliveries')}
            className="text-xs text-brand-600 font-semibold hover:text-brand-700 transition-colors flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">All clear!</p>
            <p className="text-xs text-slate-400">No pending deliveries. Great work 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 4).map(o => (
              <button key={o.id} onClick={() => navigate('/staff/deliveries')}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-brand-200 hover:shadow-md transition-all text-left active:scale-[0.99]">
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.customer_name}</p>
                  <p className="text-xs text-slate-400">{o.quantity} jars · ₹{o.total_amount}</p>
                </div>
                <span className="shrink-0 text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                  Assigned
                </span>
              </button>
            ))}
            {pending.length > 4 && (
              <button onClick={() => navigate('/staff/deliveries')}
                className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700 py-2 transition-colors">
                +{pending.length - 4} more orders →
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
