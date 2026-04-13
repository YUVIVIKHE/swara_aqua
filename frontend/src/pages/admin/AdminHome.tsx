import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Package, TrendingUp, Clock, ArrowRight,
  Droplets, IndianRupee, UserCheck, AlertCircle,
  ChevronRight, BarChart3, Bell, Warehouse,
} from 'lucide-react';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';
import { ordersApi } from '../../api/orders';
import { useSSE } from '../../hooks/useSSE';

interface UserStats  { total: number; pending: number; active: number; customers: number; staff: number; }
interface OrderStats { total: number; pending: number; assigned: number; completed: number; total_revenue: number; }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' as const } } };

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── Metric card ──
const MetricCard = ({
  label, value, sub, icon, gradient, loading,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; gradient: string; loading?: boolean;
}) => (
  <motion.div variants={fadeUp}
    className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-5 w-14 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-lg font-extrabold text-slate-900 leading-none">{value}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{label}</p>
          {sub && <p className="text-[10px] text-slate-300 mt-0.5 truncate">{sub}</p>}
        </>
      )}
    </div>
  </motion.div>
);

export const AdminHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userStats,  setUserStats]  = useState<UserStats | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const loading = !userStats || !orderStats;

  const loadStats = () => {
    api.get('/admin/stats').then(({ data }) => setUserStats(data.stats)).catch(() => {});
    ordersApi.stats().then(({ data }) => setOrderStats(data.stats)).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  // SSE: auto-refresh dashboard when orders change
  useSSE({
    order_created:  () => { loadStats(); toast('New order received', 'success'); },
    order_updated:  () => { loadStats(); },
    delivery_completed: () => { loadStats(); },
  });

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{today}</p>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5 leading-tight">
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">Here's your business at a glance.</p>
        </div>
        <div className="hidden sm:flex w-14 h-14 bg-gradient-to-br from-brand-500 to-aqua-400 rounded-2xl items-center justify-center shadow-[0_4px_14px_rgba(37,99,235,0.3)] shrink-0">
          <Droplets className="w-7 h-7 text-white" />
        </div>
      </motion.div>

      {/* ── Revenue hero ── */}
      {orderStats && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/5" />
          <div className="absolute right-12 -bottom-6 w-28 h-28 rounded-full bg-white/5" />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Total Revenue</p>
              <p className="text-white font-extrabold text-3xl">
                ₹{Number(orderStats.total_revenue).toLocaleString('en-IN')}
              </p>
              <p className="text-white/40 text-xs mt-1">{orderStats.total} orders processed</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-2xl px-3 py-2.5 text-center border border-white/10">
                <p className="text-white font-bold text-lg leading-none">{orderStats.completed}</p>
                <p className="text-white/50 text-[10px] font-medium mt-0.5">Completed</p>
              </div>
              <div className="bg-amber-400/20 rounded-2xl px-3 py-2.5 text-center border border-amber-400/20">
                <p className="text-amber-300 font-bold text-lg leading-none">{orderStats.pending}</p>
                <p className="text-amber-300/70 text-[10px] font-medium mt-0.5">Pending</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── User metrics ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Users</p>
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard loading={loading} label="Total Users"  value={userStats?.total ?? '—'}
            gradient="from-brand-500 to-brand-400"
            icon={<Users className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="Active"       value={userStats?.active ?? '—'}
            sub="Verified accounts"
            gradient="from-green-500 to-emerald-400"
            icon={<UserCheck className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="Pending"      value={userStats?.pending ?? '—'}
            sub="Awaiting approval"
            gradient="from-amber-500 to-orange-400"
            icon={<Clock className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="Customers"    value={userStats?.customers ?? '—'}
            gradient="from-aqua-500 to-teal-400"
            icon={<Package className="w-5 h-5 text-white" />} />
        </motion.div>
      </div>

      {/* ── Order metrics ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Orders</p>
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard loading={loading} label="Total Orders" value={orderStats?.total ?? '—'}
            gradient="from-brand-600 to-blue-500"
            icon={<Package className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="Pending"      value={orderStats?.pending ?? '—'}
            sub="Need assignment"
            gradient="from-amber-500 to-yellow-400"
            icon={<AlertCircle className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="Completed"    value={orderStats?.completed ?? '—'}
            gradient="from-green-500 to-teal-400"
            icon={<TrendingUp className="w-5 h-5 text-white" />} />
          <MetricCard loading={loading} label="In Transit"   value={orderStats?.assigned ?? '—'}
            gradient="from-purple-500 to-indigo-400"
            icon={<Droplets className="w-5 h-5 text-white" />} />
        </motion.div>
      </div>

      {/* ── Quick actions ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              icon: Clock, gradient: 'from-amber-500 to-orange-400',
              label: 'Pending Approvals',
              sub: `${userStats?.pending ?? '—'} users waiting for review`,
              to: '/admin/customers',
              urgent: (userStats?.pending ?? 0) > 0,
            },
            {
              icon: Package, gradient: 'from-brand-600 to-brand-500',
              label: 'Manage Orders',
              sub: `${orderStats?.pending ?? '—'} orders need attention`,
              to: '/admin/orders',
              urgent: false,
            },
            {
              icon: BarChart3, gradient: 'from-purple-500 to-indigo-500',
              label: 'Reports & Analytics',
              sub: 'Revenue, delivery, trends',
              to: '/admin/reports',
              urgent: false,
            },
            {
              icon: Bell, gradient: 'from-teal-500 to-aqua-500',
              label: 'Send Notification',
              sub: 'Push to customers or staff',
              to: '/admin/notifications',
              urgent: false,
            },
          ].map(({ icon: Icon, gradient, label, sub, to, urgent }) => (
            <button key={label} onClick={() => navigate(to)}
              className={`flex items-center justify-between p-4 bg-white rounded-2xl border transition-all group text-left hover:shadow-md active:scale-[0.98]
                ${urgent ? 'border-amber-200 hover:border-amber-300' : 'border-slate-100 hover:border-brand-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    {urgent && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        Action needed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
