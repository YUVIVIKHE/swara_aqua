import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register the Workbox service worker
// - autoUpdate: true → SW silently updates in background
// - onNeedRefresh: called when new content is available
// - onOfflineReady: called when app is fully cached for offline use
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Silently update — could show a toast here if desired
    console.log('[PWA] New content available, updating...');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use');
  },
  onRegistered(r) {
    console.log('[PWA] Service worker registered:', r);
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
