import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, XCircle, RefreshCw, X, IndianRupee, Pencil, Eye, ChevronRight, Calendar, User, UserPlus, Package, Droplets, Sun, CloudSun, Sunset, Plus, Minus, RotateCcw, Check } from 'lucide-react';

import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';
import { subscriptionApi } from '../../api/subscription';

interface CustomerRow { id: number; name: string; phone: string; role: string; status: string; jar_rate: number; created_at: string; }
interface MonthBill { month: string; total_amount: number; paid_amount: number; pending: number; status: string; }
interface BalanceInfo { total: number; months: MonthBill[]; }

const STATUS_FILTERS = ['all', 'active', 'pending', 'rejected'];
const MONTH_LABELS: Record<string, string> = {};
const getMonthLabel = (m: string) => {
  if (MONTH_LABELS[m]) return MONTH_LABELS[m];
  const [y, mo] = m.split('-');
  const d = new Date(Number(y), Number(mo) - 1);
  MONTH_LABELS[m] = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return MONTH_LABELS[m];
};

const statusColor: Record<string, string> = {
  active:   'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

export const AdminCustomers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers]   = useState<CustomerRow[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [actionId,  setActionId]    = useState<number | null>(null);
  const [search,    setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingRate, setEditingRate] = useState<CustomerRow | null>(null);
  const [rateValue, setRateValue]   = useState('');

  // Mobile modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  // Pending balances
  const [balances, setBalances] = useState<Record<number, BalanceInfo>>({});

  // Add Customer modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', password: '', jarRate: '50', address: '' });

  // Place Order for customer modal
  const [orderForCustomer, setOrderForCustomer] = useState<CustomerRow | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({ type: 'instant' as string, quantity: 1, deliveryDate: '', notes: '', address: '' });

  // Create Plan for customer modal
  const [planForCustomer, setPlanForCustomer] = useState<CustomerRow | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planSlots, setPlanSlots] = useState<Record<string, { time: string; quantity: number }>>({});
  const [planAddress, setPlanAddress] = useState('');
  const [planAutoRenew, setPlanAutoRenew] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, balRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/customer-balances'),
      ]);
      setCustomers(usersRes.data.users.filter((u: CustomerRow) => u.role === 'customer'));
      setBalances(balRes.data.balances || {});
    } catch { toast('Failed to load customers', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id: number, status: string) => {
    setActionId(id);
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      toast(status === 'active' ? 'Customer approved' : 'Customer rejected',
            status === 'active' ? 'success' : 'warning');
      setSelectedCustomer(null);
      await load();
    } catch { toast('Action failed', 'error'); }
    finally { setActionId(null); }
  };

  const handleJarRate = async () => {
    if (!editingRate) return;
    const rate = Number(rateValue);
    if (!rate || rate <= 0) { toast('Enter a valid jar rate', 'error'); return; }
    try {
      await api.patch(`/admin/users/${editingRate.id}/jar-rate`, { jarRate: rate });
      toast(`Jar rate set to ₹${rate}`, 'success');
      setEditingRate(null);
      await load();
    } catch { toast('Failed to update jar rate', 'error'); }
  };

  const handleAddCustomer = async () => {
    const { name, phone, password, jarRate, address } = newCustomer;
    if (!name.trim() || !phone.trim() || !password) { toast('Name, phone and password are required', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setAddingCustomer(true);
    try {
      await api.post('/admin/customer', { name: name.trim(), phone: phone.trim(), password, jarRate: Number(jarRate) || 50, address: address.trim() || undefined });
      toast('Customer created successfully!', 'success');
      setShowAddCustomer(false);
      setNewCustomer({ name: '', phone: '', password: '', jarRate: '50', address: '' });
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to create customer', 'error');
    } finally { setAddingCustomer(false); }
  };

  const handlePlaceOrder = async () => {
    if (!orderForCustomer) return;
    if (orderForm.quantity < 1) { toast('Quantity must be at least 1', 'error'); return; }
    if (orderForm.type === 'preorder' && !orderForm.deliveryDate) { toast('Select delivery date for preorder', 'error'); return; }
    setPlacingOrder(true);
    try {
      await api.post('/admin/orders', {
        customerId: orderForCustomer.id,
        type: orderForm.type,
        quantity: orderForm.quantity,
        deliveryDate: orderForm.type === 'preorder' ? orderForm.deliveryDate : undefined,
        notes: orderForm.notes || undefined,
        address: orderForm.address || undefined,
      });
      toast(`Order placed for ${orderForCustomer.name}!`, 'success');
      setOrderForCustomer(null);
      setOrderForm({ type: 'instant', quantity: 1, deliveryDate: '', notes: '', address: '' });
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to place order', 'error');
    } finally { setPlacingOrder(false); }
  };

  // ── Plan helpers ────────────────────────────────────────────────────────
  const PLAN_SLOTS = [
    { label: 'Morning',   time: '08:00', icon: <Sun className="w-4 h-4" />,      gradient: 'from-amber-400 to-orange-500' },
    { label: 'Afternoon', time: '13:00', icon: <CloudSun className="w-4 h-4" />, gradient: 'from-sky-400 to-blue-500' },
    { label: 'Evening',   time: '17:00', icon: <Sunset className="w-4 h-4" />,   gradient: 'from-purple-400 to-indigo-500' },
  ];

  const togglePlanSlot = (label: string, time: string) => {
    setPlanSlots(prev => {
      if (prev[label]) { const { [label]: _, ...rest } = prev; return rest; }
      return { ...prev, [label]: { time, quantity: 1 } };
    });
  };

  const setPlanSlotQty = (label: string, delta: number) => {
    setPlanSlots(prev => {
      if (!prev[label]) return prev;
      const q = Math.max(1, prev[label].quantity + delta);
      return { ...prev, [label]: { ...prev[label], quantity: q } };
    });
  };

  const handleCreatePlan = async () => {
    if (!planForCustomer) return;
    const slots = Object.entries(planSlots).map(([label, s]) => ({ label, time: s.time, quantity: s.quantity }));
    if (slots.length === 0) { toast('Select at least one slot', 'error'); return; }
    setCreatingPlan(true);
    try {
      await subscriptionApi.adminCreate({ customerId: planForCustomer.id, slots, address: planAddress || undefined, autoRenew: planAutoRenew });
      toast(`Monthly plan created for ${planForCustomer.name}! 🎉`, 'success');
      setPlanForCustomer(null);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to create plan', 'error');
    } finally { setCreatingPlan(false); }
  };

  const filtered = customers.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all:      customers.length,
    active:   customers.filter(u => u.status === 'active').length,
    pending:  customers.filter(u => u.status === 'pending').length,
    rejected: customers.filter(u => u.status === 'rejected').length,
  };

  // Selected customer's balance (for modal)
  const selBal = selectedCustomer ? balances[selectedCustomer.id] : null;

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Customers</h2>
          <p className="text-xs text-slate-400 mt-0.5">{customers.length} total customers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setShowAddCustomer(true)}>
            Add Customer
          </Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize
              ${statusFilter === s
                ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
            {s === 'all' ? 'All' : s}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
              ${statusFilter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {counts[s as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-card focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
      </div>

      {/* Table — desktop */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Customer', 'Phone', 'Jar Rate', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [0,1,2,3].map(i => (
                  <tr key={i}>{[0,1,2,3,4].map(j => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No customers found</td></tr>
              ) : filtered.map((u, i) => {
                const bal = balances[u.id];
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 bg-gradient-to-br from-brand-500 to-aqua-500">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{u.phone}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => { setEditingRate(u); setRateValue(String(u.jar_rate || 50)); }}
                        className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                        ₹{u.jar_rate || 50}
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      {bal && bal.total > 0 ? (
                        <span className="text-sm font-bold text-red-500">₹{bal.total.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-sm text-green-500 font-medium">Clear</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm"
                          icon={<Eye className="w-3.5 h-3.5 text-brand-500" />}
                          onClick={() => navigate(`/admin/customers/${u.id}`)}
                          className="text-brand-600 hover:bg-brand-50">
                          View
                        </Button>
                        {u.status !== 'active' && (
                          <Button variant="ghost" size="sm" loading={actionId === u.id}
                            icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                            onClick={() => handleStatus(u.id, 'active')}
                            className="text-green-600 hover:bg-green-50">
                            Approve
                          </Button>
                        )}
                        {u.status !== 'rejected' && (
                          <Button variant="ghost" size="sm" loading={actionId === u.id}
                            icon={<XCircle className="w-3.5 h-3.5 text-red-400" />}
                            onClick={() => handleStatus(u.id, 'rejected')}
                            className="text-red-500 hover:bg-red-50">
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Mobile: tappable cards ─── */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            [0,1,2,3].map(i => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No customers found</div>
          ) : filtered.map(u => {
            const bal = balances[u.id];
            const hasPending = bal && bal.total > 0;
            return (
              <motion.button
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedCustomer(u)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 transition-colors">

                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br from-brand-500 to-aqua-500 shadow-sm">
                  {u.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + phone */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{u.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{u.phone}</p>
                </div>

                {/* Right: balance pill + status + arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasPending ? (
                    <span className="bg-red-50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100">
                      ₹{bal.total.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusColor[u.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {u.status}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Mobile Customer Detail Modal (bottom sheet) ─── */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center md:hidden"
            onClick={() => setSelectedCustomer(null)}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 pb-6">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-brand-500 to-aqua-500 shadow-sm">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h3>
                      <p className="text-xs text-slate-400">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 pt-4 space-y-4">

                  {/* Status + details grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-2xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Status</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize ${statusColor[selectedCustomer.status] || ''}`}>
                        {selectedCustomer.status}
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Jar Rate</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-brand-600">₹{selectedCustomer.jar_rate || 50}/jar</p>
                        <button onClick={() => { setEditingRate(selectedCustomer); setRateValue(String(selectedCustomer.jar_rate || 50)); setSelectedCustomer(null); }}
                          className="ml-0.5">
                          <Pencil className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-3 col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Joined</p>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">
                          {new Date(selectedCustomer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending balance */}
                  {selBal && selBal.total > 0 ? (
                    <div className="bg-red-50 border border-red-100 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-red-100">
                        <div className="flex items-center gap-2">
                          <IndianRupee className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs font-bold text-red-700">Pending Balance</span>
                        </div>
                        <span className="text-base font-extrabold text-red-600">₹{selBal.total.toLocaleString('en-IN')}</span>
                      </div>
                      {selBal.months.length > 0 && (
                        <div className="divide-y divide-red-100">
                          {selBal.months.map(bill => (
                            <div key={bill.month} className="flex items-center justify-between px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-red-400" />
                                <span className="text-xs font-semibold text-red-700">{getMonthLabel(bill.month)}</span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                                  ${bill.status === 'unpaid' ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                                  {bill.status}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-red-600">₹{bill.pending.toLocaleString('en-IN')}</p>
                                {bill.paid_amount > 0 && (
                                  <p className="text-[10px] text-red-400">of ₹{bill.total_amount.toLocaleString('en-IN')}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-semibold text-green-700">No pending balance — All clear!</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => { setSelectedCustomer(null); navigate(`/admin/customers/${selectedCustomer.id}`); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white text-sm font-semibold rounded-2xl hover:bg-brand-700 transition-colors shadow-brand">
                      <User className="w-4 h-4" /> View Full Profile
                    </button>
                    {selectedCustomer.status === 'active' && (
                      <>
                        <button
                          onClick={() => { setSelectedCustomer(null); setOrderForCustomer(selectedCustomer); setOrderForm({ type: 'instant', quantity: 1, deliveryDate: '', notes: '', address: '' }); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-aqua-500/10 text-aqua-600 text-sm font-semibold rounded-2xl border border-aqua-500/20 hover:bg-aqua-500/20 transition-colors">
                          <Package className="w-4 h-4" /> Place Order
                        </button>
                        <button
                          onClick={() => { setSelectedCustomer(null); setPlanSlots({}); setPlanAddress(''); setPlanAutoRenew(true); setPlanForCustomer(selectedCustomer); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 text-purple-600 text-sm font-semibold rounded-2xl border border-purple-200 hover:bg-purple-100 transition-colors">
                          <Droplets className="w-4 h-4" /> Create Monthly Plan
                        </button>
                      </>
                    )}
                    {selectedCustomer.status !== 'active' && (
                      <button
                        onClick={() => handleStatus(selectedCustomer.id, 'active')}
                        disabled={actionId === selectedCustomer.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-700 text-sm font-semibold rounded-2xl border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50">
                        <CheckCircle className="w-4 h-4" /> Approve Customer
                      </button>
                    )}
                    {selectedCustomer.status !== 'rejected' && (
                      <button
                        onClick={() => handleStatus(selectedCustomer.id, 'rejected')}
                        disabled={actionId === selectedCustomer.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 text-sm font-semibold rounded-2xl border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50">
                        <XCircle className="w-4 h-4" /> Reject Customer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jar Rate Edit Modal */}
      <AnimatePresence>
        {editingRate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingRate(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-xs shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Set Jar Rate</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{editingRate.name} — {editingRate.phone}</p>
                </div>
                <button onClick={() => setEditingRate(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Price per Jar (₹)</label>
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                    <IndianRupee className="w-4 h-4 text-slate-400" />
                    <input
                      type="number" min={1} step="0.01"
                      value={rateValue}
                      onChange={e => setRateValue(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
                      autoFocus />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="md" className="flex-1"
                    onClick={() => setEditingRate(null)}>
                    Cancel
                  </Button>
                  <Button size="md" className="flex-1" onClick={handleJarRate}
                    icon={<CheckCircle className="w-4 h-4" />}>
                    Save Rate
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Add Customer Modal ─── */}
      <AnimatePresence>
        {showAddCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddCustomer(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Customer</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Create a new customer account</p>
                </div>
                <button onClick={() => setShowAddCustomer(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Full Name *</label>
                  <input value={newCustomer.name} onChange={e => setNewCustomer(f => ({ ...f, name: e.target.value }))}
                    placeholder="Customer name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Phone Number *</label>
                  <input value={newCustomer.phone} onChange={e => setNewCustomer(f => ({ ...f, phone: e.target.value }))}
                    placeholder="10-digit phone"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Password *</label>
                  <input type="password" value={newCustomer.password} onChange={e => setNewCustomer(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Jar Rate (₹)</label>
                    <input type="number" min={1} value={newCustomer.jarRate} onChange={e => setNewCustomer(f => ({ ...f, jarRate: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="text-[10px] text-slate-400 mb-1">Default: ₹50/jar</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Address (optional)</label>
                  <textarea value={newCustomer.address} onChange={e => setNewCustomer(f => ({ ...f, address: e.target.value }))}
                    placeholder="Delivery address…" rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="secondary" size="md" className="flex-1"
                    onClick={() => setShowAddCustomer(false)}>
                    Cancel
                  </Button>
                  <Button size="md" className="flex-1" loading={addingCustomer} onClick={handleAddCustomer}
                    icon={<UserPlus className="w-4 h-4" />}>
                    Create
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Place Order for Customer Modal ─── */}
      <AnimatePresence>
        {orderForCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setOrderForCustomer(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Place Order</h3>
                  <p className="text-xs text-slate-400 mt-0.5">For {orderForCustomer.name} · ₹{orderForCustomer.jar_rate || 50}/jar</p>
                </div>
                <button onClick={() => setOrderForCustomer(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Order type */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Order Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['instant', 'preorder', 'monthly', 'bulk'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setOrderForm(f => ({ ...f, type: t }))}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all capitalize
                          ${orderForm.type === t
                            ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-brand-50'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity + Total */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Quantity</label>
                    <input type="number" min={1} value={orderForm.quantity}
                      onChange={e => setOrderForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="bg-gradient-to-br from-brand-50 to-aqua-400/10 border border-brand-100 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[10px] text-brand-500 font-medium">Total</p>
                      <p className="text-lg font-bold text-brand-700">₹{orderForm.quantity * (orderForCustomer.jar_rate || 50)}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery date (preorder only) */}
                {orderForm.type === 'preorder' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Delivery Date & Time</label>
                    <input type="datetime-local" value={orderForm.deliveryDate}
                      onChange={e => setOrderForm(f => ({ ...f, deliveryDate: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Address (optional)</label>
                  <textarea value={orderForm.address} onChange={e => setOrderForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Delivery address…" rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                  <input value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any instructions…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="secondary" size="md" className="flex-1"
                    onClick={() => setOrderForCustomer(null)}>
                    Cancel
                  </Button>
                  <Button size="md" className="flex-1" loading={placingOrder} onClick={handlePlaceOrder}
                    icon={<Package className="w-4 h-4" />}>
                    Place Order
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Monthly Plan Modal ── */}
      <AnimatePresence>
        {planForCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={() => setPlanForCustomer(null)}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl max-h-[90vh] flex flex-col">

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Monthly Plan</h3>
                  <p className="text-xs text-slate-400">for {planForCustomer.name}</p>
                </div>
                <button onClick={() => setPlanForCustomer(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

                {/* Slot cards */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery Slots</p>
                  {PLAN_SLOTS.map(slot => {
                    const isActive = !!planSlots[slot.label];
                    return (
                      <div key={slot.label}
                        className={`rounded-2xl border-2 overflow-hidden transition-all
                          ${isActive ? 'border-purple-400 shadow-md' : 'border-slate-200'}`}>
                        <button onClick={() => togglePlanSlot(slot.label, slot.time)}
                          className={`w-full flex items-center gap-3 p-3.5 transition-all
                            ${isActive ? 'bg-gradient-to-r ' + slot.gradient + ' text-white' : 'bg-slate-50'}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                            ${isActive ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                            <span className={isActive ? 'text-white' : 'text-slate-500'}>{slot.icon}</span>
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{slot.label}</p>
                            <p className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{slot.time}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                            ${isActive ? 'border-white bg-white/20' : 'border-slate-300'}`}>
                            {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </button>
                        {isActive && (
                          <div className="flex items-center justify-between px-4 py-2.5 bg-white border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-500">Jars per delivery</p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => setPlanSlotQty(slot.label, -1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-base font-bold text-slate-800 w-5 text-center">
                                {planSlots[slot.label]?.quantity || 1}
                              </span>
                              <button onClick={() => setPlanSlotQty(slot.label, 1)}
                                className="w-7 h-7 rounded-lg bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                {Object.keys(planSlots).length > 0 && (
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-500 font-semibold">Daily Total</p>
                      <p className="text-lg font-extrabold text-purple-700">
                        {Object.values(planSlots).reduce((s, v) => s + v.quantity, 0)} jars
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-purple-500 font-semibold">~Monthly</p>
                      <p className="text-base font-bold text-purple-600">
                        ₹{(Object.values(planSlots).reduce((s, v) => s + v.quantity, 0) * (planForCustomer.jar_rate || 50) * 30).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Address */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Delivery Address</label>
                  <textarea value={planAddress} onChange={e => setPlanAddress(e.target.value)}
                    placeholder="Customer delivery address…" rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 transition-all resize-none" />
                </div>

                {/* Auto-renew */}
                <button onClick={() => setPlanAutoRenew(!planAutoRenew)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all
                    ${planAutoRenew ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <RotateCcw className={`w-3.5 h-3.5 ${planAutoRenew ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold text-slate-700">Auto-renew</span>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${planAutoRenew ? 'bg-purple-600' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${planAutoRenew ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setPlanForCustomer(null)}>Cancel</Button>
                <Button size="md" className="flex-1 !bg-purple-600 hover:!bg-purple-700" loading={creatingPlan} onClick={handleCreatePlan}
                  disabled={Object.keys(planSlots).length === 0}
                  icon={<Droplets className="w-4 h-4" />}>
                  Create Plan
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
