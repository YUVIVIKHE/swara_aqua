import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserRound, Phone, Package, IndianRupee, StickyNote,
  Plus, X, Trash2, RefreshCw, ChevronDown, AlertCircle, Check,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';

interface CasualDelivery {
  id: number;
  staff_id: number;
  staff_name: string;
  person_name: string | null;
  phone: string | null;
  quantity: number;
  amount_collected: number;
  payment_mode: 'cash' | 'online' | 'credit';
  notes: string | null;
  created_at: string;
}

const PM_LABELS: Record<string, string> = { cash: 'Cash', online: 'Online', credit: 'Credit' };

const PM_COLORS: Record<string, string> = {
  cash:   'bg-green-50 text-green-700 border-green-200',
  online: 'bg-blue-50 text-blue-700 border-blue-200',
  credit: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ── Log Form ─────────────────────────────────────────────────────────────────

const defaultForm = {
  person_name: '',
  phone: '',
  quantity: '1',
  amount_collected: '',
  payment_mode: 'cash' as 'cash' | 'online' | 'credit',
  notes: '',
};

const LogForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof defaultForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.quantity || Number(form.quantity) < 1) {
      toast('Quantity must be at least 1', 'error'); return;
    }
    setSaving(true);
    try {
      await api.post('/casual-deliveries', {
        person_name:      form.person_name.trim() || null,
        phone:            form.phone.trim() || null,
        quantity:         Number(form.quantity),
        amount_collected: Number(form.amount_collected) || 0,
        payment_mode:     form.payment_mode,
        notes:            form.notes.trim() || null,
      });
      toast('Casual delivery recorded!', 'success');
      setForm(defaultForm);
      onSuccess();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to record', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Plus className="w-4 h-4 text-brand-500" />
        Record Casual Jar Delivery
      </h3>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Use this form to log jars given to walk-in or casual customers who are <strong>not registered</strong> in the system.
          Name and phone are optional but help with tracking.
        </p>
      </div>

      {/* Name + Phone row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Person Name <span className="text-slate-300">(optional)</span>
          </label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              type="text" value={form.person_name}
              onChange={e => set('person_name', e.target.value)}
              placeholder="e.g. Ramesh"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Phone <span className="text-slate-300">(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Qty + Amount + Mode */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Jars *
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              type="number" min={1} value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Amount (₹)
          </label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input
              type="number" min={0} value={form.amount_collected}
              onChange={e => set('amount_collected', e.target.value)}
              placeholder="0"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Payment
          </label>
          <select value={form.payment_mode} onChange={e => set('payment_mode', e.target.value as any)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all">
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Notes <span className="text-slate-300">(optional)</span>
        </label>
        <div className="relative">
          <StickyNote className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-300" />
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any additional info about this delivery…"
            rows={2}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-400 transition-all resize-none"
          />
        </div>
      </div>

      <Button loading={saving} icon={<Check className="w-4 h-4" />} onClick={handleSubmit}
        className="w-full">
        Save Record
      </Button>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const StaffCasualDeliveries = () => {
  const { toast } = useToast();
  const [records,  setRecords]  = useState<CasualDelivery[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ deliveries: CasualDelivery[] }>('/casual-deliveries');
      setRecords(data.deliveries);
    } catch { toast('Failed to load records', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this record?')) return;
    setDeleting(id);
    try {
      await api.delete(`/casual-deliveries/${id}`);
      setRecords(r => r.filter(x => x.id !== id));
      toast('Record deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
    finally { setDeleting(null); }
  };

  const totalJars   = records.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = records.reduce((s, r) => s + Number(r.amount_collected), 0);

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Casual Deliveries</h2>
          <p className="text-xs text-slate-400 mt-0.5">Jars given to walk-in / non-registered persons</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
          <Button size="sm" icon={showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : 'Log Delivery'}
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Records', value: records.length },
            { label: 'Total Jars',    value: totalJars },
            { label: 'Total Collected', value: `₹${totalAmount.toFixed(0)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-3.5 text-center">
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Log form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}>
            <LogForm onSuccess={() => { setShowForm(false); load(); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Records list */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserRound className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">No casual deliveries yet</p>
          <p className="text-xs text-slate-400 mt-1">Tap "Log Delivery" to record a jar given to a walk-in person.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec, i) => (
            <motion.div key={rec.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">

              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5 text-slate-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">
                      {rec.person_name || <span className="text-slate-400 font-medium italic">Unknown Person</span>}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PM_COLORS[rec.payment_mode]}`}>
                      {PM_LABELS[rec.payment_mode]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {rec.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {rec.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Package className="w-3 h-3" /> {rec.quantity} jar{rec.quantity > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                      <IndianRupee className="w-3 h-3" /> ₹{Number(rec.amount_collected).toFixed(0)}
                    </span>
                  </div>

                  {rec.notes && (
                    <p className="text-[11px] text-slate-400 mt-1.5 italic">"{rec.notes}"</p>
                  )}

                  <p className="text-[10px] text-slate-300 mt-1">
                    {new Date(rec.created_at).toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Delete */}
                <button
                  disabled={deleting === rec.id}
                  onClick={() => handleDelete(rec.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
