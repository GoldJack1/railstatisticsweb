/**
 * Secure proxy for Darwin API.
 * Injects a server-side API key so browser clients never see it.
 */

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default async (request) => {
  const origin = process.env.DARWIN_API_ORIGIN || 'https://api-darwin.railstatistics.co.uk'
  const apiKey = process.env.DARWIN_API_KEY || ''
  if (!apiKey) {
    return json(500, { error: 'DARWIN_API_KEY is not configured' })
  }

  const reqUrl = new URL(request.url)
  const functionMarker = '/.netlify/functions/darwin-proxy/'
  const publicMarker = '/api/darwin/'
  let splat = ''
  if (reqUrl.pathname.includes(functionMarker)) {
    splat = reqUrl.pathname.slice(reqUrl.pathname.indexOf(functionMarker) + functionMarker.length)
  } else if (reqUrl.pathname.startsWith(publicMarker)) {
    splat = reqUrl.pathname.slice(publicMarker.length)
  } else if (reqUrl.pathname === '/.netlify/functions/darwin-proxy' || reqUrl.pathname === '/api/darwin') {
    splat = 'health'
  }
  const upstream = new URL(`${origin.replace(/\/$/, '')}/api/${splat}${reqUrl.search}`)

  const headers = new Headers(request.headers)
  headers.set('X-API-Key', apiKey)
  headers.set('Host', upstream.host)
  headers.delete('content-length')

  const upstreamRes = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  })

  const responseHeaders = new Headers(upstreamRes.headers)
  responseHeaders.delete('content-length')
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  })
}
