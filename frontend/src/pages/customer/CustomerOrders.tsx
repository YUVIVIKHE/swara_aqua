import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Package, X, ChevronRight, MapPin, FileText, Droplets, RefreshCw, Navigation, Home, Briefcase, Check, Wallet, CreditCard, Banknote, Map } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { OrderStatusBadge } from '../../components/ui/OrderStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useOrders } from '../../hooks/useOrders';
import { ordersApi, Order, TimelineEntry, Delivery } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import { useNotificationCenter } from '../../context/NotificationContext';
import { addressApi, UserAddress } from '../../api/address';
import { walletApi } from '../../api/wallet';
import { loadRazorpay } from '../../utils/razorpay';
import { MapPicker } from '../../components/ui/MapPicker';



const timelineIcon: Record<string, string> = {
  pending:          '🕐',
  assigned:         '👤',
  out_for_delivery: '🚚',
  delivered:        '📦',
  completed:        '✅',
  cancelled:        '❌',
};

type DetailState = { order: Order; timeline: TimelineEntry[]; delivery: Delivery | null } | null;

export const CustomerOrders = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { enablePush } = useNotificationCenter();
  const { orders, loading, error, refresh } = useOrders();
  const [searchParams, setSearchParams] = useSearchParams();
  const PRICE_PER_JAR = user?.jar_rate || 50;

  const [showForm,      setShowForm]      = useState(false);
  const [selected,      setSelected]      = useState<DetailState>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [orderSuccess,  setOrderSuccess]  = useState<{ orderId: number; quantity: number; total: number; mode: string; scheduledForTomorrow?: boolean } | null>(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [showReasonModal, setShowReasonModal] = useState<number | null>(null); // order id

  // Auto-open form if navigated with ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const [form, setForm] = useState({
    type:         'instant' as Order['type'],
    quantity:     1,
    deliveryDate: '',
    notes:        '',
    address:      '',
    paymentMode:  'cod' as 'cod' | 'wallet' | 'razorpay',
  });

  // Load wallet balance when form opens
  useEffect(() => {
    if (showForm) {
      walletApi.get().then(({ data }) => setWalletBalance(data.balance)).catch(() => {});
    }
  }, [showForm]);

  // Show error toast if load failed
  useEffect(() => {
    if (error) toast(error, 'error');
  }, [error]);

  const resetForm = () =>
    setForm({ type: 'instant', quantity: 1, deliveryDate: '', notes: '', address: '', paymentMode: 'cod' });

  // ── Place order ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.quantity < 1) { toast('Quantity must be at least 1', 'error'); return; }
    if (form.type === 'preorder' && !form.deliveryDate) {
      toast('Please select a delivery date for preorder', 'error'); return;
    }
    if (form.paymentMode === 'wallet' && walletBalance < totalAmount) {
      toast(`Insufficient wallet balance. Have ₹${walletBalance}, need ₹${totalAmount}`, 'error'); return;
    }

    setSubmitting(true);
    try {
      // 1. Place the order first
      const { data: orderData } = await ordersApi.create({
        type:         form.type,
        quantity:     form.quantity,
        pricePerJar:  PRICE_PER_JAR,
        deliveryDate: form.type === 'preorder' ? form.deliveryDate : undefined,
        notes:        form.notes   || undefined,
        address:      form.address || undefined,
      });

      const orderId: number = orderData.orderId;
      const scheduledForTomorrow: boolean = orderData.scheduledForTomorrow || false;
      let modeLabel = 'Cash on Delivery';

      // 2. Handle payment
      if (form.paymentMode === 'wallet') {
        await walletApi.payOrder(orderId);
        modeLabel = 'Paid via Wallet';

      } else if (form.paymentMode === 'razorpay') {
        const rzpLoaded = await loadRazorpay();
        if (!rzpLoaded) { toast('Razorpay failed to load', 'error'); setSubmitting(false); return; }

        const { data: rzpOrder } = await walletApi.createTopupOrder(totalAmount);

        await new Promise<void>((resolve, reject) => {
          const options = {
            key:         rzpOrder.keyId,
            amount:      rzpOrder.amount,
            currency:    rzpOrder.currency,
            name:        'Swara Aqua',
            description: `Order #${orderId} — ${form.quantity} jars`,
            order_id:    rzpOrder.orderId,
            handler: async (response: any) => {
              try {
                await walletApi.verifyTopup({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  amount:              rzpOrder.amount,
                });
                await walletApi.payOrder(orderId);
                resolve();
              } catch { reject(new Error('Payment verification failed')); }
            },
            modal: { ondismiss: () => reject(new Error('dismissed')) },
            theme: { color: '#2563eb' },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        });
        modeLabel = 'Paid via Razorpay';
      }

      await enablePush();

      // Show success screen (server sends one push — no duplicate local alert)
      setOrderSuccess({ orderId, quantity: form.quantity, total: totalAmount, mode: modeLabel, scheduledForTomorrow });

      setShowForm(false);
      resetForm();
      await refresh();
    } catch (err: any) {
      if (err?.message !== 'dismissed') {
        toast(err?.response?.data?.message || err?.message || 'Failed to place order', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open detail ──────────────────────────────────────────────────────────────
  const openDetail = async (order: Order) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const { data } = await ordersApi.get(order.id);
      setSelected({ order: data.order, timeline: data.timeline, delivery: data.delivery });
    } catch {
      toast('Failed to load order details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Cancel order ─────────────────────────────────────────────────────────────
  const handleCancel = async (id: number, reason?: string) => {
    setCancelling(true);
    try {
      const payload = reason ? { reason } : {};
      const { data } = await ordersApi.cancel(id, payload);
      if (data.requiresApproval) {
        toast('Cancellation request submitted for admin review', 'success');
        setShowReasonModal(null);
        setCancelReason('');
      } else {
        toast('Order cancelled', 'warning');
      }
      setSelected(null);
      await refresh();
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp?.requiresReason) {
        // Need reason — show the reason modal
        setShowReasonModal(id);
      } else {
        toast(resp?.message || 'Cannot cancel this order', 'error');
      }
    } finally {
      setCancelling(false);
    }
  };

  const totalAmount = form.quantity * PRICE_PER_JAR;

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Order Success Screen ── */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-brand-600 via-aqua-500 to-emerald-500 px-6"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="w-full max-w-sm text-center"
            >
              {/* Animated tick circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 320, damping: 20 }}
                className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-2xl"
              >
                <motion.svg
                  viewBox="0 0 52 52"
                  className="w-12 h-12"
                  initial="hidden"
                  animate="visible"
                >
                  <motion.circle
                    cx="26" cy="26" r="24"
                    fill="none" stroke="white" strokeWidth="2.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.path
                    fill="none" stroke="white" strokeWidth="3.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    d="M14 26 l9 9 l15 -16"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
                  />
                </motion.svg>
              </motion.div>

              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <p className="text-white/80 text-sm font-semibold tracking-wide uppercase mb-1">
                  {orderSuccess.scheduledForTomorrow ? 'Scheduled for Tomorrow!' : 'Order Confirmed!'}
                </p>
                <h2 className="text-4xl font-extrabold text-white mb-1">₹{orderSuccess.total}</h2>
                <p className="text-white/70 text-sm mb-6">{orderSuccess.quantity} jar{orderSuccess.quantity > 1 ? 's' : ''} · {orderSuccess.mode}</p>

                {/* Order ID badge */}
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-2.5 mb-8">
                  <Droplets className="w-4 h-4 text-white/80" />
                  <span className="text-white font-bold text-sm">Order #{orderSuccess.orderId}</span>
                </div>

                <p className="text-white/60 text-xs mb-8">
                  {orderSuccess.scheduledForTomorrow
                    ? '🌙 Placed outside booking hours. Your order will be delivered tomorrow morning!'
                    : orderSuccess.mode === 'Cash on Delivery'
                      ? '💧 Your water is on the way! Pay when delivered.'
                      : '💧 Payment received. Your water is on the way!'}
                </p>

                <button
                  onClick={() => setOrderSuccess(null)}
                  className="w-full bg-white text-brand-700 font-bold text-base py-4 rounded-2xl shadow-xl hover:bg-white/90 active:scale-95 transition-all"
                >
                  View My Orders
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Place Order Form ── */}
      <AnimatePresence>
        {showForm && (
          <>
            {/* Mobile: full-screen overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setShowForm(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="
                fixed inset-x-0 bottom-0 z-50 md:relative md:inset-auto md:z-auto
                bg-white rounded-t-3xl md:rounded-2xl
                border-t border-brand-100 md:border md:shadow-lg
                max-h-[92vh] md:max-h-none overflow-y-auto
                shadow-[0_-8px_40px_rgba(0,0,0,0.12)] md:shadow-lg
              ">

              {/* Drag handle (mobile only) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>

              <div className="p-5 pt-3 md:p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base md:text-sm font-bold text-slate-800">Place New Order</h3>
                    <p className="text-xs text-slate-400 mt-0.5">₹{PRICE_PER_JAR} per jar</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-xl md:rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-4">
                  {/* Order type */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Order Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['instant', 'preorder', 'monthly', 'bulk'] as const).map(t => (
                        <button key={t} type="button"
                          onClick={() => setForm(f => ({ ...f, type: t }))}
                          className={`py-3 md:py-2.5 rounded-xl text-xs font-semibold border transition-all capitalize
                            ${form.type === t
                              ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-brand-50'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity + total */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Quantity (Jars)</label>
                      <input
                        type="number" min={1} value={form.quantity}
                        onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all font-semibold" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="bg-gradient-to-br from-brand-50 to-aqua-400/10 border border-brand-100 rounded-2xl px-4 py-3 text-center">
                        <p className="text-xs text-brand-500 font-medium">Total Amount</p>
                        <p className="text-xl font-bold text-brand-700">₹{totalAmount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Delivery date (preorder only) */}
                  {form.type === 'preorder' && (
                    <Input
                      label="Delivery Date & Time"
                      type="datetime-local"
                      value={form.deliveryDate}
                      onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                      required />
                  )}

                  {/* Address picker */}
                  <AddressPicker
                    address={form.address}
                    onSelect={(addr) => setForm(f => ({ ...f, address: addr }))}
                  />

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Notes (optional)</label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any special instructions…"
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
                  </div>

                  {/* Payment method — stacked on mobile, row on desktop */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Payment Method</label>
                    <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2">
                      {([
                        { key: 'cod',      label: 'Cash on Delivery', shortLabel: 'Cash / COD', icon: <Banknote className="w-5 h-5 sm:w-4 sm:h-4" /> },
                        { key: 'wallet',   label: `Wallet (₹${walletBalance})`, shortLabel: `Wallet · ₹${walletBalance}`, icon: <Wallet className="w-5 h-5 sm:w-4 sm:h-4" /> },
                        { key: 'razorpay', label: 'Pay Online', shortLabel: 'Pay Online', icon: <CreditCard className="w-5 h-5 sm:w-4 sm:h-4" /> },
                      ] as const).map(({ key, label, shortLabel, icon }) => (
                        <button key={key} type="button"
                          onClick={() => setForm(f => ({ ...f, paymentMode: key }))}
                          className={`
                            flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold border transition-all
                            sm:flex-col sm:items-center sm:gap-1.5 sm:py-3 sm:px-2 sm:text-xs
                            ${form.paymentMode === key
                              ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-brand-50'}`}>
                          {icon}
                          <span className="sm:hidden">{shortLabel}</span>
                          <span className="hidden sm:inline text-center leading-tight">{label}</span>
                          {form.paymentMode === key && (
                            <Check className="w-4 h-4 ml-auto sm:hidden" />
                          )}
                        </button>
                      ))}
                    </div>
                    {form.paymentMode === 'wallet' && walletBalance < totalAmount && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        Insufficient balance — need ₹{totalAmount - walletBalance} more.
                        <a href="/customer/wallet" className="underline font-semibold">Top up</a>
                      </p>
                    )}
                  </div>

                  {/* Sticky submit on mobile */}
                  <div className="sticky bottom-0 pt-2 pb-1 bg-white -mx-5 px-5 md:relative md:mx-0 md:px-0 md:pt-0 md:pb-0">
                    <Button type="submit" loading={submitting} size="lg" className="w-full !py-4 md:!py-3.5 text-sm"
                      icon={<Droplets className="w-4 h-4" />}>
                      <span className="sm:hidden">
                        {form.paymentMode === 'cod' ? `Place Order · ₹${totalAmount}`
                         : form.paymentMode === 'wallet' ? `Pay ₹${totalAmount} · Wallet`
                         : `Pay ₹${totalAmount} · Online`}
                      </span>
                      <span className="hidden sm:inline">
                        {form.paymentMode === 'cod'      ? `Place Order — Pay ₹${totalAmount} on delivery`
                         : form.paymentMode === 'wallet' ? `Pay ₹${totalAmount} from Wallet`
                         : `Pay ₹${totalAmount} via Razorpay`}
                      </span>
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Orders list ── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-brand-400" />
          </div>
          <p className="text-sm font-bold text-slate-700 mb-1">No orders yet</p>
          <p className="text-xs text-slate-400 mb-5">Place your first water order to get started.</p>
          <Button size="sm" onClick={() => setShowForm(true)} icon={<Plus className="w-3.5 h-3.5" />}>
            Place First Order
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => openDetail(order)}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 cursor-pointer hover:border-brand-200 hover:shadow-md transition-all group">

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">#{order.id}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize font-medium">
                    {order.type}
                  </span>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{order.quantity} Jars</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-brand-600">₹{order.total_amount}</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </div>

              {order.address && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />{order.address}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      <AnimatePresence>
        {(selected || detailLoading) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => !detailLoading && setSelected(null)}>

            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl">

              {detailLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) : selected && (
                <>
                  {/* Modal header */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Order #{selected.order.id}</p>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {selected.order.quantity} Jars — ₹{selected.order.total_amount}
                      </h3>
                    </div>
                    <button onClick={() => setSelected(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Type',      value: selected.order.type },
                        { label: 'Status',    value: <OrderStatusBadge status={selected.order.status} /> },
                        { label: 'Price/Jar', value: `₹${selected.order.price_per_jar}` },
                        { label: 'Total',     value: `₹${selected.order.total_amount}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-400 mb-1">{label}</p>
                          <div className="text-sm font-semibold text-slate-800 capitalize">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Delivery info */}
                    {selected.order.delivery_date && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <span className="text-base">📅</span>
                        <div>
                          <p className="text-xs text-blue-500 font-medium">Scheduled Delivery</p>
                          <p className="text-sm font-semibold text-blue-800">
                            {new Date(selected.order.delivery_date).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    )}

                    {selected.order.address && (
                      <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-700">{selected.order.address}</p>
                      </div>
                    )}

                    {selected.order.notes && (
                      <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-700">{selected.order.notes}</p>
                      </div>
                    )}

                    {/* Delivery record */}
                    {selected.delivery && (
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Delivery Record</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-green-600">Delivered Qty</p>
                            <p className="font-bold text-green-800">{selected.delivery.delivered_quantity} jars</p>
                          </div>
                          <div>
                            <p className="text-xs text-green-600">Amount Collected</p>
                            <p className="font-bold text-green-800">₹{selected.delivery.collected_amount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-green-600">Payment Mode</p>
                            <p className="font-bold text-green-800 capitalize">{selected.delivery.payment_mode}</p>
                          </div>
                          {selected.delivery.delivered_at && (
                            <div>
                              <p className="text-xs text-green-600">Delivered At</p>
                              <p className="font-bold text-green-800">
                                {new Date(selected.delivery.delivered_at).toLocaleString('en-IN')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {selected.timeline.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Order Timeline</p>
                        <div className="space-y-0">
                          {selected.timeline.map((t, i) => (
                            <div key={t.id} className="flex items-start gap-3">
                              <div className="flex flex-col items-center">
                                <span className="text-lg leading-none">{timelineIcon[t.status] || '🔵'}</span>
                                {i < selected.timeline.length - 1 && (
                                  <div className="w-px flex-1 bg-slate-200 my-1 min-h-[20px]" />
                                )}
                              </div>
                              <div className="flex-1 pb-3">
                                <p className="text-xs font-bold text-slate-700 capitalize">
                                  {t.status.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-slate-500">{t.note}</p>
                                <p className="text-[10px] text-slate-300 mt-0.5">
                                  {new Date(t.created_at).toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cancel button — smart policy */}
                    {!['completed', 'cancelled'].includes(selected.order.status) && (
                      <>
                        {(() => {
                          const ageMs = Date.now() - new Date(selected.order.created_at).getTime();
                          const isWithinHour = ageMs < 60 * 60 * 1000;
                          return isWithinHour ? (
                            <Button
                              variant="danger" size="md" className="w-full"
                              loading={cancelling}
                              onClick={() => handleCancel(selected.order.id)}>
                              Cancel Order
                            </Button>
                          ) : (
                            <Button
                              variant="danger" size="md" className="w-full"
                              loading={cancelling}
                              onClick={() => setShowReasonModal(selected.order.id)}>
                              Request Cancellation
                            </Button>
                          );
                        })()}
                      </>
                    )}

                    {/* Cancel reason modal */}
                    <AnimatePresence>
                      {showReasonModal === selected.order.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 mt-2">
                            <p className="text-xs font-bold text-red-700">This order is older than 1 hour. Please provide a reason:</p>
                            <textarea
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                              placeholder="Why do you want to cancel?"
                              rows={2}
                              className="w-full bg-white border border-red-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-red-400 transition-all resize-none" />
                            <div className="flex gap-2">
                              <Button variant="secondary" size="sm" className="flex-1"
                                onClick={() => { setShowReasonModal(null); setCancelReason(''); }}>
                                Never mind
                              </Button>
                              <Button variant="danger" size="sm" className="flex-1" loading={cancelling}
                                onClick={() => handleCancel(selected.order.id, cancelReason)}
                                disabled={!cancelReason.trim()}>
                                Submit Request
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Address Picker (Blinkit-style) ─────────────────────────────────────────────

const LABEL_ICONS: Record<string, React.ReactNode> = {
  Home:   <Home className="w-3.5 h-3.5" />,
  Work:   <Briefcase className="w-3.5 h-3.5" />,
  Other:  <MapPin className="w-3.5 h-3.5" />,
};

const AddressPicker = ({ address, onSelect }: { address: string; onSelect: (addr: string) => void }) => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [showNew, setShowNew]     = useState(false);
  const [showMap, setShowMap]     = useState(false);
  const [newAddr, setNewAddr]     = useState('');
  const [newLabel, setNewLabel]   = useState('Home');
  const [locating, setLocating]   = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    addressApi.list().then(({ data }) => {
      setAddresses(data.addresses);
      // Auto-select default if no address chosen yet
      if (!address) {
        const def = data.addresses.find(a => a.is_default) || data.addresses[0];
        if (def) onSelect(def.address);
      }
    }).catch(() => {});
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await r.json();
          const addr = data.display_name || `${pos.coords.latitude}, ${pos.coords.longitude}`;
          setNewAddr(addr);
        } catch {
          setNewAddr(`${pos.coords.latitude}, ${pos.coords.longitude}`);
        } finally { setLocating(false); }
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveNew = async () => {
    if (!newAddr.trim()) return;
    setSaving(true);
    try {
      await addressApi.add({ label: newLabel, address: newAddr.trim(), isDefault: addresses.length === 0 });
      const updated = await addressApi.list();
      setAddresses(updated.data.addresses);
      onSelect(newAddr.trim());
      setShowNew(false); setNewAddr(''); setNewLabel('Home');
    } catch {} finally { setSaving(false); }
  };

  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Delivery Address</label>

      {/* Map picker modal */}
      {showMap && (
        <MapPicker
          onConfirm={(addr, lat, lng) => {
            setNewAddr(addr);
            onSelect(addr);
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Saved addresses */}
      {addresses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {addresses.map(a => {
            const isSelected = address === a.address;
            return (
              <button key={a.id} type="button" onClick={() => onSelect(a.address)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                  ${isSelected
                    ? 'bg-brand-600 text-white border-brand-600 shadow-brand'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:bg-brand-50'
                  }`}>
                {LABEL_ICONS[a.label] || <MapPin className="w-3.5 h-3.5" />}
                <span className="max-w-[140px] truncate">{a.label}</span>
                {a.is_default && !isSelected && (
                  <span className="text-[9px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">Default</span>
                )}
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected address display */}
      {address && !showNew && (
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-2">
          <MapPin className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700 flex-1">{address}</p>
          <button type="button" onClick={() => setShowNew(true)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 whitespace-nowrap">Change</button>
        </div>
      )}

      {/* Add new address */}
      {(showNew || addresses.length === 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
          <div className="flex gap-2">
            {['Home', 'Work', 'Other'].map(l => (
              <button key={l} type="button" onClick={() => setNewLabel(l)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all
                  ${newLabel === l ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                {LABEL_ICONS[l]}{l}
              </button>
            ))}
          </div>
          <textarea
            value={newAddr}
            onChange={e => setNewAddr(e.target.value)}
            placeholder="Enter full delivery address..."
            rows={2}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
          />
          {/* Location tools row */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleLocate}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              <Navigation className="w-3.5 h-3.5" />
              {locating ? 'Locating...' : 'Use GPS'}
            </button>
            <button type="button" onClick={() => setShowMap(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors">
              <Map className="w-3.5 h-3.5" />
              Pick on Map
            </button>
          </div>
          {/* Action buttons row — wraps on small screens */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {addresses.length > 0 && (
              <button type="button" onClick={() => setShowNew(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
            )}
            <button type="button" onClick={handleSaveNew} disabled={!newAddr.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-all">
              <Plus className="w-3 h-3" />{saving ? 'Saving...' : 'Save & Use'}
            </button>
          </div>
        </div>
      )}

      {!address && addresses.length === 0 && !showNew && (
        <p className="text-xs text-slate-400 mt-1">Add your delivery address to continue</p>
      )}
    </div>
  );
};

