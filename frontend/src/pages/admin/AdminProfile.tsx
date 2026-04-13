import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Shield, Activity, LogOut, Lock, KeyRound, Eye, EyeOff, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';

export const AdminProfile = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw]     = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
    if (newPw !== confirmPw) { toast('Passwords do not match', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      toast('Password changed successfully', 'success');
      setShowPwModal(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to change password', 'error');
    } finally { setSubmitting(false); }
  };

  const joinDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="max-w-lg space-y-5">

      {/* Avatar card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-gradient-to-br from-brand-700 via-brand-600 to-aqua-600 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -left-6 -bottom-10 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-18 h-18 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shrink-0"
            style={{ width: 72, height: 72 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <p className="text-white/60 text-sm mt-0.5">{user?.phone}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full">
                {user?.role}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2.5 py-1 rounded-full">
                {user?.status}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {[
          { icon: Phone, label: 'Phone Number', value: user?.phone },
          { icon: Shield, label: 'Role', value: 'Administrator' },
          { icon: Activity, label: 'Account Status', value: user?.status },
          { icon: CalendarDays, label: 'Member Since', value: joinDate },
        ].map(({ icon: Icon, label, value }, i, arr) => (
          <div key={label} className={`flex items-center gap-4 px-5 py-4 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-medium">{label}</p>
              <p className="text-sm font-semibold text-slate-800 capitalize mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Security section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-400" />
            Security
          </h3>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Password</p>
              <p className="text-xs text-slate-400 mt-0.5">Last changed: Not tracked</p>
            </div>
            <Button variant="secondary" size="sm"
              icon={<Lock className="w-3.5 h-3.5" />}
              onClick={() => setShowPwModal(true)}>
              Change
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <Button variant="danger" size="lg" className="w-full" icon={<LogOut className="w-4 h-4" />} onClick={logout}>
          Sign Out
        </Button>
      </motion.div>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPwModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPwModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-xl flex items-center justify-center">
                    <KeyRound className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                    <p className="text-xs text-slate-400">Enter your current and new password</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Current Password</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Enter current password"
                      className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder-slate-400"
                      required />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="ml-2 text-slate-400 hover:text-slate-600">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">New Password</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                    <KeyRound className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder-slate-400"
                      required />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="ml-2 text-slate-400 hover:text-slate-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Re-enter new password"
                      className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder-slate-400"
                      required />
                  </div>
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="secondary" size="md" className="flex-1"
                    onClick={() => setShowPwModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="md" className="flex-1" loading={submitting}
                    icon={<KeyRound className="w-4 h-4" />}>
                    Update Password
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
