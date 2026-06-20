import { NextRequest, NextResponse } from 'next/server'

type RouteHandler = (request: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse

export function withLedgerSanitation(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      // Clone the request to read its text body without consuming the original stream entirely
      const clone = request.clone()
      const rawBody = await clone.text()
      
      // If there's no body (e.g., GET request), just pass the request through
      if (!rawBody) {
        return handler(request, ...args)
      }

      let parsedBody: any
      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        // If not JSON, we pass it through
        return handler(request, ...args)
      }

      if (typeof parsedBody !== 'object' || parsedBody === null) {
        return handler(request, ...args)
      }

      // Deep string sanitation function
      const sanitizeData = (data: any): any => {
        if (typeof data === 'string') {
          // Normalize string to NFKC and strip out zero-width characters completely
          return data
            .normalize('NFKC')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
        }
        if (Array.isArray(data)) {
          return data.map(sanitizeData)
        }
        if (typeof data === 'object' && data !== null) {
          const cleaned: any = {}
          for (const [key, value] of Object.entries(data)) {
            cleaned[key] = sanitizeData(value)
          }
          return cleaned
        }
        return data
      }

      const cleanedBody = sanitizeData(parsedBody)

      // Strict mathematical invariant validation
      if (
        'amount' in cleanedBody &&
        'tds_amount' in cleanedBody &&
        'net_payable' in cleanedBody
      ) {
        const amount = Number(cleanedBody.amount) || 0
        const tds = Number(cleanedBody.tds_amount) || 0
        const netPayable = Number(cleanedBody.net_payable) || 0

        // Calculate base amount minus TDS amount
        const expectedNet = amount - tds

        // If a mismatch exists against Net Payable, intercept the sequence
        if (expectedNet !== netPayable) {
          return NextResponse.json(
            { error: "Math validation fault: Net payable mismatch." },
            { status: 400 }
          )
        }
      }

      // Reconstruct the NextRequest with the deeply cleaned parameters
      const sanitizedRequest = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(cleanedBody),
      })

      // Pass the cleaned parameters forward to the regular route logic
      return handler(sanitizedRequest, ...args)
    } catch (error) {
      console.error('[Middleware] Ledger Sanitation Error:', error)
      return NextResponse.json({ error: 'Data Sanitation Fault' }, { status: 500 })
    }
  }
}
