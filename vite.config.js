import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** CORS + MIME for font requests (must live in a plugin — top-level `configureServer` is not applied by Vite). */
function fontHeadersPlugin() {
  return {
    name: 'font-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.match(/\.(woff2?|ttf|otf|eot)$/)) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', '*')
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          if (req.url.endsWith('.woff2')) {
            res.setHeader('Content-Type', 'font/woff2')
          } else if (req.url.endsWith('.woff')) {
            res.setHeader('Content-Type', 'font/woff')
          } else if (req.url.endsWith('.ttf')) {
            res.setHeader('Content-Type', 'font/ttf')
          } else if (req.url.endsWith('.otf')) {
            res.setHeader('Content-Type', 'font/otf')
          }
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // Stable root (avoids cwd quirks); important when the path contains spaces (e.g. "Rail Statistics").
  root: path.resolve(__dirname),
  appType: 'spa',
  plugins: [
    react(),
    fontHeadersPlugin(),
    // Workbox keys precached index.html by content hash. _headers-only CSP updates do not change
    // that hash, so clients keep a stale cached document + old CSP until this revision changes.
    {
      name: 'precache-revision-bump',
      transformIndexHtml(html, ctx) {
        if (ctx.server) return html
        return html.replace(
          '<!-- PRECACHE-REVISION -->',
          `<!-- precache-revision:${Date.now()} -->`
        )
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'fonts/*.otf',
        'fonts/*.ttf',
      ],
      manifest: {
        id: '/',
        name: 'Rail Statistics',
        short_name: 'Rail Stats',
        description: 'Track your railway station visits and statistics',
        theme_color: '#e8eaed',
        background_color: '#e8eaed',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['travel', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Activate the new worker immediately and take over open tabs.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,otf}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_/, /\/[^/?]+\.[^/]+$/],
        // Drop old precaches after deploy so navigations pick up new index.html + CSP header.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // Listen on LAN (0.0.0.0) so phones/tablets can load the app; pairs with hmr below.
    host: true,
    port: 3000,
    open: true,
    cors: true,
    // Default fs.strict is true. strict:false allowed /@fs/ outside the project and could hit
    // sockets / special nodes → ENOTSUP during readFile in loadAndTransform.
    preTransformRequests: false,
    hmr: {
      // Same port the browser uses for HTTP (needed when host is not localhost).
      clientPort: 3000,
    },
    watch: {
      ignored: ['**/data/**'],
      // Projects under ~/Documents are often iCloud-backed; native watchers + readFileHandle can throw ENOTSUP.
      usePolling: true,
      interval: 300,
    },
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
