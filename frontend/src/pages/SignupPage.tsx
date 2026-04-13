import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Lock, User, Droplets, ArrowRight, CheckCircle, MapPin, Navigation } from 'lucide-react';
import api from '../api/axios';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', phone: '', password: '', address: '' });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/signup', form);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-card border border-slate-100 p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Request Submitted</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Your account is pending admin approval. You'll receive access once approved.
        </p>
        <Link to="/login">
          <Button size="lg" className="w-full">Back to Sign In</Button>
        </Link>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-brand-800 via-brand-700 to-aqua-600 p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">Swara Aqua</span>
        </div>

        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
            <p className="text-white/60 text-sm font-medium mb-3 uppercase tracking-widest">Join our community</p>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              Start your<br />hydration<br />journey.
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Create your account and get access to premium water delivery services right at your doorstep.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 space-y-3">
          {['No setup fees', 'Cancel anytime', 'Same-day delivery'].map((t) => (
            <div key={t} className="flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-aqua-400" />
              <span className="text-white/70 text-sm">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-gradient-aqua rounded-xl flex items-center justify-center shadow-brand">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg">Swara Aqua</span>
          </div>

          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src="/sarvam.jpg"
              alt="Logo"
              className="mb-4 object-contain max-h-32 w-auto"
              style={{
                WebkitMaskImage: 'radial-gradient(ellipse at center, black 60%, rgba(0,0,0,0) 100%)',
                maskImage: 'radial-gradient(ellipse at center, black 60%, rgba(0,0,0,0) 100%)'
              }}
            />
            <p className="text-slate-500 text-sm">Request access to the platform</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" type="text" placeholder="Enter your full name"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              icon={<User className="w-4 h-4" />} required />
            <Input label="Phone Number" type="tel" placeholder="Enter your phone number"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              icon={<Phone className="w-4 h-4" />} required />
            <Input label="Password" type="password" placeholder="Min. 6 characters"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              icon={<Lock className="w-4 h-4" />} required />

            <div>
              <Input label="Delivery Address" type="text" placeholder="Enter your delivery address"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                icon={<MapPin className="w-4 h-4" />} required />
              <button type="button" onClick={async () => {
                if (!navigator.geolocation) return;
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    try {
                      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                      const data = await r.json();
                      setForm(f => ({ ...f, address: data.display_name || `${pos.coords.latitude}, ${pos.coords.longitude}` }));
                    } catch {
                      setForm(f => ({ ...f, address: `${pos.coords.latitude}, ${pos.coords.longitude}` }));
                    } finally { setLocating(false); }
                  },
                  () => { setLocating(false); },
                  { enableHighAccuracy: true }
                );
              }}
                className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                <Navigation className="w-3 h-3" />
                {locating ? 'Fetching location...' : 'Use current location'}
              </button>
            </div>

            <Button type="submit" loading={loading} size="lg" className="w-full mt-2" icon={<ArrowRight className="w-4 h-4" />}>
              Submit Request
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
