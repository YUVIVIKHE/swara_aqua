import { useEffect, useState, useCallback } from 'react';
import { Smartphone, Download, WifiOff, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow]           = useState(false);
  const [isIOS, setIsIOS]         = useState(false);
  const [isInstalled, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — hide everything
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Capture the browser's native install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner once prompt is captured
      const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show instructions after 4s if not dismissed
    if (ios) {
      const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) {
        const t = setTimeout(() => setShow(true), 4000);
        return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(t); };
      }
    }

    // Listen for the app being successfully installed
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false); });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setShow(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  if (isInstalled || !show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <Smartphone className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Install Swara Aqua</p>
          {isIOS ? (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Tap <Share className="inline w-3 h-3 text-brand-600" /> then{' '}
              <strong className="text-slate-700">"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">
              Add to your home screen for the best experience
            </p>
          )}
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 mt-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:shadow-brand transition-all"
            >
              <Download className="w-3 h-3" />
              Install App — It's Free
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── Offline Indicator ─────────────────────────────────────────────────────────

export const OfflineIndicator = () => {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-xs font-semibold text-center py-2 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      You're offline — some features may be limited
    </div>
  );
};
