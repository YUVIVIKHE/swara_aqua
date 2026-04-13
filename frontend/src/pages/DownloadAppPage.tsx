import { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Droplets, Star } from 'lucide-react';

// QR code via Google Charts API (no library needed)
const QRCode = ({ url, size = 200 }: { url: string; size?: number }) => {
  const encoded = encodeURIComponent(url);
  return (
    <img
      src={`https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}&choe=UTF-8&chld=M|2`}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-2xl"
    />
  );
};

const STEPS_ANDROID = [
  { icon: '📱', text: 'Scan the QR code or open the link in Chrome' },
  { icon: '⋮', text: 'Tap the 3-dot menu (top right of Chrome)' },
  { icon: '🏠', text: 'Tap "Add to Home screen"' },
  { icon: '✅', text: 'Tap "Add" — the app icon appears on your home screen' },
];

const STEPS_IOS = [
  { icon: '📱', text: 'Scan the QR code or open the link in Safari' },
  { icon: '↑', text: 'Tap the Share button (bottom center)' },
  { icon: '🏠', text: 'Scroll down and tap "Add to Home Screen"' },
  { icon: '✅', text: 'Tap "Add" — the app icon appears on your home screen' },
];

export const DownloadAppPage = () => {
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  const appUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-400 to-aqua-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-brand-500/30">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Swara Aqua</h1>
          <p className="text-brand-300 text-sm mt-1">Fresh water jar delivery app</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
            <span className="text-xs text-slate-400 ml-1">Free to install</span>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* QR Code */}
          <div className="flex flex-col items-center p-6 border-b border-white/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Scan QR Code to Install</p>
            <div className="p-3 bg-white rounded-2xl shadow-lg">
              <QRCode url={appUrl} size={180} />
            </div>
            <p className="text-slate-400 text-xs mt-3 text-center">
              Point your phone camera at the QR code
            </p>
            <div className="flex items-center gap-2 mt-3 text-slate-300 text-xs">
              <div className="w-6 h-px bg-slate-600" />
              <span>or share the link</span>
              <div className="w-6 h-px bg-slate-600" />
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(appUrl); }}
              className="flex items-center gap-2 mt-3 bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-brand-600/30 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              {appUrl}
            </button>
          </div>

          {/* Platform toggle */}
          <div className="p-5">
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-4">
              {(['android', 'ios'] as const).map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize
                    ${platform === p ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                  {p === 'android' ? '🤖 Android' : '🍎 iPhone/iPad'}
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {(platform === 'android' ? STEPS_ANDROID : STEPS_IOS).map((step, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-base shrink-0">
                    {step.icon}
                  </div>
                  <p className="text-sm text-slate-300 leading-snug pt-1">{step.text}</p>
                </motion.div>
              ))}
            </div>

            {/* Features */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                { icon: '⚡', label: 'Fast ordering' },
                { icon: '📦', label: 'Track deliveries' },
                { icon: '💳', label: 'Easy payments' },
                { icon: '📅', label: 'Monthly bills' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                  <span className="text-base">{f.icon}</span>
                  <span className="text-xs text-slate-300 font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500 mt-6">
          No app store needed · Installs directly from browser · Free forever
        </p>
      </motion.div>
    </div>
  );
};
