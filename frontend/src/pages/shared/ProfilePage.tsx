import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, LogOut, Edit3, Key, MapPin,
  Check, ChevronRight, Eye, EyeOff, Plus, Trash2,
  Home, Briefcase, Star, Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

type Section = 'name' | 'password' | null;

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [openSection, setOpenSection] = useState<Section>(null);
  const toggle = (s: Section) => setOpenSection(prev => prev === s ? null : s);

  // ── Name edit ──
  const [name,        setName]        = useState(user?.name || '');
  const [savingName,  setSavingName]  = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      toast('Name updated!', 'success');
      setOpenSection(null);
      // Reload to reflect the change
      window.location.reload();
    } catch { toast('Failed to update name', 'error'); }
    finally { setSavingName(false); }
  };

  // ── Password change ──
  const [oldPwd,      setOldPwd]      = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [savingPwd,   setSavingPwd]   = useState(false);

  const handleSavePwd = async () => {
    if (!oldPwd || newPwd.length < 6) {
      toast('New password must be at least 6 characters', 'error'); return;
    }
    setSavingPwd(true);
    try {
      await api.patch('/auth/profile', { currentPassword: oldPwd, newPassword: newPwd });
      toast('Password updated!', 'success');
      setOldPwd(''); setNewPwd('');
      setOpenSection(null);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to update password', 'error');
    } finally { setSavingPwd(false); }
  };

  const roleMeta: Record<string, { label: string; color: string }> = {
    admin:    { label: 'Admin',    color: 'bg-purple-100 text-purple-700' },
    staff:    { label: 'Staff',    color: 'bg-blue-100 text-blue-700' },
    customer: { label: 'Customer', color: 'bg-brand-100 text-brand-700' },
  };

  const statusMeta: Record<string, { label: string; color: string }> = {
    active:   { label: 'Active',   color: 'bg-green-100 text-green-700' },
    pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  };

  const role   = roleMeta[user?.role || '']   || { label: user?.role || '',   color: 'bg-slate-100 text-slate-600' };
  const status = statusMeta[user?.status || ''] || { label: user?.status || '', color: 'bg-slate-100 text-slate-600' };

  return (
    <div className="max-w-lg space-y-4">

      {/* ── Avatar Card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-gradient-to-br from-brand-600 to-aqua-500 rounded-3xl p-6 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute right-8 -bottom-6 w-20 h-20 rounded-full bg-white/10" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-xl truncate">{user?.name}</h2>
            <p className="text-white/70 text-sm mt-0.5">{user?.phone}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${role.color}`}>{role.label}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Account Details ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Info</p>
        </div>

        {/* Phone — display only */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50">
          <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-slate-400 font-medium">Phone Number</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{user?.phone}</p>
          </div>
        </div>

        {/* Edit Name */}
        <div className="border-b border-slate-50">
          <button onClick={() => toggle('name')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left">
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 font-medium">Full Name</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{user?.name}</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${openSection === 'name' ? 'rotate-90' : ''}`} />
          </button>
          <AnimatePresence>
            {openSection === 'name' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3">
                  <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Your full name" />
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setOpenSection(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" loading={savingName} icon={<Check className="w-4 h-4" />} onClick={handleSaveName}>
                      Save
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Change Password */}
        <div>
          <button onClick={() => toggle('password')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left">
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
              <Key className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 font-medium">Password</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">Change password</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${openSection === 'password' ? 'rotate-90' : ''}`} />
          </button>
          <AnimatePresence>
            {openSection === 'password' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-3">
                  <div className="relative">
                    <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)}
                      className={inputCls + ' pr-10'} placeholder="Current password" />
                    <button type="button" onClick={() => setShowOld(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      className={inputCls + ' pr-10'} placeholder="New password (min 6 chars)" />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setOpenSection(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" loading={savingPwd} icon={<Check className="w-4 h-4" />} onClick={handleSavePwd}>
                      Update
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Saved Addresses (customer only) ── */}
      {user?.role === 'customer' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <AddressSection />
        </motion.div>
      )}

      {/* ── Wallet shortcut (customer only) ── */}
      {user?.role === 'customer' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <button onClick={() => navigate('/customer/wallet')}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-card hover:border-brand-200 hover:shadow-md transition-all text-left">
            <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-brand-500" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 font-medium">Wallet</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">View balance & top up</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </motion.div>
      )}

      {/* ── Sign out ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 border border-red-100 text-red-600 font-semibold text-sm rounded-2xl hover:bg-red-100 active:scale-[0.98] transition-all">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>
    </div>
  );
};

// ── Address Section ────────────────────────────────────────────────────────────
import { addressApi, UserAddress } from '../../api/address';
import { useEffect } from 'react';

const LABEL_ICONS: Record<string, React.ReactNode> = {
  Home:  <Home className="w-3.5 h-3.5" />,
  Work:  <Briefcase className="w-3.5 h-3.5" />,
  Other: <MapPin className="w-3.5 h-3.5" />,
};

const AddressSection = () => {
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [newAddr,   setNewAddr]   = useState('');
  const [newLabel,  setNewLabel]  = useState('Home');
  const [saving,    setSaving]    = useState(false);

  const load = async () => {
    try {
      const { data } = await addressApi.list();
      setAddresses(data.addresses);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newAddr.trim()) return;
    setSaving(true);
    try {
      await addressApi.add({ label: newLabel, address: newAddr.trim(), isDefault: addresses.length === 0 });
      toast('Address saved', 'success');
      setNewAddr(''); setNewLabel('Home'); setShowAdd(false);
      await load();
    } catch { toast('Failed to save address', 'error'); }
    finally { setSaving(false); }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await addressApi.setDefault(id);
      await load();
      toast('Default address updated', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await addressApi.remove(id);
      await load();
      toast('Address removed', 'warning');
    } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Addresses</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* Add new form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pt-3 pb-4 space-y-3 bg-slate-50 border-b border-slate-100">
              <div className="flex gap-2">
                {['Home', 'Work', 'Other'].map(l => (
                  <button key={l} type="button" onClick={() => setNewLabel(l)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                      ${newLabel === l ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                    {LABEL_ICONS[l]}{l}
                  </button>
                ))}
              </div>
              <textarea value={newAddr} onChange={e => setNewAddr(e.target.value)}
                placeholder="Enter full address..."
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm placeholder-slate-400 outline-none focus:border-brand-400 transition-all resize-none" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1" loading={saving} icon={<Check className="w-4 h-4" />} onClick={handleAdd}>
                  Save Address
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address list */}
      {loading ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400">Loading…</div>
      ) : addresses.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No addresses saved yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {addresses.map(addr => (
            <div key={addr.id} className="flex items-start gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center text-brand-500 shrink-0 mt-0.5">
                {LABEL_ICONS[addr.label] || <MapPin className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-slate-700">{addr.label}</p>
                  {addr.is_default && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-brand-500 text-brand-500" /> Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-snug">{addr.address}</p>
                {!addr.is_default && (
                  <button onClick={() => handleSetDefault(addr.id)}
                    className="text-[10px] text-brand-600 font-semibold mt-1 hover:text-brand-700 transition-colors">
                    Set as default
                  </button>
                )}
              </div>
              <button onClick={() => handleDelete(addr.id)}
                className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
