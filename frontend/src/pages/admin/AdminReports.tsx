import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, IndianRupee, Clock, RefreshCw, Calendar, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { billingApi, RevenuePoint, RevenueSummary, PendingCustomer, StaffPerf, CustomerGrowthPoint } from '../../api/billing';

const COLORS = ['#2563EB', '#06B6D4', '#22C55E', '#F59E0B'];

// Mini stat card for the horizontal scroller
const MiniStat = ({ label, value, icon, gradient }: {
  label: string; value: string; icon: React.ReactNode; gradient: string;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className={`shrink-0 w-[160px] sm:w-auto sm:flex-1 rounded-2xl p-4 ${gradient} border border-white/20`}>
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
        {icon}
      </div>
    </div>
    <p className="text-lg font-bold text-white leading-tight">{value}</p>
    <p className="text-[11px] text-white/70 font-medium mt-0.5">{label}</p>
  </motion.div>
);

// Section wrapper for charts
const ChartSection = ({ title, subtitle, delay = 0, children }: {
  title: string; subtitle?: string; delay?: number; children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
    <div className="px-4 sm:px-5 py-4 border-b border-slate-50">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="px-2 sm:px-4 py-4">
      {children}
    </div>
  </motion.div>
);

export const AdminReports = () => {
  const { toast } = useToast();
  const [period,    setPeriod]    = useState<'daily' | 'monthly'>('daily');
  const [revenue,   setRevenue]   = useState<RevenuePoint[]>([]);
  const [summary,   setSummary]   = useState<RevenueSummary | null>(null);
  const [pending,   setPending]   = useState<PendingCustomer[]>([]);
  const [staff,     setStaff]     = useState<StaffPerf[]>([]);
  const [customers, setCustomers] = useState<CustomerGrowthPoint[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Date filters
  const [dateFilter, setDateFilter]   = useState('');    // YYYY-MM-DD
  const [monthFilter, setMonthFilter] = useState('');   // YYYY-MM
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (dateFilter) { params.period = 'daily'; params.days = '1'; }
      if (monthFilter) { params.period = 'monthly'; params.months = '1'; }

      const [revRes, pendRes, staffRes, custRes] = await Promise.all([
        billingApi.revenue(params),
        billingApi.pending(),
        billingApi.staffPerformance(monthFilter || undefined),
        billingApi.customerGrowth({ period }),
      ]);
      setRevenue(revRes.data.data);
      setSummary(revRes.data.summary);
      setPending(pendRes.data.data);
      setStaff(staffRes.data.data);
      setCustomers(custRes.data.data);
    } catch { toast('Failed to load reports', 'error'); }
    finally { setLoading(false); }
  }, [period, dateFilter, monthFilter]);

  useEffect(() => { load(); }, [load]);

  const pieData = summary ? [
    { name: 'Cash',    value: Number(summary.cash_total) },
    { name: 'Online',  value: Number(summary.online_total) },
    { name: 'Pending', value: Number(summary.total_pending) },
  ] : [];

  const xKey = period === 'monthly' ? 'month' : 'date';

  const clearFilters = () => { setDateFilter(''); setMonthFilter(''); setShowDatePicker(false); };

  const activeDateLabel = dateFilter
    ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : monthFilter
    ? new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  // Format x-axis labels for mobile
  const formatXLabel = (val: string) => {
    if (!val) return '';
    if (period === 'monthly') {
      const [y, m] = val.split('-');
      return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short' });
    }
    const d = new Date(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-5xl space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">Revenue, customers & performance</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* ── Filters Row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Period toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['daily', 'monthly'] as const).map(p => (
            <button key={p} onClick={() => { setPeriod(p); clearFilters(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                ${period === p ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Date picker button */}
        <button
          onClick={() => setShowDatePicker(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
            ${showDatePicker || dateFilter || monthFilter
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
          <Calendar className="w-3.5 h-3.5" />
          {activeDateLabel || 'Filter Date'}
        </button>

        {/* Active date pill with clear */}
        {activeDateLabel && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-brand-100 transition-colors">
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Inline date/month input */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="flex items-center gap-2 pb-1">
              {period === 'daily' ? (
                <input type="date" value={dateFilter}
                  onChange={e => { setDateFilter(e.target.value); setMonthFilter(''); }}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 transition-all" />
              ) : (
                <input type="month" value={monthFilter}
                  onChange={e => { setMonthFilter(e.target.value); setDateFilter(''); }}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 transition-all" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary Stats (horizontal scroll on mobile) ── */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
        {loading || !summary ? [0,1,2,3].map(i => (
          <div key={i} className="shrink-0 w-[160px] sm:w-auto sm:flex-1">
            <StatCardSkeleton />
          </div>
        )) : (
          <>
            <MiniStat
              label="Today's Revenue"
              value={`₹${Number(summary.today).toLocaleString('en-IN')}`}
              icon={<IndianRupee className="w-4 h-4 text-white" />}
              gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            />
            <MiniStat
              label="This Month"
              value={`₹${Number(summary.this_month).toLocaleString('en-IN')}`}
              icon={<TrendingUp className="w-4 h-4 text-white" />}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            />
            <MiniStat
              label="Total Pending"
              value={`₹${Number(summary.total_pending).toLocaleString('en-IN')}`}
              icon={<Clock className="w-4 h-4 text-white" />}
              gradient="bg-gradient-to-br from-red-500 to-rose-700"
            />
            <MiniStat
              label="All Time Revenue"
              value={`₹${Number(summary.all_time).toLocaleString('en-IN')}`}
              icon={<IndianRupee className="w-4 h-4 text-white" />}
              gradient="bg-gradient-to-br from-violet-500 to-purple-700"
            />
          </>
        )}
      </div>

      {/* ── Revenue Trend ── */}
      <ChartSection title="Revenue Trend" subtitle={period === 'daily' ? 'Last 30 days' : 'Last 12 months'}>
        {loading ? (
          <div className="h-48 sm:h-56 bg-slate-50 rounded-xl animate-pulse" />
        ) : revenue.length === 0 ? (
          <div className="h-48 sm:h-56 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 240}>
            <AreaChart data={revenue} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                tickFormatter={formatXLabel} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, ''] as [string, string]}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2}
                fill="url(#colorTotal)" name="Total" />
              <Area type="monotone" dataKey="cash"  stroke="#F59E0B" strokeWidth={1.5}
                fill="none" name="Cash" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="online" stroke="#22C55E" strokeWidth={1.5}
                fill="none" name="Online" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartSection>

      {/* ── New Customers Growth ── */}
      <ChartSection title="New Customers" subtitle={period === 'daily' ? 'Daily signups (30 days)' : 'Monthly signups'} delay={0.05}>
        {loading ? (
          <div className="h-44 sm:h-52 bg-slate-50 rounded-xl animate-pulse" />
        ) : customers.length === 0 ? (
          <div className="h-44 sm:h-52 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 180 : 210}>
            <BarChart data={customers} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                tickFormatter={formatXLabel} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                formatter={(v) => [v, 'New Customers'] as [string, string]} />
              <Bar dataKey="new_customers" fill="url(#custGrad)" radius={[6, 6, 0, 0]} name="New Customers" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartSection>

      {/* ── Payment Split + Staff Performance (side by side on desktop, stacked on mobile) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pie chart */}
        <ChartSection title="Payment Split" delay={0.1}>
          {loading ? (
            <div className="h-44 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, ''] as [string, string]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11, color: '#64748B' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        {/* Staff bar chart */}
        <ChartSection title="Staff Deliveries" subtitle="Last 30 days" delay={0.15}>
          {loading ? (
            <div className="h-44 bg-slate-50 rounded-xl animate-pulse" />
          ) : staff.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">No staff data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={staff} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Bar dataKey="deliveries" fill="#2563EB" radius={[6, 6, 0, 0]} name="Deliveries" />
                <Bar dataKey="jars_delivered" fill="#06B6D4" radius={[6, 6, 0, 0]} name="Jars" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      {/* ── Pending Payments ── */}
      {pending.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Pending Payments</h3>
            </div>
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full font-bold">
              {pending.length}
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Customer', 'Phone', 'Pending Amount', 'Bills', 'Oldest Due'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pending.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{p.name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{p.phone}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-red-600">
                      ₹{Number(p.pending_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{p.bill_count}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {new Date(p.oldest_due).toLocaleDateString('en-IN')}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {pending.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br from-red-400 to-red-600 shadow-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400">{p.phone} · {p.bill_count} bill{p.bill_count > 1 ? 's' : ''}</p>
                </div>
                {/* Amount */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-red-600">₹{Number(p.pending_amount).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-400">
                    Due {new Date(p.oldest_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
