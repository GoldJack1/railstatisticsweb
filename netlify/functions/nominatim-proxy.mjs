/**
 * Same-origin proxy for Nominatim search (location picker).
 * Forwards a minimal allowlisted query to nominatim.openstreetmap.org with a proper User-Agent.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const MAX_Q = 200
const MAX_LIMIT = 10

export default async (request) => {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q || q.length > MAX_Q) {
    return new Response(JSON.stringify({ error: 'Invalid or missing q' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let limit = Number.parseInt(url.searchParams.get('limit') || '8', 10)
  if (!Number.isFinite(limit) || limit < 1) limit = 8
  limit = Math.min(limit, MAX_LIMIT)

  const upstream = new URL('https://nominatim.openstreetmap.org/search')
  upstream.searchParams.set('q', q)
  upstream.searchParams.set('format', 'json')
  upstream.searchParams.set('limit', String(limit))

  const upstreamRes = await fetch(upstream.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RailStatisticsWebsite/1.0 (+https://railstatistics.co.uk); nominatim proxy'
    }
  })

  const body = await upstreamRes.text()
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=60'
    }
  })
}
