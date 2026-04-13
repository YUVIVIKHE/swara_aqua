import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, AlertTriangle, IndianRupee, X, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi, StaffInventory as SI, InventoryLog, CashSubmission } from '../../api/inventory';

export const StaffInventory = () => {
  const { user }  = useAuth();
  const { toast } = useToast();

  const [myInventory,  setMyInventory]  = useState<SI | null>(null);
  const [logs,         setLogs]         = useState<InventoryLog[]>([]);
  const [submissions,  setSubmissions]  = useState<CashSubmission[]>([]);
  const [cashInHand,   setCashInHand]   = useState(0);
  const [loading,      setLoading]      = useState(true);

  const [showReturn,   setShowReturn]   = useState(false);
  const [showDamaged,  setShowDamaged]  = useState(false);
  const [showCash,     setShowCash]     = useState(false);

  const [returnQty,    setReturnQty]    = useState(1);
  const [damagedQty,   setDamagedQty]   = useState(1);
  const [damagedNote,  setDamagedNote]  = useState('');
  const [cashAmount,   setCashAmount]   = useState('');
  const [cashNote,     setCashNote]     = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, logRes, cashRes, holdRes] = await Promise.all([
        inventoryApi.get(),
        inventoryApi.getLogs(20),
        inventoryApi.getCashSubmissions(),
        inventoryApi.getCashHoldings(),
      ]);
      const mine = invRes.data.staffInventory.find(s => s.staff_id === user?.id) ?? null;
      setMyInventory(mine);
      setLogs(logRes.data.logs);
      setSubmissions(cashRes.data.submissions);
      const myHolding = holdRes.data.holdings.find(h => h.staff_id === user?.id);
      setCashInHand(myHolding ? Number(myHolding.cash_in_hand) : 0);
    } catch { toast('Failed to load inventory', 'error'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await inventoryApi.returnJars(returnQty);
      toast(`${returnQty} empty jars returned`, 'success');
      setShowReturn(false); setReturnQty(1);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to return jars', 'error');
    } finally { setSubmitting(false); }
  };

  const handleDamaged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damagedNote.trim()) { toast('Please describe the damage', 'error'); return; }
    setSubmitting(true);
    try {
      await inventoryApi.reportDamaged(damagedQty, damagedNote);
      toast(`${damagedQty} jars reported as damaged`, 'warning');
      setShowDamaged(false); setDamagedQty(1); setDamagedNote('');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to report damage', 'error');
    } finally { setSubmitting(false); }
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount || Number(cashAmount) < 0) { toast('Enter a valid amount', 'error'); return; }
    setSubmitting(true);
    try {
      await inventoryApi.submitCash(Number(cashAmount), cashNote || undefined);
      toast('Cash submitted for verification', 'success');
      setShowCash(false); setCashAmount(''); setCashNote('');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to submit cash', 'error');
    } finally { setSubmitting(false); }
  };

  const hasPendingCash = submissions.some(s => s.status === 'pending');

  return (
    <div className="max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Inventory</h2>
          <p className="text-xs text-slate-400 mt-0.5">Jars & cash management</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
      </div>

      {/* Inventory cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">{[0,1].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-card">
            <span className="text-2xl block mb-2">📦</span>
            <p className="text-3xl font-bold text-blue-700">{myInventory?.assigned_jars ?? 0}</p>
            <p className="text-xs text-blue-500 font-medium mt-1">Assigned Jars</p>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5 shadow-card">
            <span className="text-2xl block mb-2">↩️</span>
            <p className="text-3xl font-bold text-teal-700">{myInventory?.empty_collected ?? 0}</p>
            <p className="text-xs text-teal-500 font-medium mt-1">Empty Collected</p>
          </div>
        </div>
      )}

      {/* Cash in Hand */}
      {!loading && cashInHand > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Cash in Hand</p>
              <p className="text-3xl font-bold text-white">₹{cashInHand.toLocaleString('en-IN')}</p>
              <p className="text-white/60 text-xs mt-1">Submit to admin at end of day</p>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setShowReturn(true)}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-teal-300 hover:bg-teal-50 transition-all">
          <RotateCcw className="w-5 h-5 text-teal-600" />
          <span className="text-xs font-semibold text-slate-700">Return Empty</span>
        </button>
        <button onClick={() => setShowDamaged(true)}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-red-300 hover:bg-red-50 transition-all">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-xs font-semibold text-slate-700">Report Damage</span>
        </button>
        <button onClick={() => setShowCash(true)} disabled={hasPendingCash}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-card hover:border-amber-300 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <IndianRupee className="w-5 h-5 text-amber-600" />
          <span className="text-xs font-semibold text-slate-700">Submit Cash</span>
        </button>
      </div>

      {hasPendingCash && (
        <p className="text-xs text-amber-600 text-center font-medium">
          ⏳ Cash submission pending admin verification
        </p>
      )}

      {/* Cash submissions history */}
      {submissions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Cash Submissions</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {submissions.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">₹{s.total_cash}</p>
                  <p className="text-xs text-slate-400">{new Date(s.submitted_at).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize
                  ${s.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200'
                  : s.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Activity Log</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base shrink-0">
                  {{ add:'➕', assign:'📦', return:'↩️', delivered:'✅', damaged:'💥' }[log.type] || '📋'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 capitalize">{log.type} · {log.quantity} jars</p>
                  <p className="text-xs text-slate-400 truncate">{log.note}</p>
                </div>
                <p className="text-[10px] text-slate-300 shrink-0">
                  {new Date(log.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return Empty Modal */}
      <AnimatePresence>
        {showReturn && (
          <StaffModal title="Return Empty Jars" onClose={() => setShowReturn(false)}>
            <form onSubmit={handleReturn} className="space-y-4">
              <p className="text-xs text-slate-500">
                Empty collected: <span className="font-bold text-teal-600">{myInventory?.empty_collected ?? 0}</span>
              </p>
              <FieldInput label="Quantity to Return" value={returnQty}
                onChange={v => setReturnQty(Math.max(1, v))} max={myInventory?.empty_collected ?? 0} />
              <Button type="submit" loading={submitting} size="lg" className="w-full" icon={<RotateCcw className="w-4 h-4" />}>
                Return {returnQty} Jars
              </Button>
            </form>
          </StaffModal>
        )}
      </AnimatePresence>

      {/* Damaged Modal */}
      <AnimatePresence>
        {showDamaged && (
          <StaffModal title="Report Damaged Jars" onClose={() => setShowDamaged(false)}>
            <form onSubmit={handleDamaged} className="space-y-4">
              <FieldInput label="Damaged Quantity" value={damagedQty}
                onChange={v => setDamagedQty(Math.max(1, v))} max={myInventory?.assigned_jars ?? 0} />
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Reason *</label>
                <textarea value={damagedNote} onChange={e => setDamagedNote(e.target.value)}
                  placeholder="Describe what happened..." rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
              </div>
              <Button type="submit" loading={submitting} size="lg" variant="danger" className="w-full"
                icon={<AlertTriangle className="w-4 h-4" />}>
                Report {damagedQty} Damaged
              </Button>
            </form>
          </StaffModal>
        )}
      </AnimatePresence>

      {/* Cash Submit Modal */}
      <AnimatePresence>
        {showCash && (
          <StaffModal title="Submit Cash to Admin" onClose={() => setShowCash(false)}>
            <form onSubmit={handleCashSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Total Cash (₹)</label>
                <input type="number" min={0} step="0.01" value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Note (optional)</label>
                <input type="text" value={cashNote} onChange={e => setCashNote(e.target.value)}
                  placeholder="Any remarks..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
              </div>
              <Button type="submit" loading={submitting} size="lg" className="w-full"
                icon={<IndianRupee className="w-4 h-4" />}>
                Submit ₹{cashAmount || '0'}
              </Button>
            </form>
          </StaffModal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const StaffModal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
    onClick={onClose}>
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={e => e.stopPropagation()}
      className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const FieldInput = ({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max?: number }) => (
  <div>
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
    <input type="number" min={1} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
  </div>
);
