import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'generateSW' = plugin auto-generates the Workbox SW
      // Firebase uses its own separate SW at /firebase-messaging-sw.js — no conflict
      registerType: 'autoUpdate',
      injectRegister: null,           // We call registerSW() manually in main.tsx

      includeAssets: ['sarvam.jpg', 'icons/*.png'],

      // ── Web App Manifest ─────────────────────────────────────────────────────
      manifest: {
        name: 'Swara Aqua',
        short_name: 'SwaraAqua',
        description: 'Fresh water jar delivery at your doorstep',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        lang: 'en',
        categories: ['food', 'shopping', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/icons/screenshot.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',         // Required by Chrome 119+ for install prompt
            label: 'Swara Aqua home screen',
          },
        ],
      },

      // ── Workbox config ───────────────────────────────────────────────────────
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // CRITICAL: SPA fallback — any deep URL returns index.html
        // Without this, refreshing /customer/orders on Hostinger returns 404
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,                   // Never intercept API calls
          /^\/firebase-messaging-sw/,   // Don't intercept Firebase SW
        ],

        cleanupOutdatedCaches: true,

        runtimeCaching: [
          // API — network first, 5 min cache fallback
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-cache' },
          },
          // Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },

      // ── Dev mode — enable SW in development for local testing ────────────────
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
