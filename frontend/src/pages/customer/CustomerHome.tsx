import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Droplets, ArrowRight, Plus,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { TouchEvent } from 'react';
import api, { getUploadUrl } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../../components/ui/Toast';
import { subscriptionApi, Subscription } from '../../api/subscription';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } };

// ── Banner Carousel (API-driven, desktop) ──────────────────────────────────────
interface Banner { id: number; title: string | null; image_url: string; link_url: string | null; }

const BannerCarousel = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannersRef = useRef<Banner[]>([]);

  useEffect(() => {
    api.get('/banners/active')
      .then((res) => {
        const list: Banner[] = res.data.banners || [];
        setBanners(list);
        bannersRef.current = list;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Single interval — start once banners load, clear on unmount
  useEffect(() => {
    if (banners.length < 2) return;
    // Clear any existing interval before starting a new one
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % bannersRef.current.length);
    }, 4000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [banners.length]);

  const go = (dir: 1 | -1) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCurrent(c => (c + dir + bannersRef.current.length) % bannersRef.current.length);
    if (bannersRef.current.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent(c => (c + 1) % bannersRef.current.length);
      }, 4000);
    }
  };

  if (loading) return <div className="h-44 w-full rounded-3xl bg-slate-100 animate-pulse" />;
  if (banners.length === 0) return null;

  const safeIndex = current % banners.length;
  const b = banners[safeIndex];
  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-lg">
      <AnimatePresence mode="wait">
        <motion.div key={b.id} className="w-full"
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
          {b.link_url ? (
            <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="block w-full">
              <img src={getUploadUrl(b.image_url)} alt={b.title || 'Banner'}
                className="w-full h-44 sm:h-52 object-cover block"
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x300/e2e8f0/94a3b8?text=Banner'; }} />
            </a>
          ) : (
            <img src={getUploadUrl(b.image_url)} alt={b.title || 'Banner'}
              className="w-full h-44 sm:h-52 object-cover block"
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
                className={`h-1.5 rounded-full transition-all duration-300 ${i === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Promo Image Carousel (static images, peek-style) ──────────────────────────
const PROMO_IMAGES = [
  '/show/image1.png',
  '/show/image2.png',
  '/show/image3.png',
];

const SLIDE_WIDTH_PERCENT = 72; // each slide takes 72% of container
const SLIDE_GAP = 12;           // px gap between slides

const PromoCarousel = () => {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const total = PROMO_IMAGES.length;

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    // Scroll the container to the correct position
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.offsetWidth;
      const slideWidth = (containerWidth * SLIDE_WIDTH_PERCENT) / 100;
      const scrollTo = index * (slideWidth + SLIDE_GAP);
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => {
        const next = prev + 1 >= total ? 0 : prev + 1;
        if (scrollRef.current) {
          if (next === 0) {
            scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            const containerWidth = scrollRef.current.offsetWidth;
            const slideWidth = (containerWidth * SLIDE_WIDTH_PERCENT) / 100;
            const scrollTo = next * (slideWidth + SLIDE_GAP);
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
          }
        }
        return next;
      });
    }, 3000);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // Touch handling for manual swipe
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      const next = diff > 0
        ? (current + 1) % total
        : (current - 1 + total) % total;
      goTo(next);
    }
    resetTimer();
  };

  // Sync current index on manual scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.offsetWidth;
    const slideWidth = (containerWidth * SLIDE_WIDTH_PERCENT) / 100;
    const scrollLeft = scrollRef.current.scrollLeft;
    const index = Math.round(scrollLeft / (slideWidth + SLIDE_GAP));
    if (index !== current && index >= 0 && index < total) {
      setCurrent(index);
    }
  };

  return (
    <div className="promo-carousel-outer">
      <div
        className="promo-carousel-scroll no-scrollbar"
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
      >
        {PROMO_IMAGES.map((src, i) => (
          <div className="promo-carousel-card" key={i}>
            <img
              src={src}
              alt={`Promo ${i + 1}`}
              className="promo-carousel-card-img"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="promo-carousel-dots">
        {PROMO_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); resetTimer(); }}
            className={`promo-dot ${i === current ? 'promo-dot-active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const CustomerHome = ({ onOrderPress }: { onOrderPress?: () => void }) => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { refresh } = useOrders();

  // Active plan
  const [plan, setPlan] = useState<Subscription | null>(null);
  useEffect(() => {
    subscriptionApi.getMy().then((res) => setPlan(res.data.subscription)).catch(() => {});
  }, []);

  // Poll: auto-refresh when order status changes
  useSSE({
    order_status_changed: () => refresh(),
  });

  const handleOrder = () => {
    if (onOrderPress) onOrderPress(); else navigate('/customer/orders?new=1');
  };

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Section: We Serve At ── */}
      <div className="flex items-center gap-3">
        <h3 style={{ fontFamily: "'DM Sans', sans-serif" }}
          className="text-sm font-medium text-slate-500 whitespace-nowrap tracking-wide">
          We Serve At
        </h3>
        <div className="flex-1 h-px bg-slate-200 rounded-full" />
      </div>

      {/* ── Banner Carousel ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <BannerCarousel />
      </motion.div>

      {/* ── Order Card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="order-promo-card rounded-3xl px-5 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl leading-tight">
            <span className="font-extrabold text-white">Swara </span>
            <span className="font-normal text-white/90">Regular</span>
          </h2>
          <p className="text-white/70 text-sm mt-1">
            <span className="text-2xl font-extrabold text-white">₹{user?.jar_rate || 50}</span>
            <span className="text-white/60 text-xs ml-1">per refill</span>
          </p>
        </div>
        <button
          onClick={handleOrder}
          className="bg-white text-brand-600 font-bold text-sm px-5 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all"
        >
          Order Now
        </button>
      </motion.div>

      {/* ── Promo Image Carousel (mobile only) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="block md:hidden"
      >
        <PromoCarousel />
      </motion.div>

      {/* ── Active Plan Card ── */}
      {plan && plan.status === 'active' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          onClick={() => navigate('/customer/subscription')}
          className="bg-white rounded-2xl border border-purple-100 shadow-card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">My Daily Plan</span>
            </div>
            <span className="text-[10px] font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full uppercase">Active</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {plan.slots?.map(slot => (
                <div key={slot.id} className="flex items-center gap-1.5 bg-purple-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs font-bold text-purple-700">{slot.slot_label}</span>
                  <span className="text-[10px] text-purple-500">{slot.delivery_time}</span>
                  <span className="text-xs font-extrabold text-purple-700 bg-purple-100 rounded px-1">{slot.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-400">
                {plan.slots?.reduce((s, sl) => s + sl.quantity, 0)} jars/day · ₹{(plan.slots?.reduce((s, sl) => s + sl.quantity, 0) || 0) * (user?.jar_rate || 50)}/day
              </p>
              <span className="text-[10px] font-semibold text-purple-500 flex items-center gap-0.5">
                View Plan <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Section: Quick Actions ── */}
      <div className="flex items-center gap-3 mt-2">
        <h3 style={{ fontFamily: "'DM Sans', sans-serif" }}
          className="text-sm font-medium text-slate-500 whitespace-nowrap tracking-wide">
          Quick Actions
        </h3>
        <div className="flex-1 h-px bg-slate-200 rounded-full" />
      </div>

      {/* ── Quick actions ── */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Plus,       label: 'Order',    color: 'bg-brand-600',  iconColor: 'text-white',    action: handleOrder },
            { icon: Package,    label: 'Orders',   color: 'bg-green-100',  iconColor: 'text-green-600', action: () => navigate('/customer/orders') },
            { icon: Droplets,   label: 'Refill',   color: 'bg-blue-100',   iconColor: 'text-blue-600',  action: handleOrder },
            { icon: TrendingUp, label: 'Bills',    color: 'bg-amber-100',  iconColor: 'text-amber-600', action: () => navigate('/customer/bills') },
          ].map(({ icon: Icon, label, color, iconColor, action }) => (
            <motion.button key={label} variants={fadeUp} onClick={action}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl active:scale-95 transition-transform">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color} shadow-sm`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif" }}
                className="text-xs font-normal text-slate-500">{label}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Tagline ── */}
      <div className="py-10 mt-4 pl-1">
        <p className="text-4xl font-extrabold text-blue-400 leading-tight">
          Stay
        </p>
        <p className="text-4xl font-extrabold text-blue-400 leading-tight">
          hydrated !!
        </p>
        <p className="text-xl font-semibold text-slate-400 mt-3">
          With Swara Aqua
        </p>
      </div>
    </div>
  );
};
