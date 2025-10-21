import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    cors: true,
    fs: {
      strict: false
    }
  },
  configureServer: (server) => {
    server.middlewares.use((req, res, next) => {
      // Add CORS and proper headers for fonts
      if (req.url?.match(/\.(woff2?|ttf|otf|eot)$/)) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader('Cache-Control', 'public, max-age=31536000')
        
        // Set proper MIME types
        if (req.url.endsWith('.woff2')) {
          res.setHeader('Content-Type', 'font/woff2')
        } else if (req.url.endsWith('.woff')) {
          res.setHeader('Content-Type', 'font/woff')
        } else if (req.url.endsWith('.ttf')) {
          res.setHeader('Content-Type', 'font/ttf')
        }
      }
      next()
    })
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Create vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('firebase')) {
              return 'firebase-vendor'
            }
            if (id.includes('react-router')) {
              return 'router-vendor'
            }
            return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  // Note: Vite automatically loads .env.local in development
  // This define section is only for production builds on Netlify
  // In development, remove or comment out to use .env.local
  // define: {
  //   // Replace environment variables at build time
  //   'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || '{{FIREBASE_API_KEY}}'),
  //   'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || '{{FIREBASE_AUTH_DOMAIN}}'),
  //   'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(process.env.VITE_FIREBASE_DATABASE_URL || '{{FIREBASE_DATABASE_URL}}'),
  //   'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || '{{FIREBASE_PROJECT_ID}}'),
  //   'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || '{{FIREBASE_STORAGE_BUCKET}}'),
  //   'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '{{FIREBASE_MESSAGING_SENDER_ID}}'),
  //   'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || '{{FIREBASE_APP_ID}}'),
  //   'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.VITE_FIREBASE_MEASUREMENT_ID || '{{FIREBASE_MEASUREMENT_ID}}')
  // },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/firestore', 'firebase/analytics']
  }
})
