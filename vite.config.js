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
  build: {
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger']
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['axios', 'chart.js', 'react-chartjs-2', 'jsbarcode'],
          qrcode: ['html5-qrcode'],
          excel: ['exceljs'],
          utils: ['jwt-decode', 'file-saver'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
}))