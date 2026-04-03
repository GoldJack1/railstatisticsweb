/**
 * Same-origin proxy for OSM raster tiles (Leaflet).
 * Lets maps work in strict embeds / browsers that block third-party tile hosts under CSP.
 * @see https://operations.osmfoundation.org/policies/tiles/ — identify the app; moderate traffic only.
 */

const ALLOW_S = new Set(['a', 'b', 'c'])
const MAX_Z = 19

export default async (request) => {
  const url = new URL(request.url)
  const s = url.searchParams.get('s')
  const z = url.searchParams.get('z')
  const x = url.searchParams.get('x')
  const y = url.searchParams.get('y')

  if (!ALLOW_S.has(s)) {
    return new Response('Invalid tile server', { status: 400 })
  }

  const zi = Number.parseInt(z, 10)
  const xi = Number.parseInt(x, 10)
  const yi = Number.parseInt(y, 10)
  if (
    !Number.isFinite(zi) ||
    zi < 0 ||
    zi > MAX_Z ||
    !Number.isFinite(xi) ||
    xi < 0 ||
    !Number.isFinite(yi) ||
    yi < 0
  ) {
    return new Response('Invalid coordinates', { status: 400 })
  }

  const upstream = `https://${s}.tile.openstreetmap.org/${zi}/${xi}/${yi}.png`
  const upstreamRes = await fetch(upstream, {
    headers: {
      Accept: 'image/png,*/*',
      'User-Agent': 'RailStatisticsWebsite/1.0 (+https://railstatistics.co.uk); OSM tile proxy'
    }
  })

  if (!upstreamRes.ok) {
    return new Response(upstreamRes.statusText, { status: upstreamRes.status })
  }

  const headers = new Headers()
  headers.set('Content-Type', 'image/png')
  headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')

  return new Response(upstreamRes.body, { status: 200, headers })
}
