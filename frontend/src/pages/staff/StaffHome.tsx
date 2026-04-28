import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, CheckCircle2, Clock, IndianRupee, Package,
  Droplets, ArrowRight, Wallet, MapPin, ChevronRight,
  Zap, UserRound,
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ordersApi, Order } from '../../api/orders';
import { useSSE } from '../../hooks/useSSE';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay, ease: 'easeOut' as const } },
});

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
  const { user }  = useAuth();
  const navigate  = useNavigate();
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

  useSSE({
    order_created:      () => load(),
    order_assigned:     () => load(),
    order_updated:      () => load(),
    delivery_completed: () => load(),
  });

  const firstName = user?.name?.split(' ')[0] ?? 'Staff';
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    {
      label: 'Delivered',
      value: summary?.deliveries_done ?? 0,
      icon: CheckCircle2,
      from: 'from-emerald-500', to: 'to-green-400',
      glow: 'rgba(16,185,129,0.35)',
    },
    {
      label: 'Jars Out',
      value: summary?.jars_delivered ?? 0,
      icon: Droplets,
      from: 'from-brand-500', to: 'to-aqua-400',
      glow: 'rgba(37,99,235,0.35)',
    },
    {
      label: 'Collected',
      value: `₹${Number(summary?.cash_collected ?? 0).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      from: 'from-amber-500', to: 'to-orange-400',
      glow: 'rgba(245,158,11,0.35)',
    },
    {
      label: 'Pending',
      value: summary?.pending_orders ?? 0,
      icon: Clock,
      from: 'from-purple-500', to: 'to-indigo-400',
      glow: 'rgba(139,92,246,0.35)',
    },
  ];

  return (
    <div className="space-y-5 max-w-xl">

      {/* ── Hero greeting ── */}
      <motion.div {...fadeUp(0)}
        className="relative overflow-hidden rounded-3xl"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0369a1 60%, #06b6d4 100%)' }}>

        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute bottom-0 right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 pointer-events-none" />

        <div className="relative z-10 px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">{today}</p>
            <h1 className="text-white font-bold text-2xl mt-1 leading-tight">
              {timeOfDay},<br />
              <span className="text-aqua-200">{firstName}!</span>
            </h1>
            <p className="text-white/50 text-xs mt-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-300" />
              Ready for today's deliveries
            </p>
          </div>

          {/* Avatar circle */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <UserRound className="w-8 h-8 text-white/80" />
            </div>
            <span className="text-[10px] text-white/50 font-semibold bg-white/10 rounded-full px-2.5 py-0.5">
              {user?.role ?? 'Staff'}
            </span>
          </div>
        </div>

        {/* Progress bar (deliveries done / total pending) */}
        {!loading && summary && (summary.deliveries_done + summary.pending_orders) > 0 && (
          <div className="relative z-10 px-6 pb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-white/50 font-semibold">Today's progress</p>
              <p className="text-[10px] text-white/70 font-bold">
                {summary.deliveries_done} / {summary.deliveries_done + summary.pending_orders}
              </p>
            </div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((summary.deliveries_done / (summary.deliveries_done + summary.pending_orders)) * 100)}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-aqua-300 to-emerald-300"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Stats grid ── */}
      <motion.div {...fadeUp(0.08)} className="grid grid-cols-2 gap-3">
        {loading ? (
          [0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)
        ) : (
          stats.map(({ label, value, icon: Icon, from, to, glow }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-card p-4 flex flex-col gap-2">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${from} ${to} flex items-center justify-center`}
                style={{ boxShadow: `0 4px 14px ${glow}` }}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800 leading-none">{value}</p>
              <p className="text-[11px] text-slate-400 font-medium">{label}</p>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* ── Jars & Cash status ── */}
      {!loading && summary && (
        <motion.div {...fadeUp(0.22)} className="grid grid-cols-2 gap-3">

          {/* Jars with you */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-aqua-500 p-4">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-white/70" />
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Jars with you</p>
            </div>
            <p className="text-4xl font-extrabold text-white leading-none">{summary.assigned_jars}</p>
            <p className="text-white/50 text-[11px] mt-2 flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              {summary.empty_collected} empties back
            </p>
          </div>

          {/* Cash in hand */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-400 p-4">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-white/70" />
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Cash in hand</p>
            </div>
            <p className="text-3xl font-extrabold text-white leading-none">
              ₹{Number(summary.cash_in_hand).toLocaleString('en-IN')}
            </p>
            <p className="text-white/50 text-[11px] mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pending submission
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Pending deliveries ── */}
      <motion.div {...fadeUp(0.32)}>

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-700">Assigned Orders</p>
            {!loading && (
              <p className="text-[10px] text-slate-400 mt-0.5">{pending.length} awaiting delivery</p>
            )}
          </div>
          <button onClick={() => navigate('/staff/deliveries')}
            className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-8 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-sm font-bold text-slate-700">All caught up! 🎉</p>
            <p className="text-xs text-slate-400 mt-1">No pending deliveries assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pending.slice(0, 5).map((o, i) => (
              <motion.button key={o.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.06 }}
                onClick={() => navigate('/staff/deliveries')}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-brand-200 hover:shadow-md transition-all text-left active:scale-[0.98]">

                {/* Number badge */}
                <div className="w-10 h-10 bg-gradient-to-br from-brand-100 to-aqua-50 rounded-2xl flex items-center justify-center shrink-0">
                  <span className="text-brand-600 font-extrabold text-sm">{i + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{o.customer_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                      <Package className="w-3 h-3" /> {o.quantity} jar{o.quantity > 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-semibold">
                      <IndianRupee className="w-3 h-3" /> {Number(o.total_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
                    Assigned
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </motion.button>
            ))}

            {pending.length > 5 && (
              <button onClick={() => navigate('/staff/deliveries')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-50 border border-brand-100 text-xs font-bold text-brand-600 hover:bg-brand-100 transition-colors active:scale-[0.98]">
                View {pending.length - 5} more orders
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
