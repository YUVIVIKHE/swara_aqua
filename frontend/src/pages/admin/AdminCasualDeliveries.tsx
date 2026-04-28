import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserRound, Phone, Package, IndianRupee, RefreshCw,
  CalendarDays, Users, Trash2,
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

const PM_COLORS: Record<string, string> = {
  cash:   'bg-green-50 text-green-700 border-green-200',
  online: 'bg-blue-50 text-blue-700 border-blue-200',
  credit: 'bg-amber-50 text-amber-700 border-amber-200',
};

const todayStr = () => new Date().toISOString().split('T')[0];
const monthStr = () => new Date().toISOString().slice(0, 7);

export const AdminCasualDeliveries = () => {
  const { toast } = useToast();
  const [records,    setRecords]    = useState<CasualDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState<number | null>(null);
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [staffFilter, setStaffFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (startDate)    params.startDate = startDate;
      if (endDate)      params.endDate   = endDate;
      if (staffFilter)  params.staffId   = staffFilter;
      const { data } = await api.get<{ deliveries: CasualDelivery[] }>('/casual-deliveries', { params });
      setRecords(data.deliveries);
    } catch { toast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [startDate, endDate, staffFilter]);

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

  // Unique staff list for filter
  const staffList = Array.from(
    new Map(records.map(r => [r.staff_id, r.staff_name])).entries()
  );

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Casual Deliveries</h2>
          <p className="text-xs text-slate-400 mt-0.5">Jars given to walk-in / non-registered persons by staff</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filters</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 transition-all" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 transition-all" />
          </div>
        </div>
        <button onClick={() => { setStartDate(''); setEndDate(''); setStaffFilter(''); }}
          className="text-xs text-slate-400 hover:text-brand-500 transition-colors">
          Clear filters
        </button>
      </div>

      {/* Summary */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Records',    value: records.length },
            { label: 'Total Jars', value: totalJars },
            { label: 'Collected',  value: `₹${totalAmount.toFixed(0)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-3.5 text-center">
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserRound className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">No records found</p>
          <p className="text-xs text-slate-400 mt-1">No casual deliveries for the selected period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec, i) => (
            <motion.div key={rec.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Person */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">
                      {rec.person_name || <span className="text-slate-400 font-medium italic">Unknown</span>}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PM_COLORS[rec.payment_mode]}`}>
                      {rec.payment_mode}
                    </span>
                  </div>

                  {/* Details */}
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

                  {/* Staff + time */}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Users className="w-3 h-3" /> {rec.staff_name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(rec.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {rec.notes && (
                    <p className="text-[11px] text-slate-400 mt-1 italic">"{rec.notes}"</p>
                  )}
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
