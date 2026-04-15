import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, ChevronDown, LogOut, User, CheckCheck, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import api from '../../api/axios';

interface Notification {
  id: number; title: string; body: string;
  type: string; is_read: number; created_at: string;
}

export const TopNavbar = ({ title }: { title: string }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unregisterToken } = useNotifications(user?.id);

  // Derive profile path from user role
  const profilePath = user?.role === 'admin'
    ? '/admin/profile'
    : user?.role === 'staff'
    ? '/staff/profile'
    : '/customer/profile';

  const [profileOpen, setProfileOpen]   = useState(false);
  const [bellOpen,    setBellOpen]       = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef    = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (bellRef.current    && !bellRef.current.contains(e.target as Node))    setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s for new notifications
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch wallet balance for customers
  useEffect(() => {
    if (user?.role === 'customer') {
      api.get('/wallet').then(({ data }) => setWalletBalance(data.balance)).catch(() => {});
    }
  }, [user]);

  const handleMarkRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleLogout = async () => {
    await unregisterToken();
    logout();
  };

  const typeIcon: Record<string, string> = {
    order: '📦', payment: '💳', delivery: '🚚', approval: '✅', stock: '⚠️', general: '🔔',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 z-20">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-48 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input placeholder="Search..." className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full" />
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) fetchNotifications(); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
            <Bell className="w-4.5 h-4.5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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
                    <button onClick={handleMarkAllRead}
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
                        onClick={() => !n.is_read && handleMarkRead(n.id)}
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
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
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
                  {user?.role === 'customer' && (
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
        </div>
      </div>
    </header>
  );
};
