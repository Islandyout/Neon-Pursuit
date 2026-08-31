import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'maskable-icon.svg', 'favicon.svg'],
      manifest: {
        name: 'Neon Pursuit',
        short_name: 'Neon Pursuit',
        description: 'An original high-speed open-world arcade racing game.',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#050609',
        theme_color: '#101317',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/maskable-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,wasm,json,glb}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.destination === 'image' || url.pathname.endsWith('.glb'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'neon-pursuit-art-assets-v2',
              expiration: {
                maxEntries: 180,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
