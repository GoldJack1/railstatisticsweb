/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_DATABASE_URL: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY: string
  readonly VITE_USE_LOCAL_DATA_ONLY: string
  readonly VITE_USE_FIREBASE_EMULATOR: string
  /** OSM proxy: 'true' forces on (e.g. netlify dev). 'false' disables in production builds. Otherwise production uses proxy by default. */
  readonly VITE_USE_OSM_PROXY?: string
  /** Dev only: Firebase Email/Password auto sign-in from .env.local (never commit). */
  readonly VITE_LOCAL_AUTH_EMAIL: string
  readonly VITE_LOCAL_AUTH_PASSWORD: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
