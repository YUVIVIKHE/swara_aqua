import { Bell, BellRing, X } from 'lucide-react';
import { useState } from 'react';
import { useNotificationCenter } from '../context/NotificationContext';

export const NotificationEnableBanner = () => {
  const { permission, pushEnabled, enablePush, sseConnected } = useNotificationCenter();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('notif-banner-dismissed') === '1'
  );
  const [enabling, setEnabling] = useState(false);

  if (dismissed || permission === 'unsupported') return null;
  if (permission === 'granted' && pushEnabled) return null;

  const handleEnable = async () => {
    setEnabling(true);
    const ok = await enablePush();
    setEnabling(false);
    if (ok || Notification.permission === 'granted') {
      sessionStorage.setItem('notif-banner-dismissed', '1');
      setDismissed(true);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem('notif-banner-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="mx-4 mt-3 mb-1 flex items-start gap-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-aqua-50 px-4 py-3 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
        <BellRing className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">Enable real-time alerts</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Required for alerts when the app is closed or not running (admin, staff, and customer).
          Install the app to home screen for best results on mobile.
          {sseConnected ? ' Live updates are on.' : ''}
        </p>
        <button
          type="button"
          onClick={handleEnable}
          disabled={enabling}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          <Bell className="w-3.5 h-3.5" />
          {enabling ? 'Enabling…' : permission === 'denied' ? 'Open browser settings' : 'Turn on notifications'}
        </button>
        {permission === 'denied' && (
          <p className="text-[10px] text-amber-700 mt-1">
            Notifications were blocked. Allow them in your browser site settings.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} className="text-slate-400 hover:text-slate-600 shrink-0" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
