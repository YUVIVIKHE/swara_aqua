import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Register FCM service worker early — required for push when app is closed
import { ensureMessagingServiceWorker } from './utils/registerPush';
if ('serviceWorker' in navigator) {
  ensureMessagingServiceWorker()
    .then((reg) => reg && console.log('[FCM SW] Ready:', reg.scope))
    .catch((err) => console.error('[FCM SW] Registration failed:', err));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
