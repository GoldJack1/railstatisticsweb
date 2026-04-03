/**
 * Use Netlify same-origin proxies for OSM tiles + Nominatim (see netlify/functions).
 * Strict CSPs (e.g. img-src 'self' data:) and embedded browsers still allow those URLs.
 *
 * - Production (`import.meta.env.PROD`): on by default.
 * - Opt out: VITE_USE_OSM_PROXY=false (e.g. local `vite preview` without Netlify functions).
 * - Dev server: off unless VITE_USE_OSM_PROXY=true (e.g. netlify dev).
 */
export function useOsmBackendProxy(): boolean {
  if (import.meta.env.VITE_USE_OSM_PROXY === 'false') return false
  if (import.meta.env.VITE_USE_OSM_PROXY === 'true') return true
  return import.meta.env.PROD
}
