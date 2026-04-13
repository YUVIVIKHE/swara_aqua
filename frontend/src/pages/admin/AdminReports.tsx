import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, IndianRupee, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/Card';
import { StatCardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { billingApi, RevenuePoint, RevenueSummary, PendingCustomer, StaffPerf } from '../../api/billing';

const COLORS = ['#2563EB', '#06B6D4', '#22C55E', '#F59E0B'];

export const AdminReports = () => {
  const { toast } = useToast();
  const [period,    setPeriod]    = useState<'daily' | 'monthly'>('daily');
  const [revenue,   setRevenue]   = useState<RevenuePoint[]>([]);
  const [summary,   setSummary]   = useState<RevenueSummary | null>(null);
  const [pending,   setPending]   = useState<PendingCustomer[]>([]);
  const [staff,     setStaff]     = useState<StaffPerf[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, pendRes, staffRes] = await Promise.all([
        billingApi.revenue({ period }),
        billingApi.pending(),
        billingApi.staffPerformance(),
      ]);
      setRevenue(revRes.data.data);
      setSummary(revRes.data.summary);
      setPending(pendRes.data.data);
      setStaff(staffRes.data.data);
    } catch { toast('Failed to load reports', 'error'); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const pieData = summary ? [
    { name: 'Cash',   value: Number(summary.cash_total) },
    { name: 'Online', value: Number(summary.online_total) },
    { name: 'Pending',value: Number(summary.total_pending) },
  ] : [];

  const xKey = period === 'monthly' ? 'month' : 'date';

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-xs text-slate-400 mt-0.5">Revenue, payments, and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1">
            {(['daily', 'monthly'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                  ${period === p ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !summary ? [0,1,2,3].map(i => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard label="Today's Revenue"  value={`₹${Number(summary.today).toLocaleString('en-IN')}`}       color="bg-brand-50"  icon={<IndianRupee className="w-5 h-5 text-brand-600" />} />
            <StatCard label="This Month"        value={`₹${Number(summary.this_month).toLocaleString('en-IN')}`}  color="bg-green-50"  icon={<TrendingUp className="w-5 h-5 text-green-500" />} />
            <StatCard label="Total Pending"     value={`₹${Number(summary.total_pending).toLocaleString('en-IN')}`} color="bg-red-50"  icon={<Clock className="w-5 h-5 text-red-500" />} />
            <StatCard label="All Time Revenue"  value={`₹${Number(summary.all_time).toLocaleString('en-IN')}`}    color="bg-purple-50" icon={<IndianRupee className="w-5 h-5 text-purple-600" />} />
          </>
        )}
      </div>

      {/* Revenue chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue Trend</h3>
        {loading ? (
          <div className="h-56 bg-slate-100 rounded-xl animate-pulse" />
        ) : revenue.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={(v) => [`₹${Number(v)}`, ''] as [string, string]}
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
      </motion.div>

      {/* Payment split + Staff performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Payment Split</h3>
          {loading ? (
            <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
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
        </motion.div>

        {/* Staff bar chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Staff Deliveries (30 days)</h3>
          {loading ? (
            <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ) : staff.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No staff data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={staff} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Bar dataKey="deliveries" fill="#2563EB" radius={[6, 6, 0, 0]} name="Deliveries" />
                <Bar dataKey="jars_delivered" fill="#06B6D4" radius={[6, 6, 0, 0]} name="Jars" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Pending payments table */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-800">Pending Payments</h3>
            <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
              {pending.length} customers
            </span>
          </div>
          <div className="overflow-x-auto">
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
        </motion.div>
      )}
    </div>
  );
};
