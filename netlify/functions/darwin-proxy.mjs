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

function boolEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function detectCountryCode(headers) {
  const candidates = [
    headers.get('x-country'),
    headers.get('cf-ipcountry'),
    headers.get('x-vercel-ip-country'),
    headers.get('x-nf-geo-country'),
  ]
  for (const raw of candidates) {
    const code = String(raw || '').trim().toUpperCase()
    if (code) return code
  }
  return null
}

export default async (request) => {
  const origin = process.env.DARWIN_API_ORIGIN || 'https://api-darwin.railstatistics.co.uk'
  const apiKey = process.env.DARWIN_API_KEY || ''
  const ukOnly = boolEnv(process.env.DARWIN_UK_ONLY)
  const ukAllowedCountries = new Set(['GB', 'UK'])
  if (!apiKey) {
    return json(500, { error: 'DARWIN_API_KEY is not configured' })
  }
  if (ukOnly) {
    const country = detectCountryCode(request.headers)
    if (!country || !ukAllowedCountries.has(country)) {
      return json(451, {
        error: 'regional_restriction',
        message: 'Darwin realtime API is only available in the UK.',
        country: country || 'unknown',
      })
    }
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
