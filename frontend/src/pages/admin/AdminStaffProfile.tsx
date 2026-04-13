import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Package, Truck, IndianRupee, Warehouse,
  CheckCircle, Clock, CreditCard,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';

interface StaffProfile {
  id: number; name: string; phone: string; role: string; status: string; created_at: string;
}
interface StaffStats {
  total_deliveries: number;
  total_jars_delivered: number;
  total_cash_collected: number;
  active_orders: number;
}
interface StaffInventory { assigned_jars: number; empty_collected: number; }
interface Delivery {
  id: number; delivered_quantity: number; collected_amount: number;
  payment_mode: string; delivered_at: string;
  quantity: number; type: string; address: string | null;
  customer_name: string; customer_phone: string;
}

const MODE_COLOR: Record<string, string> = {
  cash:    'bg-green-50  text-green-700  border-green-200',
  online:  'bg-blue-50   text-blue-700   border-blue-200',
  advance: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const AdminStaffProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile,    setProfile]    = useState<StaffProfile | null>(null);
  const [stats,      setStats]      = useState<StaffStats | null>(null);
  const [inventory,  setInventory]  = useState<StaffInventory | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/admin/staff/${id}/profile`)
      .then(({ data }) => {
        setProfile(data.staff);
        setStats(data.stats);
        setInventory(data.inventory);
        setDeliveries(data.recentDeliveries);
      })
      .catch(() => toast('Failed to load staff profile', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl text-center py-20">
        <p className="text-slate-400">Staff member not found</p>
        <button onClick={() => navigate('/admin/staff')}
          className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold">
          Back to Staff
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/staff')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-purple-500 to-brand-500 shadow-sm shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{profile.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge status={profile.status} />
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />{profile.phone}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">
                Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Deliveries',   value: stats?.total_deliveries    ?? 0,    icon: Truck,        color: 'from-brand-500 to-aqua-500' },
          { label: 'Jars Delivered',value: stats?.total_jars_delivered ?? 0,  icon: Package,      color: 'from-blue-500 to-cyan-500' },
          { label: 'Cash Collected',value: `₹${Number(stats?.total_cash_collected ?? 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'from-green-500 to-emerald-500' },
          { label: 'Active Orders', value: stats?.active_orders       ?? 0,    icon: Clock,        color: 'from-amber-500 to-orange-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-2`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Inventory status */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Warehouse className="w-4 h-4 text-slate-400" /> Jar Inventory
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
            <p className="text-[10px] text-brand-500 uppercase tracking-wider font-semibold mb-1">Assigned Jars</p>
            <p className="text-2xl font-extrabold text-brand-700">{inventory?.assigned_jars ?? 0}</p>
            <p className="text-xs text-brand-400 mt-0.5">Currently with staff</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold mb-1">Empty Collected</p>
            <p className="text-2xl font-extrabold text-green-700">{inventory?.empty_collected ?? 0}</p>
            <p className="text-xs text-green-400 mt-0.5">Returned empties</p>
          </div>
        </div>
      </div>

      {/* Recent deliveries */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400" /> Recent Deliveries
          </h3>
        </div>
        {deliveries.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No deliveries yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {deliveries.map((d) => (
              <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{d.customer_name}</p>
                      <p className="text-xs text-slate-400">
                        {d.delivered_quantity} jars ·{' '}
                        {new Date(d.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <p className="text-sm font-bold text-brand-600">₹{Number(d.collected_amount).toLocaleString('en-IN')}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${MODE_COLOR[d.payment_mode] ?? ''}`}>
                      {d.payment_mode}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
