import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Tally/',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tally',
        short_name: 'Tally',
        description: 'Spor investeringene dine og se din faktiske avkastning',
        theme_color: '#f5f0e8',
        background_color: '#f5f0e8',
        display: 'standalone',
        scope: '/Tally/',
        start_url: '/Tally/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/Tally\/data\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stock-data',
              expiration: { maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /query[12]\.finance\.yahoo\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'yahoo-api',
              expiration: { maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
});
