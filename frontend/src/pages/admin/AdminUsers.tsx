import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle, XCircle, RefreshCw, UserPlus, X, Phone, Lock, User, Eye } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';

interface UserRow { id: number; name: string; phone: string; role: string; status: string; created_at: string; }

export const AdminUsers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users,     setUsers]     = useState<UserRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actionId,  setActionId]  = useState<number | null>(null);
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users.filter((u: UserRow) => u.role === 'staff'));
    } catch { toast('Failed to load staff', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id: number, status: string) => {
    setActionId(id);
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      toast(status === 'active' ? 'Staff approved' : 'Staff deactivated',
            status === 'active' ? 'success' : 'warning');
      await load();
    } catch { toast('Action failed', 'error'); }
    finally { setActionId(null); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setSubmitting(true);
    try {
      await api.post('/admin/staff', form);
      toast(`Staff "${form.name}" created successfully`, 'success');
      setShowModal(false);
      setForm({ name: '', phone: '', password: '' });
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to create staff', 'error');
    } finally { setSubmitting(false); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search)
  );

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Staff</h2>
          <p className="text-xs text-slate-400 mt-0.5">{users.length} staff members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
            Refresh
          </Button>
          <Button size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
            Add Staff
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-card focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 transition-all">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search staff by name or phone..."
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Staff', 'Phone', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [0,1,2].map(i => (
                  <tr key={i}>{[0,1,2,3,4].map(j => (
                    <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">No staff found</td></tr>
              ) : filtered.map((u, i) => (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 bg-gradient-to-br from-purple-500 to-brand-500">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{u.phone}</td>
                  <td className="px-5 py-4"><Badge status={u.status} /></td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm"
                        icon={<Eye className="w-3.5 h-3.5 text-brand-500" />}
                        onClick={() => navigate(`/admin/staff/${u.id}`)}
                        className="text-brand-600 hover:bg-brand-50">
                        View
                      </Button>
                      {u.status !== 'active' && (
                        <Button variant="ghost" size="sm" loading={actionId === u.id}
                          icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                          onClick={() => handleStatus(u.id, 'active')}
                          className="text-green-600 hover:bg-green-50">
                          Activate
                        </Button>
                      )}
                      {u.status !== 'rejected' && (
                        <Button variant="ghost" size="sm" loading={actionId === u.id}
                          icon={<XCircle className="w-3.5 h-3.5 text-red-400" />}
                          onClick={() => handleStatus(u.id, 'rejected')}
                          className="text-red-500 hover:bg-red-50">
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            [0,1,2].map(i => <div key={i} className="p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>)
          ) : filtered.map(u => (
            <div key={u.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-purple-500 to-brand-500">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.phone}</p>
                  </div>
                </div>
                <Badge status={u.status} />
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/admin/staff/${u.id}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 transition-colors">
                  <Eye className="w-3.5 h-3.5" /> View Profile
                </button>
                {u.status !== 'active' && (
                  <Button variant="secondary" size="sm" loading={actionId === u.id}
                    icon={<CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                    onClick={() => handleStatus(u.id, 'active')}>
                    Activate
                  </Button>
                )}
                {u.status !== 'rejected' && (
                  <Button variant="danger" size="sm" loading={actionId === u.id}
                    icon={<XCircle className="w-3.5 h-3.5" />}
                    onClick={() => handleStatus(u.id, 'rejected')}>
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Staff Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit={{   scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-brand-500 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
                    <p className="text-xs text-slate-400">Account will be active immediately</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="px-6 py-5 space-y-4">
                <Input label="Full Name" type="text" placeholder="Enter staff name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  icon={<User className="w-4 h-4" />} required />
                <Input label="Phone Number" type="tel" placeholder="Enter phone number"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  icon={<Phone className="w-4 h-4" />} required />
                <Input label="Password" type="password" placeholder="Min. 6 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  icon={<Lock className="w-4 h-4" />} required />

                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
                  Staff accounts are created as <span className="font-bold">Active</span> — they can log in immediately.
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="secondary" size="md" className="flex-1"
                    onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="md" className="flex-1" loading={submitting}
                    icon={<UserPlus className="w-4 h-4" />}>
                    Create Staff
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
