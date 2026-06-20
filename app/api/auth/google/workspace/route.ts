import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/workspace`
  
  if (!clientId || !clientSecret) {
     return NextResponse.json({ error: 'Google Workspace Client ID or Secret missing from .env' }, { status: 400 })
  }

  if (!code) {
    // Start OAuth flow
    const scopes = 'https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/admin.directory.group.readonly'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`
    return NextResponse.redirect(authUrl)
  }

  // Handle the callback
  try {
    const profile = await getSessionProfile()
    if (!profile || (profile.role !== 'founder' && profile.role !== 'general_manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code:', tokenData)
      return NextResponse.json({ error: 'Failed to exchange OAuth code' }, { status: 400 })
    }

    const { access_token, refresh_token, scope } = tokenData

    // Decode token or fetch user info to know which email authorized it,
    // but for now, we just save it for the domain since it's an admin account
    const domain = 'opmrecords.com'

    // Upsert the workspace account
    const existing = await prisma.workspaceAccount.findFirst({ where: { domain } })
    
    if (existing) {
      await prisma.workspaceAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token || existing.refreshToken,
          scopes: scope,
          adminEmail: profile.email,
        }
      })
    } else {
      await prisma.workspaceAccount.create({
        data: {
          domain,
          adminEmail: profile.email,
          accessToken: access_token,
          refreshToken: refresh_token,
          scopes: scope,
        }
      })
    }

    return NextResponse.redirect(new URL('/workspace', request.url))
  } catch (error) {
    console.error('Google Workspace Auth Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
