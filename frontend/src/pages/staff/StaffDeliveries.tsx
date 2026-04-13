import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, CheckCircle, X, Package, Phone, User, RefreshCw, Clock, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/OrderStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ordersApi, Order } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import { useSSE } from '../../hooks/useSSE';

type PaymentMode = 'cash' | 'online' | 'advance';
type FilterTab = 'pending' | 'completed' | 'preorder';

const TABS: { id: FilterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'pending',   label: 'Pending',    icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'completed', label: 'Completed',  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { id: 'preorder',  label: 'Pre-orders', icon: <Calendar className="w-3.5 h-3.5" /> },
];

export const StaffDeliveries = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [step, setStep] = useState<'view' | 'deliver'>('deliver');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const [deliveryForm, setDeliveryForm] = useState({
    deliveredQuantity: 0,
    collectedAmount: 0,
    paymentMode: 'cash' as PaymentMode,
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await ordersApi.list(); setOrders(data.orders); }
    catch { toast('Failed to load orders', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  // SSE: auto-refresh when staff gets new assignments or orders change
  useSSE({
    order_assigned:     () => { load(); toast('New delivery assigned!', 'success'); },
    order_created:      () => { load(); },
    order_updated:      () => { load(); },
    delivery_completed: () => { load(); },
  });

  const openOrder = (order: Order) => {
    setSelected(order);
    setDeliveryForm({ deliveredQuantity: order.quantity, collectedAmount: order.total_amount, paymentMode: 'cash', notes: '' });
    setStep('deliver'); // go straight to delivery form
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (deliveryForm.deliveredQuantity < 1) { toast('Delivered quantity must be at least 1', 'error'); return; }
    setSubmitting(true);
    try {
      await ordersApi.completeDelivery({
        orderId: selected.id,
        deliveredQuantity: deliveryForm.deliveredQuantity,
        collectedAmount: deliveryForm.collectedAmount,
        paymentMode: deliveryForm.paymentMode,
        notes: deliveryForm.notes || undefined,
      });
      toast('Delivery completed!', 'success');
      setSelected(null);
      setActiveTab('completed');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to complete delivery', 'error');
    } finally { setSubmitting(false); }
  };

  const openMaps = (order: Order) => {
    if (order.latitude && order.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`, '_blank');
    } else if (order.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`, '_blank');
    } else {
      toast('No location available for this order', 'warning');
    }
  };

  // Split by filter tab
  // pending  = assigned to this staff (active)
  // completed = completed/delivered orders by this staff
  // preorder  = pending orders with a future delivery_date
  const today = new Date().toISOString().split('T')[0];

  const pendingOrders   = orders.filter(o => o.status === 'assigned');
  const completedOrders = orders.filter(o => ['completed', 'delivered'].includes(o.status));
  const preOrders       = orders.filter(o =>
    o.status === 'pending' &&
    o.delivery_date &&
    new Date(o.delivery_date).toISOString().split('T')[0] > today
  );

  const visibleOrders = activeTab === 'pending'
    ? pendingOrders
    : activeTab === 'completed'
    ? completedOrders
    : preOrders;

  const tabCount = {
    pending:   pendingOrders.length,
    completed: completedOrders.length,
    preorder:  preOrders.length,
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Deliveries</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {pendingOrders.length} pending · {completedOrders.length} completed · {preOrders.length} pre-orders
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all
              ${activeTab === tab.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>
            {tab.icon}
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tabCount[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          {activeTab === 'pending' && <>
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No pending deliveries</p>
            <p className="text-xs text-slate-400 mt-1">New assignments will appear here automatically.</p>
          </>}
          {activeTab === 'completed' && <>
            <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No completed orders yet</p>
            <p className="text-xs text-slate-400 mt-1">Completed deliveries will show here.</p>
          </>}
          {activeTab === 'preorder' && <>
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No upcoming pre-orders</p>
            <p className="text-xs text-slate-400 mt-1">Future scheduled orders will appear here.</p>
          </>}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map(o => (
            <OrderCard key={o.id} order={o} onOpen={openOrder} onNavigate={openMaps}
              isAssignedToMe={o.staff_id === user?.id} />
          ))}
        </div>
      )}

      {/* ── Delivery Bottom Sheet ── */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setSelected(null)}>

            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 sm:relative sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md sm:mx-auto shadow-2xl
                max-h-[92vh] flex flex-col">

              {/* ── Drag handle (mobile) ── */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-slate-200 rounded-full" />
              </div>

              {/* ── Header ── */}
              <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0
                ${selected.staff_id === user?.id ? 'bg-brand-50/50' : 'bg-slate-50/50'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-slate-400">Order #{selected.id}</span>
                    <OrderStatusBadge status={selected.status} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{selected.customer_name}</h3>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

                {/* Order summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-slate-400 mb-0.5">Jars</p>
                    <p className="text-xl font-extrabold text-slate-800">{selected.quantity}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-slate-400 mb-0.5">Amount</p>
                    <p className="text-xl font-extrabold text-brand-600">₹{selected.total_amount}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-slate-400 mb-0.5">Type</p>
                    <p className="text-sm font-bold text-slate-700 capitalize mt-0.5">{selected.type}</p>
                  </div>
                </div>

                {/* Contact & address */}
                <div className="space-y-2">
                  {selected.customer_phone && (
                    <a href={`tel:${selected.customer_phone}`}
                      className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl p-3 active:bg-green-100 transition-colors">
                      <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{selected.customer_phone}</p>
                        <p className="text-[11px] text-slate-400">Tap to call</p>
                      </div>
                    </a>
                  )}
                  {selected.address && (
                    <button onClick={() => openMaps(selected)}
                      className="w-full flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 active:bg-blue-100 transition-colors text-left">
                      <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
                        <Navigation className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{selected.address}</p>
                        <p className="text-[11px] text-slate-400">Tap to navigate</p>
                      </div>
                    </button>
                  )}
                </div>

                {/* ── Delivery form ── */}
                {step === 'deliver' && (
                  <form onSubmit={handleCompleteDelivery} className="space-y-4">

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Delivered Qty</label>
                        <input type="number" inputMode="numeric" min={1} max={selected.quantity}
                          value={deliveryForm.deliveredQuantity}
                          onChange={e => setDeliveryForm(f => ({ ...f, deliveredQuantity: Number(e.target.value) }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-base font-semibold text-center outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Amount (₹)</label>
                        <input type="number" inputMode="decimal" min={0}
                          value={deliveryForm.collectedAmount}
                          onChange={e => setDeliveryForm(f => ({ ...f, collectedAmount: Number(e.target.value) }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-base font-semibold text-center outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['cash','online','advance'] as PaymentMode[]).map(m => (
                          <button key={m} type="button"
                            onClick={() => setDeliveryForm(f => ({ ...f, paymentMode: m }))}
                            className={`py-2.5 rounded-xl text-sm font-semibold border transition-all capitalize
                              ${deliveryForm.paymentMode === m
                                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                      <textarea value={deliveryForm.notes}
                        onChange={e => setDeliveryForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Any delivery notes..."
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
                    </div>

                    <Button type="submit" loading={submitting} size="lg" className="w-full !py-3.5 !text-base"
                      icon={<CheckCircle className="w-5 h-5" />}>
                      Complete Delivery
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


const OrderCard = ({ order, onOpen, onNavigate, isAssignedToMe }: {
  order: Order;
  onOpen: (o: Order) => void;
  onNavigate: (o: Order) => void;
  isAssignedToMe: boolean;
}) => {
  const isDone = ['completed', 'delivered'].includes(order.status);
  const isFuture = order.status === 'pending' && !!order.delivery_date;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border shadow-card p-4 transition-all
        ${isDone ? 'border-green-100 opacity-80' : isAssignedToMe ? 'border-brand-100 ring-1 ring-brand-100' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-slate-400">#{order.id}</span>
            <OrderStatusBadge status={order.status} />
            {isAssignedToMe && !isDone && (
              <span className="text-[9px] font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Yours
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-800">{order.customer_name}</p>
          {order.staff_name && !isAssignedToMe && (
            <p className="text-[11px] text-slate-400 mt-0.5">→ {order.staff_name}</p>
          )}
          {isFuture && order.delivery_date && (
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
              📅 Scheduled: {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          {order.address && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />{order.address}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-base font-bold text-brand-600">₹{order.total_amount}</p>
          <p className="text-xs text-slate-400">{order.quantity} jars</p>
        </div>
      </div>
      <div className="flex gap-2">
        {!isDone && (
          <Button variant={isAssignedToMe ? 'primary' : 'secondary'} size="sm" className="flex-1"
            onClick={() => onOpen(order)}>
            {order.status === 'assigned' ? 'Deliver' : 'Open'}
          </Button>
        )}
        {isDone && (
          <div className="flex-1 flex items-center gap-1.5 text-xs font-semibold text-green-600">
            <CheckCircle className="w-3.5 h-3.5" /> Delivered
          </div>
        )}
        <Button variant="ghost" size="sm" icon={<Navigation className="w-3.5 h-3.5" />}
          onClick={() => onNavigate(order)} className="text-brand-600 hover:bg-brand-50">
          Navigate
        </Button>
      </div>
    </motion.div>
  );
};
