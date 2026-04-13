import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, IndianRupee } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { inventoryApi, Transaction, TransactionStats, CashSubmission, CashHolding } from '../../api/inventory';

const MODE_COLORS: Record<string, string> = {
  cash:    'bg-amber-50  text-amber-700  border-amber-200',
  online:  'bg-blue-50   text-blue-700   border-blue-200',
  advance: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const AdminTransactions = () => {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats,        setStats]        = useState<TransactionStats | null>(null);
  const [submissions,  setSubmissions]  = useState<CashSubmission[]>([]);
  const [holdings,     setHoldings]     = useState<CashHolding[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<'transactions' | 'cash' | 'holdings'>('transactions');
  const [modeFilter,   setModeFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId,     setActionId]     = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (modeFilter)   params.mode   = modeFilter;
      if (statusFilter) params.status = statusFilter;

      const [txRes, cashRes, holdRes] = await Promise.all([
        inventoryApi.getTransactions(params),
        inventoryApi.getCashSubmissions(),
        inventoryApi.getCashHoldings(),
      ]);
      setTransactions(txRes.data.transactions);
      setStats(txRes.data.stats);
      setSubmissions(cashRes.data.submissions);
      setHoldings(holdRes.data.holdings);
    } catch { toast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [modeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async (id: number, action: 'verified' | 'rejected') => {
    setActionId(id);
    try {
      await inventoryApi.verifyCash(id, action);
      toast(action === 'verified' ? 'Cash verified ✅' : 'Cash rejected', action === 'verified' ? 'success' : 'warning');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Action failed', 'error');
    } finally { setActionId(null); }
  };

  const pendingCash = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Transactions</h2>
          <p className="text-xs text-slate-400 mt-0.5">Payments & cash management</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Collected', value: `₹${Number(stats.total_collected).toLocaleString('en-IN')}`, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Cash',            value: `₹${Number(stats.cash_total).toLocaleString('en-IN')}`,      color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Online',          value: `₹${Number(stats.online_total).toLocaleString('en-IN')}`,    color: 'text-blue-700',  bg: 'bg-blue-50' },
            { label: 'Pending',         value: `₹${Number(stats.pending_total).toLocaleString('en-IN')}`,   color: 'text-red-600',   bg: 'bg-red-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} border border-white rounded-2xl p-4 shadow-card`}>
              <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('transactions')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'transactions' ? 'bg-brand-600 text-white shadow-brand' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-300'}`}>
          Transactions
        </button>
        <button onClick={() => setTab('cash')}
          className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'cash' ? 'bg-brand-600 text-white shadow-brand' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-300'}`}>
          Cash Submissions
          {pendingCash > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {pendingCash}
            </span>
          )}
        </button>
        <button onClick={() => setTab('holdings')}
          className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'holdings' ? 'bg-brand-600 text-white shadow-brand' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-300'}`}>
          Staff Cash Holdings
          {holdings.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {holdings.length}
            </span>
          )}
        </button>
      </div>

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'All Modes', value: '' },
              { label: 'Cash',     value: 'cash' },
              { label: 'Online',   value: 'online' },
              { label: 'Advance',  value: 'advance' },
            ].map(f => (
              <button key={f.value} onClick={() => setModeFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                  ${modeFilter === f.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
                {f.label}
              </button>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            {[
              { label: 'All Status', value: '' },
              { label: 'Pending',    value: 'pending' },
              { label: 'Completed',  value: 'completed' },
            ].map(f => (
              <button key={f.value} onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                  ${statusFilter === f.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['#', 'Customer', 'Amount', 'Mode', 'Type', 'Staff', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
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
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">No transactions found</td></tr>
                  ) : transactions.map((t, i) => (
                    <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-xs font-bold text-slate-400">#{t.id}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{t.customer_name}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-brand-600">₹{t.amount}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${MODE_COLORS[t.mode]}`}>
                          {t.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold capitalize ${t.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{t.staff_name || '—'}</td>
                      <td className="px-4 py-3.5"><Badge status={t.status} /></td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? [0,1,2].map(i => <div key={i} className="p-4 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div>)
              : transactions.map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.customer_name}</p>
                    <p className="text-xs text-slate-400">{t.staff_name || 'No staff'} · {new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${MODE_COLORS[t.mode]}`}>{t.mode}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-brand-600">₹{t.amount}</p>
                    <Badge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Cash submissions tab */}
      {tab === 'cash' && (
        <div className="space-y-3">
          {loading ? [0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : submissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
              <IndianRupee className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No cash submissions yet</p>
            </div>
          ) : submissions.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{s.staff_name}</p>
                  <p className="text-xs text-slate-400">{new Date(s.submitted_at).toLocaleString('en-IN')}</p>
                  {s.note && <p className="text-xs text-slate-500 mt-1 italic">"{s.note}"</p>}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-brand-600">₹{s.total_cash}</p>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize
                    ${s.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200'
                    : s.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {s.status}
                  </span>
                </div>
              </div>
              {s.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1"
                    loading={actionId === s.id}
                    icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    onClick={() => handleVerify(s.id, 'verified')}>
                    Verify
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1"
                    loading={actionId === s.id}
                    icon={<XCircle className="w-3.5 h-3.5" />}
                    onClick={() => handleVerify(s.id, 'rejected')}>
                    Reject
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Staff Cash Holdings tab */}
      {tab === 'holdings' && (
        <div className="space-y-3">
          {loading ? [0,1].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : holdings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
              <IndianRupee className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No pending cash</p>
              <p className="text-xs text-slate-400 mt-1">All staff have submitted their cash collections.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="relative z-10">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Total Cash with Staff</p>
                  <p className="text-3xl font-bold text-white">
                    ₹{holdings.reduce((s, h) => s + Number(h.cash_in_hand), 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              {holdings.map((h, i) => (
                <motion.div key={h.staff_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{h.staff_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{h.staff_phone} · {h.transaction_count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-amber-600">₹{Number(h.cash_in_hand).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Cash in hand</p>
                  </div>
                </motion.div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
