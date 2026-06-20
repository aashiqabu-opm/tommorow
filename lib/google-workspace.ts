import { prisma } from '@/lib/prisma'

export interface GoogleUser {
  id: string
  primaryEmail: string
  name: {
    fullName: string
    givenName: string
    familyName: string
  }
  suspended: boolean
  lastLoginTime: string
}

/**
 * Fetches all users from the Google Workspace using the Admin SDK Directory API.
 * Currently returns mock data if no real tokens exist.
 */
export async function getWorkspaceUsers(domain: string = 'opmrecords.com'): Promise<GoogleUser[]> {
  const account = await prisma.workspaceAccount.findFirst({
    where: { domain }
  })

  // If we don't have a connected account, return empty array for now
  if (!account) {
    return []
  }

  // Check if token is expired (if lastSync is old or we just assume it might be)
  // For simplicity right now, we will just use the access token. 
  // In a robust implementation, we should check expiry and use the refresh token if needed.
  try {
    const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?domain=${domain}&maxResults=100`, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
      cache: 'no-store'
    })

    if (!res.ok) {
      if (res.status === 401 && account.refreshToken) {
        // Need to refresh token (simplified version)
        console.warn('[Google Admin] Access token expired, needs refresh logic')
      }
      console.error('[Google Admin] Failed to fetch users:', await res.text())
      return []
    }

    const data = await res.json()
    return data.users?.map((u: any) => ({
      id: u.id,
      primaryEmail: u.primaryEmail,
      name: {
        fullName: u.name.fullName,
        givenName: u.name.givenName,
        familyName: u.name.familyName
      },
      suspended: u.suspended,
      lastLoginTime: u.lastLoginTime
    })) || []
  } catch (error) {
    console.error('[Google Admin] Exception fetching users:', error)
    return []
  }
}

export async function toggleUserSuspension(email: string, suspended: boolean, domain: string = 'opmrecords.com') {
  const account = await prisma.workspaceAccount.findFirst({ where: { domain } })
  if (!account) throw new Error('No workspace account connected')

  const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${email}`, {
    method: 'PUT',
    body: JSON.stringify({ suspended }),
    headers: { 
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`Failed to update user: ${await res.text()}`)
  }
  
  console.log(`[Google Admin] Toggled suspension for ${email} to ${suspended}`)
}
