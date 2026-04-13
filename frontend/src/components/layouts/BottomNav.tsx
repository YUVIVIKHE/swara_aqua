import { NavLink, useLocation } from 'react-router-dom';
import { LucideIcon, MoreHorizontal, X, Plus } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem { label: string; icon: LucideIcon; to: string; }
interface Props {
  items: NavItem[];
  onOrderPress?: () => void; // customer FAB callback
}

// ── Simple bottom nav (≤4 items) or Customer (with FAB) ─────────────────────
const SimpleBottomNav = ({ items, onOrderPress }: Props) => {
  const isCustomer = !!onOrderPress;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100 shadow-[0_-2px_16px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center h-16">
        {isCustomer ? (
          <>
            {/* Left 2 items */}
            {items.slice(0, 2).map(({ label, icon: Icon, to }) => (
              <NavTab key={to} to={to} label={label} Icon={Icon} />
            ))}

            {/* Center Order button */}
            <div className="flex-1 flex flex-col items-center justify-center gap-0.5 px-1">
              <button
                onClick={onOrderPress}
                className="flex items-center gap-1.5 bg-gradient-to-r from-brand-600 to-aqua-500 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-[0_4px_14px_rgba(37,99,235,0.4)] active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Order
              </button>
            </div>

            {/* Right 2 items */}
            {items.slice(2).map(({ label, icon: Icon, to }) => (
              <NavTab key={to} to={to} label={label} Icon={Icon} />
            ))}
          </>
        ) : (
          items.map(({ label, icon: Icon, to }) => (
            <NavTab key={to} to={to} label={label} Icon={Icon} />
          ))
        )}
      </div>
    </nav>
  );
};


// ── Reusable nav tab ──────────────────────────────────────────────────────────
const NavTab = ({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) => (
  <NavLink
    to={to} end
    className={({ isActive }) =>
      `flex flex-col items-center gap-0.5 flex-1 py-1 rounded-xl transition-all duration-200 ${isActive ? 'text-brand-600' : 'text-slate-400'}`
    }
  >
    {({ isActive }) => (
      <>
        <span className={`flex items-center justify-center w-10 h-6 rounded-full transition-all duration-200 ${isActive ? 'bg-brand-100' : ''}`}>
          <Icon className={`w-5 h-5 transition-all ${isActive ? 'text-brand-600 scale-110' : 'text-slate-400'}`} />
        </span>
        <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
          {label}
        </span>
      </>
    )}
  </NavLink>
);

// ── Admin bottom nav with "More" overflow drawer (>5 items) ─────────────────
const AdminBottomNav = ({ items }: { items: NavItem[] }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const overflowActive = overflow.some(item => pathname === item.to || pathname.startsWith(item.to + '/'));

  return (
    <>
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onPointerDown={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl border-t border-slate-100"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-bold text-slate-800">More</p>
              <button onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 px-4 pb-6">
              {overflow.map(({ label, icon: Icon, to }) => (
                <NavLink key={to} to={to} end onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all ${isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-50'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
                      <span className={`text-[10px] font-semibold text-center leading-tight ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-around items-end px-1 pt-2 pb-2">
          {primary.map(({ label, icon: Icon, to }) => (
            <NavTab key={to} to={to} label={label} Icon={Icon} />
          ))}
          <button onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 rounded-xl transition-all duration-200 ${overflowActive ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className={`flex items-center justify-center w-10 h-6 rounded-full transition-all duration-200 ${overflowActive ? 'bg-brand-100' : ''}`}>
              <MoreHorizontal className={`w-5 h-5 ${overflowActive ? 'text-brand-600' : 'text-slate-400'}`} />
            </span>
            <span className={`text-[10px] font-semibold leading-none ${overflowActive ? 'text-brand-600' : 'text-slate-400'}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export const BottomNav = ({ items, onOrderPress }: Props) => {
  if (items.length > 5) return <AdminBottomNav items={items} />;
  return <SimpleBottomNav items={items} onOrderPress={onOrderPress} />;
};
