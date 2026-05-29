import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Download, WifiOff, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

/** Hook for PWA install prompt (Chrome/Edge) and iOS detection. */
export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setInstalled] = useState(isStandalone);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(isIosDevice());
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    isInstalled,
    isIOS,
    canNativeInstall: !!deferredPrompt && !isInstalled,
    install,
  };
};

/** iOS install steps modal */
const IosInstallHelp = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={onClose}>
    <div
      className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-slate-900">Install on iPhone / iPad</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <ol className="space-y-3 text-sm text-slate-600">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span>Tap the <strong>Share</strong> button <Share className="inline w-4 h-4 text-brand-600 align-text-bottom" /> in Safari</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span>Scroll and tap <strong>Add to Home Screen</strong></span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <span>Tap <strong>Add</strong> — Swara Aqua appears on your home screen</span>
        </li>
      </ol>
      <Link
        to="/download"
        onClick={onClose}
        className="mt-4 block text-center text-xs text-brand-600 font-semibold hover:text-brand-700"
      >
        View full install guide →
      </Link>
    </div>
  </div>
);

/** Install button for login / signup pages */
export const InstallAppButton = ({ className = '' }: { className?: string }) => {
  const { isInstalled, isIOS, canNativeInstall, install } = usePwaInstall();
  const [iosHelp, setIosHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canNativeInstall) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }
    if (isIOS) {
      setIosHelp(true);
      return;
    }
    window.location.href = '/download';
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-aqua-50 text-brand-700 text-sm font-bold hover:from-brand-100 hover:to-aqua-100 hover:border-brand-300 active:scale-[0.98] transition-all disabled:opacity-60 ${className}`}
      >
        <Download className="w-4 h-4 shrink-0" />
        {installing ? 'Installing…' : 'Install Swara Aqua App'}
      </button>
      <p className="text-center text-[11px] text-slate-400 mt-2">
        Free · No app store · Works offline after install
      </p>
      {iosHelp && <IosInstallHelp onClose={() => setIosHelp(false)} />}
    </>
  );
};

export const PWAInstallBanner = () => {
  const { isInstalled, isIOS, canNativeInstall, install } = usePwaInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInstalled) return;

    const dismissed = sessionStorage.getItem('pwa-banner-dismissed');
    if (dismissed) return;

    if (canNativeInstall) {
      setShow(true);
      return;
    }

    if (isIOS) {
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }
  }, [isInstalled, isIOS, canNativeInstall]);

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  };

  const handleInstall = async () => {
    await install();
    setShow(false);
  };

  if (isInstalled || !show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <Smartphone className="w-5 h-5 text-white" />
        </div>

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
          {canNativeInstall && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 mt-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:shadow-brand transition-all"
            >
              <Download className="w-3 h-3" />
              Install App — It's Free
            </button>
          )}
        </div>

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
