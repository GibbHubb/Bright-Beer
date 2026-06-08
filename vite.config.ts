import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/Bright-Beer/',
      scope: '/Bright-Beer/',
      manifest: {
        name: 'Sunny Amsterdam',
        short_name: 'BrightBeer',
        description: 'Find the sunniest terrace right now',
        start_url: '/Bright-Beer/',
        scope: '/Bright-Beer/',
        display: 'standalone',
        background_color: '#0d1117',
        theme_color: '#0d1117',
        icons: [
          { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('venues.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'venues-cache',
              expiration: { maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  base: '/Bright-Beer/',
})
