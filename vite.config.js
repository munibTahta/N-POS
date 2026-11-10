import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import { VitePWA } from 'vite-plugin-pwa' // Disabled for now

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Temporarily disable PWA until icons are available
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/api\./,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'api-cache',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
    //           }
    //         }
    //       }
    //     ]
    //   },
    //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //   manifest: {
    //     name: 'N-POS',
    //     short_name: 'N-POS',
    //     description: 'Point of Sale Application',
    //     theme_color: '#ffffff',
    //     icons: [
    //       {
    //         src: 'pwa-192x192.png',
    //         sizes: '192x192',
    //         type: 'image/png'
    //       },
    //       {
    //         src: 'pwa-512x512.png',
    //         sizes: '512x512',
    //         type: 'image/png'
    //       }
    //     ]
    //   }
    // })
  ],
  define: {
    // Disable HMR for Electron
    __ELECTRON__: mode === 'electron' || process.env.VITE_DISABLE_HMR === 'true'
  },
  server: {
    hmr: mode === 'electron' || process.env.VITE_DISABLE_HMR === 'true' ? false : {
      overlay: false
    }
  },
  // Produksi: buang console.log/debug/info (dan debugger) saat build. console.warn/error TETAP ada.
  // Menggantikan scripts/remove-console.cjs yang menulis ulang file sumber secara permanen.
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    drop: mode === 'production' ? ['debugger'] : [],
  },
  build: {
    // Jangan menghapus berkas build sebelumnya: tab yang masih terbuka memakai chunk ber-hash lama. Dibersihkan oleh scripts/prune-dist.mjs.
    emptyOutDir: false,
    manifest: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['axios'],
          // chart.js dan jsbarcode sengaja tidak dikelompokkan manual: manualChunks membuatnya ikut
          // di-preload saat startup. Biarkan Rollup menaruhnya di chunk halaman yang memakainya (lazy).
          qrcode: ['html5-qrcode'],
          excel: ['exceljs'],
          utils: ['jwt-decode', 'file-saver'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
}))