import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Droplets, ArrowRight, Plus, MapPin,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  TrendingUp, CheckCircle2, Timer,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../../components/ui/Toast';
import { OrderStatusBadge } from '../../components/ui/OrderStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } };

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'completed' || status === 'delivered') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'cancelled') return <div className="w-4 h-4 rounded-full border-2 border-slate-300" />;
  return <Timer className="w-4 h-4 text-amber-500" />;
};

// ── Banner Carousel ────────────────────────────────────────────────────────────
interface Banner { id: number; title: string | null; image_url: string; link_url: string | null; }

const BannerCarousel = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/banners/active')
      .then(({ data }) => setBanners(data.banners || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const start = (len: number) => {
    if (len < 2) return;
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % len), 4000);
  };

  useEffect(() => {
    if (banners.length > 1) start(banners.length);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners]);

  const go = (dir: 1 | -1) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent(c => (c + dir + banners.length) % banners.length);
    start(banners.length);
  };

  if (loading) return <div className="h-40 rounded-3xl bg-slate-100 animate-pulse" />;
  if (banners.length === 0) return null;

  const b = banners[current];
  return (
    <div className="relative rounded-3xl overflow-hidden shadow-lg">
      <AnimatePresence mode="wait">
        <motion.div key={b.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
          {b.link_url ? (
            <a href={b.link_url} target="_blank" rel="noopener noreferrer">
              <img src={b.image_url} alt={b.title || 'Banner'}
                className="w-full h-40 sm:h-48 object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x300/e2e8f0/94a3b8?text=Banner'; }} />
            </a>
          ) : (
            <img src={b.image_url} alt={b.title || 'Banner'}
              className="w-full h-40 sm:h-48 object-cover"
              onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x300/e2e8f0/94a3b8?text=Banner'; }} />
          )}
          {b.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-5 py-4">
              <p className="text-white text-sm font-bold">{b.title}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
            <ChevronRightIcon className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const CustomerHome = ({ onOrderPress }: { onOrderPress?: () => void }) => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { orders, loading, refresh } = useOrders();
  const isActive  = user?.status === 'active';
  const recent    = orders.slice(0, 3);

  // SSE: auto-refresh when order status changes
  useSSE({
    order_status_changed: () => { refresh(); toast('Order status updated!', 'success'); },
  });

  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
  const pendingOrders   = orders.filter(o => o.status === 'pending' || o.status === 'assigned' || o.status === 'out_for_delivery').length;

  const handleOrder = () => {
    if (onOrderPress) onOrderPress(); else navigate('/customer/orders?new=1');
  };

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Greeting header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-card px-5 py-4 flex items-center gap-4">

        {/* Avatar */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-aqua-400 flex items-center justify-center text-white font-extrabold text-xl shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
          {user?.name?.charAt(0).toUpperCase()}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium">Good day 👋</p>
          <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{user?.name?.split(' ')[0]}</h2>
          {!isActive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Pending approval
            </span>
          ) : orders.length > 0 ? (
            <p className="text-xs text-slate-400 mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Welcome to Swara Aqua</p>
          )}
        </div>

        {/* Right: live stat pills */}
        {isActive && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {pendingOrders > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                {pendingOrders} active
              </span>
            )}
            {completedOrders > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                {completedOrders} done
              </span>
            )}
            {orders.length === 0 && (
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                <Droplets className="w-5 h-5 text-brand-400" />
              </div>
            )}
          </div>
        )}
      </motion.div>


      {/* ── Banner Carousel ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <BannerCarousel />
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Plus,     label: 'Order Water',  sub: 'Place new order',    bg: 'bg-gradient-to-br from-brand-600 to-aqua-500', iconBg: '', textColor: 'text-white', subColor: 'text-white/70', featured: true, action: handleOrder },
            { icon: Package,  label: 'My Orders',    sub: 'Track deliveries',   bg: 'bg-white',                                      iconBg: 'bg-green-50',   textColor: 'text-slate-800', subColor: 'text-slate-400', featured: false, action: () => navigate('/customer/orders') },
            { icon: Droplets, label: 'Refill Jar',   sub: 'Schedule refill',    bg: 'bg-white',                                      iconBg: 'bg-brand-50',   textColor: 'text-slate-800', subColor: 'text-slate-400', featured: false, action: handleOrder },
            { icon: TrendingUp, label: 'My Bills',   sub: 'View billing',       bg: 'bg-white',                                      iconBg: 'bg-amber-50',   textColor: 'text-slate-800', subColor: 'text-slate-400', featured: false, action: () => navigate('/customer/bills') },
          ].map(({ icon: Icon, label, sub, bg, iconBg, textColor, subColor, featured, action }) => (
            <motion.button key={label} variants={fadeUp} onClick={action}
              className={`flex flex-col p-4 rounded-2xl border transition-all text-left active:scale-[0.97] ${
                featured
                  ? 'border-brand-500 shadow-[0_4px_20px_rgba(37,99,235,0.25)]'
                  : 'border-slate-100 shadow-card hover:border-brand-200 hover:shadow-md'
              } ${bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${featured ? 'bg-white/20' : iconBg}`}>
                <Icon className={`w-5 h-5 ${featured ? 'text-white' : 'text-brand-600'}`} />
              </div>
              <p className={`text-sm font-bold ${textColor}`}>{label}</p>
              <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Recent orders ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Orders</p>
          <button onClick={() => navigate('/customer/orders')}
            className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-50 to-aqua-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-7 h-7 text-brand-400" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No orders yet</p>
            <p className="text-xs text-slate-400 mb-4">Tap below to place your first water order.</p>
            <button onClick={handleOrder}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 text-white text-xs font-bold rounded-xl shadow-brand hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Place Order
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recent.map((order, i) => (
              <motion.div key={order.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                onClick={() => navigate('/customer/orders')}
                className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 cursor-pointer hover:border-brand-200 hover:shadow-md active:scale-[0.99] transition-all group">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status icon */}
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                      <StatusIcon status={order.status} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-slate-800">{order.quantity} Jars</p>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize font-medium">{order.type}</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {order.address && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate max-w-[100px]">{order.address}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-600">₹{order.total_amount}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-brand-400 transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
