import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, RefreshCw, Calendar, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/OrderStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ordersApi, Order } from '../../api/orders';
import { useSSE } from '../../hooks/useSSE';

const STATUS_FILTERS = ['all', 'pending', 'assigned', 'delivered', 'completed', 'cancelled'];

// Returns YYYY-MM-DD for today
const todayStr = () => new Date().toISOString().split('T')[0];
// Returns YYYY-MM for this month
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

export const AdminOrders = () => {
  const { toast } = useToast();
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState('');   // YYYY-MM-DD
  const [monthFilter,  setMonthFilter]  = useState('');   // YYYY-MM
  const [dateMode,     setDateMode]     = useState<'date' | 'month' | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search)      params.search = search;
      if (dateFilter)  params.date   = dateFilter;
      else if (monthFilter) params.month = monthFilter;
      const res = await ordersApi.list(params);
      setOrders(res.data.orders);
    } catch { toast('Failed to load orders', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter, dateFilter, monthFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const clearDateFilters = () => { setDateFilter(''); setMonthFilter(''); setDateMode(null); };

  // SSE: auto-refresh when orders change
  useSSE({
    order_created:      () => { load(); toast('New order received', 'success'); },
    order_updated:      () => { load(); },
    delivery_completed: () => { load(); },
  });

  const activeDateLabel = dateFilter
    ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : monthFilter
    ? new Date(monthFilter + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="max-w-5xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">All Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">{orders.length} orders</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-2">

        {/* Search + date pickers row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <form onSubmit={handleSearch}
            className="flex-1 min-w-[180px] flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus-within:border-brand-400 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
          </form>

          {/* Date picker button */}
          <button
            onClick={() => setDateMode(m => m === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
              ${dateMode === 'date' || dateFilter
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
            <Calendar className="w-3.5 h-3.5" /> By Day
          </button>

          {/* Month picker button */}
          <button
            onClick={() => setDateMode(m => m === 'month' ? null : 'month')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
              ${dateMode === 'month' || monthFilter
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
            <Calendar className="w-3.5 h-3.5" /> By Month
          </button>
        </div>

        {/* Inline date/month input */}
        {dateMode === 'date' && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateFilter} max={todayStr()}
              onChange={e => { setDateFilter(e.target.value); setMonthFilter(''); }}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 transition-all" />
            {dateFilter && (
              <button onClick={clearDateFilters}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
        )}
        {dateMode === 'month' && (
          <div className="flex items-center gap-2">
            <input type="month" value={monthFilter} max={thisMonthStr()}
              onChange={e => { setMonthFilter(e.target.value); setDateFilter(''); }}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 transition-all" />
            {monthFilter && (
              <button onClick={clearDateFilters}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
        )}

        {/* Active date filter pill */}
        {activeDateLabel && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full">
              <Calendar className="w-3 h-3" /> {activeDateLabel}
              <button onClick={clearDateFilters} className="ml-1 hover:text-brand-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize
                ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['#', 'Customer', 'Type', 'Qty', 'Amount', 'Status', 'Staff', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [0,1,2,3].map(i => (
                  <tr key={i}>{[0,1,2,3,4,5,6,7].map(j => (
                    <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                  ))}</tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No orders found</td></tr>
              ) : orders.map((o, i) => (
                <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-400">#{o.id}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-800">{o.customer_name}</p>
                    <p className="text-xs text-slate-400">{o.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 capitalize">{o.type}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{o.quantity}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-brand-600">₹{o.total_amount}</td>
                  <td className="px-4 py-3.5"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{o.staff_name || '—'}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile — compact list rows */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            [0,1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                <Skeleton className="h-4 w-12 shrink-0" />
              </div>
            ))
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No orders found</div>
          ) : orders.map(o => (
            <motion.div key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">

              {/* Customer info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.customer_name}</p>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {o.quantity} jars · {o.staff_name || 'Unassigned'} · {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>

              {/* Right: status + amount stacked */}
              <div className="shrink-0 text-right flex flex-col items-end gap-1">
                <OrderStatusBadge status={o.status} />
                <span className="text-xs font-bold text-brand-600">₹{o.total_amount}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
