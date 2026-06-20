export async function getYoutubeFinancials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken || refreshToken === 'PASTE_YOUR_ACTUAL_REFRESH_TOKEN_HERE') {
    return { status: 'auth_required' }
  }

  try {
    // 1. Get an access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }),
      cache: 'no-store'
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Google OAuth error:', err)
      return { status: 'error', error: 'Authentication failed' }
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return { status: 'error', error: 'No access token returned' }
    }

    // 2. Query YouTube Analytics API for the last 30 days
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]
    
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(today),
      metrics: 'estimatedRevenue',
    })

    const analyticsRes = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      // Cache this request for a short period to avoid hitting quota limits on every page load
      next: { revalidate: 3600 } 
    })

    if (!analyticsRes.ok) {
      const err = await analyticsRes.text()
      console.error('YouTube Analytics API error:', err)
      return { status: 'error', error: 'Analytics API failed' }
    }

    const analyticsData = await analyticsRes.json()
    
    // The response looks like: { "rows": [ [ 1234.56 ] ] }
    const revenue = analyticsData.rows?.[0]?.[0] || 0

    return {
      status: 'success',
      revenue: parseFloat(revenue).toFixed(2),
      // Run rate is just a projection. Since this is 30 days, we can use it as the monthly run rate directly.
      runRate: parseFloat(revenue).toFixed(2)
    }

  } catch (err: any) {
    console.error('YouTube Integration error:', err)
    return { status: 'error', error: err.message }
  }
}
