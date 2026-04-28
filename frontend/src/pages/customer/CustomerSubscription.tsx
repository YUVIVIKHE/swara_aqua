import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock, Droplets, Plus, Minus, Pause, Play, RotateCcw,
  X, Check, Clock, Sun, Sunset, CloudSun, Package,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { subscriptionApi, Subscription, SubscriptionSlot } from '../../api/subscription';
import { addressApi, UserAddress } from '../../api/address';

// ── Preset slots ──────────────────────────────────────────────────────────────
const PRESET_SLOTS = [
  { label: 'Morning',   time: '08:00', icon: <Sun className="w-5 h-5" />,      gradient: 'from-amber-400 to-orange-500' },
  { label: 'Afternoon', time: '13:00', icon: <CloudSun className="w-5 h-5" />, gradient: 'from-sky-400 to-blue-500' },
  { label: 'Evening',   time: '17:00', icon: <Sunset className="w-5 h-5" />,   gradient: 'from-purple-400 to-indigo-500' },
];

export const CustomerSubscription = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const jarRate = user?.jar_rate || 50;

  const [sub, setSub]           = useState<Subscription | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Setup form state
  const [selectedSlots, setSelectedSlots] = useState<Record<string, { time: string; quantity: number }>>({});
  const [address, setAddress] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await subscriptionApi.getMy();
      setSub(data.subscription);
    } catch { toast('Failed to load subscription', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Load addresses when setup opens
  useEffect(() => {
    if (showSetup) {
      addressApi.list().then(({ data }) => {
        setAddresses(data.addresses);
        const def = data.addresses.find(a => a.is_default) || data.addresses[0];
        if (def && !address) setAddress(def.address);
      }).catch(() => {});
    }
  }, [showSetup]);

  // ── Slot toggle/quantity helpers ─────────────────────────────────────────────
  const toggleSlot = (label: string, time: string) => {
    setSelectedSlots(prev => {
      if (prev[label]) {
        const { [label]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [label]: { time, quantity: 1 } };
    });
  };

  const setSlotQty = (label: string, delta: number) => {
    setSelectedSlots(prev => {
      if (!prev[label]) return prev;
      const newQty = Math.max(1, prev[label].quantity + delta);
      return { ...prev, [label]: { ...prev[label], quantity: newQty } };
    });
  };

  const totalDaily = Object.values(selectedSlots).reduce((sum, s) => sum + s.quantity, 0);
  const estimatedMonthly = totalDaily * jarRate * 30;

  // ── Create subscription ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    const slots = Object.entries(selectedSlots).map(([label, s]) => ({
      label, time: s.time, quantity: s.quantity,
    }));
    if (slots.length === 0) { toast('Select at least one delivery slot', 'error'); return; }
    if (!address.trim()) { toast('Select a delivery address', 'error'); return; }
    setSaving(true);
    try {
      await subscriptionApi.create({ slots, address, autoRenew });
      toast('Subscription created! 🎉', 'success');
      setShowSetup(false);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to create subscription', 'error');
    } finally { setSaving(false); }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handlePause = async () => {
    if (!sub) return;
    try {
      await subscriptionApi.pause(sub.id);
      toast('Subscription paused — takes effect tomorrow', 'success');
      await load();
    } catch { toast('Failed to pause', 'error'); }
  };

  const handleResume = async () => {
    if (!sub) return;
    try {
      await subscriptionApi.resume(sub.id);
      toast('Subscription resumed!', 'success');
      await load();
    } catch { toast('Failed to resume', 'error'); }
  };

  const handleRenew = async () => {
    if (!sub) return;
    try {
      await subscriptionApi.renew(sub.id);
      toast('Subscription renewed for next month! 🎉', 'success');
      await load();
    } catch { toast('Failed to renew', 'error'); }
  };

  const handleCancel = async () => {
    if (!sub) return;
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    try {
      await subscriptionApi.cancel(sub.id);
      toast('Subscription cancelled', 'warning');
      await load();
    } catch { toast('Failed to cancel', 'error'); }
  };

  // ── Expiry check ────────────────────────────────────────────────────────────
  const daysUntilExpiry = sub ? Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / (1000*60*60*24)) : 999;
  const isExpiringSoon = sub?.status === 'active' && daysUntilExpiry <= 5 && !sub.auto_renew;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  // No subscription — show setup prompt
  if (!sub && !showSetup) {
    return (
      <div className="max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-br from-brand-600 via-aqua-500 to-emerald-500 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1">Daily Water Plan</h2>
            <p className="text-sm text-white/70">Get water delivered daily without placing orders!</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <CalendarClock className="w-4 h-4 text-brand-600" />
              </div>
              <p className="text-slate-600">Choose your delivery slots — morning, afternoon, or evening</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-slate-600">Set jars per slot — orders are auto-placed daily</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-slate-600">Renew at month end — or cancel anytime</p>
            </div>

            <Button size="lg" className="w-full !py-4" onClick={() => { setSelectedSlots({}); setAddress(''); setShowSetup(true); }}
              icon={<Plus className="w-4 h-4" />}>
              Setup My Plan
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Setup wizard
  if (showSetup) {
    return (
      <div className="max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Setup Your Plan</h2>
            <p className="text-xs text-slate-400 mt-0.5">Choose delivery slots & quantities</p>
          </div>
          <button onClick={() => setShowSetup(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slot cards */}
        <div className="space-y-3">
          {PRESET_SLOTS.map(slot => {
            const isActive = !!selectedSlots[slot.label];
            return (
              <motion.div
                key={slot.label}
                layout
                className={`rounded-2xl border-2 overflow-hidden transition-all
                  ${isActive ? 'border-brand-400 shadow-lg' : 'border-slate-200'}`}>
                {/* Header */}
                <button
                  onClick={() => toggleSlot(slot.label, slot.time)}
                  className={`w-full flex items-center gap-3 p-4 transition-all
                    ${isActive ? 'bg-gradient-to-r ' + slot.gradient + ' text-white' : 'bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${isActive ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                    <span className={isActive ? 'text-white' : 'text-slate-500'}>{slot.icon}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{slot.label}</p>
                    <p className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{slot.time}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                    ${isActive ? 'border-white bg-white/20' : 'border-slate-300'}`}>
                    {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>

                {/* Quantity stepper */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500">Jars per delivery</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSlotQty(slot.label, -1)}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-lg font-bold text-slate-800 w-6 text-center">
                            {selectedSlots[slot.label]?.quantity || 1}
                          </span>
                          <button onClick={() => setSlotQty(slot.label, 1)}
                            className="w-8 h-8 rounded-xl bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Summary card */}
        {totalDaily > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-brand-50 to-aqua-400/10 border border-brand-100 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-500 font-semibold">Daily Total</p>
                <p className="text-2xl font-extrabold text-brand-700">{totalDaily} jars</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-brand-500 font-semibold">~Monthly Cost</p>
                <p className="text-xl font-bold text-brand-600">₹{estimatedMonthly.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Address */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Delivery Address</label>
          {addresses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {addresses.map(a => (
                <button key={a.id} type="button" onClick={() => setAddress(a.address)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                    ${address === a.address
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                  {a.label}
                  {address === a.address && <Check className="w-3 h-3 ml-1 inline" />}
                </button>
              ))}
            </div>
          )}
          <textarea value={address} onChange={e => setAddress(e.target.value)}
            placeholder="Full delivery address…" rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all resize-none" />
        </div>

        {/* Auto-renew toggle */}
        <button onClick={() => setAutoRenew(!autoRenew)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all
            ${autoRenew ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <RotateCcw className={`w-4 h-4 ${autoRenew ? 'text-brand-600' : 'text-slate-400'}`} />
            <span className="text-sm font-semibold text-slate-700">Auto-renew next month</span>
          </div>
          <div className={`w-10 h-6 rounded-full transition-all relative ${autoRenew ? 'bg-brand-600' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${autoRenew ? 'left-5' : 'left-1'}`} />
          </div>
        </button>

        {/* Submit */}
        <div className="sticky bottom-0 pt-2 pb-1 bg-white/80 backdrop-blur-sm -mx-1 px-1">
          <Button size="lg" className="w-full !py-4" loading={saving} onClick={handleCreate}
            icon={<Droplets className="w-4 h-4" />}
            disabled={totalDaily === 0 || !address.trim()}>
            Start My Plan — {totalDaily} jars/day
          </Button>
        </div>
      </div>
    );
  }

  // Active subscription dashboard
  return (
    <div className="max-w-lg space-y-5">

      {/* Renewal banner */}
      {isExpiringSoon && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Plan expires in {daysUntilExpiry} days</p>
            <p className="text-xs text-white/70">Renew to continue daily deliveries</p>
          </div>
          <Button size="sm" onClick={handleRenew} className="!bg-white !text-orange-600 !border-0 shrink-0">
            Renew
          </Button>
        </motion.div>
      )}

      {/* Status card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

        {/* Gradient header */}
        <div className={`p-5 ${sub!.status === 'active'
          ? 'bg-gradient-to-br from-brand-600 to-aqua-500'
          : 'bg-gradient-to-br from-slate-500 to-slate-600'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-white" />
              <span className="text-sm font-bold text-white">My Water Plan</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
              ${sub!.status === 'active' ? 'bg-white/20 text-white' : 'bg-yellow-400/30 text-yellow-100'}`}>
              {sub!.status}
            </span>
          </div>
          <p className="text-white/70 text-xs">
            {new Date(sub!.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(sub!.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* Slots */}
        <div className="p-5 space-y-3">
          {sub!.slots?.map(slot => {
            const preset = PRESET_SLOTS.find(p => p.label === slot.slot_label);
            return (
              <div key={slot.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white bg-gradient-to-br ${preset?.gradient || 'from-slate-400 to-slate-500'}`}>
                  {preset?.icon || <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{slot.slot_label}</p>
                  <p className="text-xs text-slate-400">{slot.delivery_time}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="text-sm font-bold text-brand-600">{slot.quantity}</span>
                  <span className="text-xs text-slate-400 ml-0.5">jar{slot.quantity > 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}

          {/* Daily total */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500">Daily Total</span>
            <span className="text-base font-extrabold text-brand-700">
              {sub!.slots?.reduce((s, sl) => s + sl.quantity, 0)} jars · ₹{(sub!.slots?.reduce((s, sl) => s + sl.quantity, 0) || 0) * jarRate}/day
            </span>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        {sub!.status === 'active' ? (
          <Button variant="secondary" size="md" className="w-full" onClick={handlePause}
            icon={<Pause className="w-4 h-4" />}>
            Pause Plan
          </Button>
        ) : sub!.status === 'paused' ? (
          <Button size="md" className="w-full" onClick={handleResume}
            icon={<Play className="w-4 h-4" />}>
            Resume Plan
          </Button>
        ) : null}

        <Button variant="secondary" size="md" className="w-full" onClick={handleRenew}
          icon={<RotateCcw className="w-4 h-4" />}>
          Renew
        </Button>
      </div>

      <Button variant="danger" size="sm" className="w-full" onClick={handleCancel}>
        Cancel Subscription
      </Button>

      {/* Auto-renew status */}
      <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
        <RotateCcw className="w-3 h-3" />
        {sub!.auto_renew ? 'Auto-renew is ON' : 'Auto-renew is OFF'}
      </div>
    </div>
  );
};
