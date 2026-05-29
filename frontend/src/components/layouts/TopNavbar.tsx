import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, ChevronDown, LogOut, User, CheckCheck, Wallet, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotificationCenter } from '../../context/NotificationContext';
import api from '../../api/axios';
import { addressApi, type UserAddress } from '../../api/address';

export const TopNavbar = ({ title, onOrderPress }: { title: string; onOrderPress?: () => void }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    unregisterPush,
  } = useNotificationCenter();
  const isCustomer = user?.role === 'customer';

  // Derive profile path from user role
  const profilePath = user?.role === 'admin'
    ? '/admin/profile'
    : user?.role === 'staff'
      ? '/staff/profile'
      : '/customer/profile';

  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch wallet balance for customers
  useEffect(() => {
    if (isCustomer) {
      api.get('/wallet').then(({ data }) => setWalletBalance(data.balance)).catch(() => { });
    }
  }, [user]);

  // Fetch default address for customer mobile header
  useEffect(() => {
    if (isCustomer) {
      addressApi.list()
        .then(({ data }) => {
          const def = data.addresses.find(a => a.is_default) || data.addresses[0] || null;
          setDefaultAddress(def);
        })
        .catch(() => { });
    }
  }, [isCustomer]);

  const handleLogout = async () => {
    await unregisterPush();
    logout();
  };

  const typeIcon: Record<string, string> = {
    order: '📦', payment: '💳', delivery: '🚚', approval: '✅', stock: '⚠️', general: '🔔',
  };

  // ── Notification dropdown (shared between both headers) ──
  const NotificationDropdown = () => (
    <AnimatePresence>
      {bellOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-[4.5rem] sm:top-full sm:mt-2 sm:w-80 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!n.is_read ? 'bg-brand-50/40' : ''}`}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{typeIcon[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold text-slate-800 truncate ${!n.is_read ? 'text-slate-900' : ''}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-brand-500 rounded-full shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Profile dropdown (shared) ──
  const ProfileDropdown = () => (
    <AnimatePresence>
      {profileOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.phone}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => { setProfileOpen(false); navigate(profilePath); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              <User className="w-4 h-4" /> My Profile
            </button>
            {isCustomer && (
              <button
                onClick={() => { setProfileOpen(false); navigate('/customer/wallet'); }}
                className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4" /> My Wallet
                </span>
                {walletBalance !== null && (
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    ₹{walletBalance.toFixed(0)}
                  </span>
                )}
              </button>
            )}
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* ── Customer Mobile Blue Header ── */}
      {isCustomer && (
        <header className="md:hidden customer-mobile-header shrink-0 z-20">
          {title === 'My Orders' ? (
            /* ── Orders Page: Order Jar Header ── */
            <>
              <div className="flex items-center justify-between px-5 pt-3 pb-14">
                <h2 className="text-2xl font-extrabold text-white italic">Order Jar</h2>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="relative" ref={bellRef}>
                    <button onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) refresh(); }}
                      className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
                      <Bell className="w-5 h-5 text-white" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-blue-600">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                    <NotificationDropdown />
                  </div>
                  <div className="relative" ref={profileRef}>
                    <button onClick={() => setProfileOpen(!profileOpen)}
                      className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm hover:bg-white/30 transition-colors">
                      {user?.name?.charAt(0).toUpperCase()}
                    </button>
                    <ProfileDropdown />
                  </div>
                </div>
              </div>
              {/* Deliver-to card overlapping */}
              <div className="px-4 -mt-10 relative z-10 mb-3">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3">
                  <p className="text-[11px] text-slate-400 font-medium mb-1">Deliver to:</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {defaultAddress?.label || 'Set Location'}
                      </p>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium shrink-0">
                        {defaultAddress?.label || 'Others'}
                      </span>
                    </div>
                    <button
                      onClick={onOrderPress}
                      className="bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-brand-600 active:scale-95 transition-all shrink-0 ml-2"
                    >
                      + New Order
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate pl-6">
                    {defaultAddress?.address || 'Add your delivery address'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* ── Default: Location Header ── */
            <div className="flex items-center justify-between px-5 pt-5 pb-6">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-5 h-5 text-white shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-bold text-white truncate max-w-[180px]">
                      {defaultAddress?.label || 'Set Location'}
                    </p>
                    <ChevronDown className="w-3.5 h-3.5 text-white/70 shrink-0" />
                  </div>
                  <p className="text-[11px] text-white/60 truncate max-w-[200px]">
                    {defaultAddress?.address || 'Add your delivery address'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="relative" ref={bellRef}>
                  <button onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) refresh(); }}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
                    <Bell className="w-5 h-5 text-white" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-blue-600">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationDropdown />
                </div>

                <div className="relative" ref={profileRef}>
                  <button onClick={() => setProfileOpen(!profileOpen)}
                    className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm hover:bg-white/30 transition-colors">
                    {user?.name?.charAt(0).toUpperCase()}
                  </button>
                  <ProfileDropdown />
                </div>
              </div>
            </div>
          )}
        </header>
      )}

      {/* ── Default Header (desktop, or non-customer roles) ── */}
      <header className={`h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 z-20 ${isCustomer ? 'hidden md:flex' : ''}`}>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-48 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input placeholder="Search..." className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full" />
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={isCustomer ? undefined : bellRef}>
            <button onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) refresh(); }}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
              <Bell className="w-4.5 h-4.5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {!isCustomer && <NotificationDropdown />}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={isCustomer ? undefined : profileRef}>
            <button onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="w-8 h-8 bg-gradient-aqua rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {!isCustomer && <ProfileDropdown />}
          </div>
        </div>
      </header>
    </>
  );
};
