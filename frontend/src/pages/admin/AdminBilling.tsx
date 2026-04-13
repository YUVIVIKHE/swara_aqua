import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Plus, X, IndianRupee, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { billingApi, Bill } from '../../api/billing';

const STATUS_STYLE: Record<string, string> = {
  paid:    'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid:  'bg-red-50   text-red-600   border-red-200',
};

export const AdminBilling = () => {
  const { toast } = useToast();
  const [bills,       setBills]       = useState<Bill[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [genMonth,    setGenMonth]    = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating,  setGenerating]  = useState(false);
  const [payBill,     setPayBill]     = useState<Bill | null>(null);
  const [payAmount,   setPayAmount]   = useState('');
  const [paying,      setPaying]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (monthFilter)  params.month  = monthFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await billingApi.list(params);
      setBills(data.bills);
    } catch { toast('Failed to load bills', 'error'); }
    finally { setLoading(false); }
  }, [monthFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await billingApi.generate(genMonth);
      toast(`Generated: ${data.generated}, Skipped: ${data.skipped}`, 'success');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Generation failed', 'error');
    } finally { setGenerating(false); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBill || !payAmount || Number(payAmount) <= 0) { toast('Enter valid amount', 'error'); return; }
    setPaying(true);
    try {
      await billingApi.recordPayment(payBill.id, Number(payAmount));
      toast('Payment recorded', 'success');
      setPayBill(null); setPayAmount('');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Payment failed', 'error');
    } finally { setPaying(false); }
  };

  const downloadPDF = (bill: Bill) => {
    window.open(billingApi.pdfUrl(bill.id), '_blank');
  };

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Billing</h2>
          <p className="text-xs text-slate-400 mt-0.5">{bills.length} bills</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-card">
            <input type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent" />
            <Button size="sm" loading={generating} icon={<Plus className="w-3.5 h-3.5" />} onClick={handleGenerate}>
              Generate
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 transition-all" />
        {['', 'paid', 'partial', 'unpaid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize
              ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
            {s || 'All Status'}
          </button>
        ))}
      </div>

      {/* Bills table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['#', 'Customer', 'Month', 'Jars', 'Total', 'Paid', 'Due', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [0,1,2,3].map(i => (
                  <tr key={i}>{[0,1,2,3,4,5,6,7,8].map(j => (
                    <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-14" /></td>
                  ))}</tr>
                ))
              ) : bills.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No bills found</td></tr>
              ) : bills.map((b, i) => (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-400">#{b.id}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-800">{b.customer_name}</p>
                    <p className="text-xs text-slate-400">{b.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 font-medium">{b.month}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-700">{b.total_jars}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-slate-800">₹{b.total_amount}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-green-600">₹{b.paid_amount}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(b.due_date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => downloadPDF(b)}
                        className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors" title="Download PDF">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {b.status !== 'paid' && (
                        <button onClick={() => { setPayBill(b); setPayAmount(String(Number(b.total_amount) - Number(b.paid_amount))); }}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Record Payment">
                          <IndianRupee className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? [0,1,2].map(i => <div key={i} className="p-4 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div>)
          : bills.map(b => (
            <div key={b.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">{b.customer_name}</p>
                  <p className="text-xs text-slate-400">{b.month} · {b.total_jars} jars</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${STATUS_STYLE[b.status]}`}>
                  {b.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-brand-600">₹{b.total_amount}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => downloadPDF(b)}>PDF</Button>
                  {b.status !== 'paid' && (
                    <Button size="sm" icon={<IndianRupee className="w-3.5 h-3.5" />}
                      onClick={() => { setPayBill(b); setPayAmount(String(Number(b.total_amount) - Number(b.paid_amount))); }}>
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {payBill && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPayBill(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{payBill.customer_name} · {payBill.month}</p>
                </div>
                <button onClick={() => setPayBill(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-400">Total</p><p className="font-bold text-slate-800">₹{payBill.total_amount}</p></div>
                <div><p className="text-xs text-slate-400">Paid</p><p className="font-bold text-green-600">₹{payBill.paid_amount}</p></div>
                <div><p className="text-xs text-slate-400">Due</p>
                  <p className="font-bold text-red-600">₹{(Number(payBill.total_amount) - Number(payBill.paid_amount)).toFixed(2)}</p>
                </div>
              </div>

              <form onSubmit={handlePay} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
                  <input type="number" min={0.01} step="0.01" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
                </div>
                <Button type="submit" loading={paying} size="lg" className="w-full" icon={<CheckCircle className="w-4 h-4" />}>
                  Record ₹{payAmount || '0'}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
