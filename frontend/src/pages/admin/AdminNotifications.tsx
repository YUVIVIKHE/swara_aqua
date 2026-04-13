import { useState } from 'react';
import { Send, Users, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api from '../../api/axios';

type Mode = 'user' | 'broadcast';
type NotifType = 'order' | 'payment' | 'delivery' | 'approval' | 'stock' | 'general';

const PRESETS: { label: string; title: string; body: string; type: NotifType; role?: string }[] = [
  { label: '📦 Order Delivered',    title: 'Order Delivered',         body: 'Your water order has been delivered!',          type: 'order' },
  { label: '💳 Payment Reminder',   title: 'Payment Pending',         body: 'You have a pending payment. Please clear it.',  type: 'payment' },
  { label: '🚚 New Delivery',       title: 'New Delivery Assigned',   body: 'A new delivery has been assigned to you.',      type: 'delivery', role: 'staff' },
  { label: '✅ New Customer',       title: 'New Customer Request',    body: 'A new customer is waiting for approval.',       type: 'approval', role: 'admin' },
  { label: '⚠️ Low Stock',          title: 'Low Jar Stock Alert',     body: 'Jar stock is running low. Please restock.',     type: 'stock',    role: 'admin' },
  { label: '💰 Submit Cash',        title: 'Submit Collected Cash',   body: 'Please submit today\'s collected cash.',        type: 'general',  role: 'staff' },
];

export const AdminNotifications = () => {
  const { toast } = useToast();
  const [mode,    setMode]    = useState<Mode>('broadcast');
  const [userId,  setUserId]  = useState('');
  const [role,    setRole]    = useState('customer');
  const [title,   setTitle]   = useState('');
  const [body,    setBody]    = useState('');
  const [type,    setType]    = useState<NotifType>('general');
  const [loading, setLoading] = useState(false);

  const applyPreset = (p: typeof PRESETS[0]) => {
    setTitle(p.title);
    setBody(p.body);
    setType(p.type);
    if (p.role) { setMode('broadcast'); setRole(p.role); }
  };

  const handleSend = async () => {
    if (!title || !body) { toast('Title and body are required', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'user') {
        if (!userId) { toast('User ID is required', 'error'); return; }
        await api.post('/notifications/send', { userId: Number(userId), title, body, type });
        toast('Notification sent to user', 'success');
      } else {
        await api.post('/notifications/broadcast', { role, title, body, type });
        toast(`Broadcast sent to all ${role}s`, 'success');
      }
      setTitle(''); setBody('');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to send', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Send Notifications</h2>
        <p className="text-xs text-slate-400 mt-0.5">Push real-time notifications via FCM</p>
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="text-left px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-all shadow-card">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
        <div className="flex gap-2">
          {(['broadcast', 'user'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${mode === m ? 'bg-brand-600 text-white shadow-brand' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {m === 'broadcast' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {m === 'broadcast' ? 'Broadcast' : 'Single User'}
            </button>
          ))}
        </div>

        {mode === 'broadcast' ? (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Target Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all">
              <option value="customer">Customers</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        ) : (
          <Input label="User ID" type="number" placeholder="Enter user ID"
            value={userId} onChange={e => setUserId(e.target.value)} icon={<User className="w-4 h-4" />} />
        )}

        <Input label="Title" type="text" placeholder="Notification title"
          value={title} onChange={e => setTitle(e.target.value)} />

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Notification body message..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Type</label>
          <select value={type} onChange={e => setType(e.target.value as NotifType)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all">
            {['order','payment','delivery','approval','stock','general'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <Button onClick={handleSend} loading={loading} size="lg" className="w-full" icon={<Send className="w-4 h-4" />}>
          Send Notification
        </Button>
      </div>
    </div>
  );
};
