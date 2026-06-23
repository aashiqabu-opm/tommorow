import { NextResponse } from 'next/server'

// CORS for the public website-ecosystem endpoints (/api/public/*).
// Unauthenticated, no credentials. Origin is validated against an allowlist:
//   PUBLIC_CORS_ORIGINS       — comma-separated exact origins
//                               (default: https://opmcinemas.com,https://www.opmcinemas.com)
//   PUBLIC_CORS_PREVIEW_REGEX — optional regex string for Vercel preview URLs
//                               (paste the real pattern from an actual preview;
//                                the project is `opm-website`, not `opm-platform`)
// A matched origin is reflected back; an unknown origin gets no ACAO header
// (browser blocks the cross-origin read — correct).

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  const list = (process.env.PUBLIC_CORS_ORIGINS || 'https://opmcinemas.com,https://www.opmcinemas.com')
    .split(',').map(o => o.trim()).filter(Boolean)
  if (list.includes(origin)) return origin
  const rx = process.env.PUBLIC_CORS_PREVIEW_REGEX
  if (rx) { try { if (new RegExp(rx).test(origin)) return origin } catch { /* bad regex → ignore */ } }
  return null
}

export function corsHeaders(req: Request, methods = 'GET,POST,OPTIONS'): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
  const origin = allowedOrigin(req.headers.get('origin'))
  if (origin) h['Access-Control-Allow-Origin'] = origin
  return h
}

// Attach CORS headers to an existing response (so error responses are also
// readable cross-origin) and return it.
export function withCors(req: Request, res: NextResponse, methods = 'GET,POST,OPTIONS'): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(req, methods))) res.headers.set(k, v)
  return res
}

// Preflight (OPTIONS) response.
export function preflight(req: Request, methods = 'GET,POST,OPTIONS'): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req, methods) })
}
