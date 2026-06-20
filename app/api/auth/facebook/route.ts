import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  // In development, the redirect URI must match exactly what is registered in the Meta App
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/facebook`
  
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'Meta App ID or Secret missing from environment variables' }, { status: 400 })
  }

  if (!code) {
    // Start OAuth flow
    const scopes = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish'
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`
    return NextResponse.redirect(authUrl)
  }

  // Handle the callback
  try {
    // 1. Exchange code for short-lived access token
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`)
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Meta Token Error:', tokenData.error)
      return NextResponse.json({ error: tokenData.error.message }, { status: 400 })
    }

    let accessToken = tokenData.access_token

    // 2. Exchange short-lived token for long-lived token
    const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`)
    const longLivedData = await longLivedRes.json()
    
    if (longLivedData.access_token) {
      accessToken = longLivedData.access_token
    }

    // 3. Save to database for Facebook
    await prisma.socialAccount.upsert({
      where: { id: 'facebook_primary' },
      update: {
        accessToken: accessToken,
        lastSync: new Date()
      },
      create: {
        id: 'facebook_primary',
        platform: 'facebook',
        handle: 'primary',
        accessToken: accessToken,
        lastSync: new Date()
      }
    })

    // Also save for Instagram (assuming they are linked to the same user token for now)
    await prisma.socialAccount.upsert({
      where: { id: 'instagram_primary' },
      update: {
        accessToken: accessToken,
        lastSync: new Date()
      },
      create: {
        id: 'instagram_primary',
        platform: 'instagram',
        handle: 'primary',
        accessToken: accessToken,
        lastSync: new Date()
      }
    })

    return NextResponse.redirect(new URL('/social', request.url))
  } catch (error) {
    console.error('Meta Auth Error:', error)
    return NextResponse.json({ error: 'Internal server error during Meta authentication' }, { status: 500 })
  }
}
