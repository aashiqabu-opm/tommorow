export async function getDriveData() {
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
      console.error('Google OAuth error (Drive):', err)
      return { status: 'error', error: 'Authentication failed' }
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return { status: 'error', error: 'No access token returned' }
    }

    // 2. Query Google Drive API to find the "OPM" folder
    const searchParams = new URLSearchParams({
      q: "name='OPM' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id,name)"
    })

    const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 }
    })

    if (!folderRes.ok) {
      const err = await folderRes.text()
      console.error('Google Drive API error:', err)
      return { status: 'error', error: 'Drive API failed' }
    }

    const folderData = await folderRes.json()
    const files = folderData.files || []

    if (files.length === 0) {
      return { status: 'success', folderFound: false, message: 'OPM folder not found', filesCount: 0 }
    }

    const folderId = files[0].id

    // 3. Get files inside the OPM folder
    const filesParams = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,createdTime)"
    })

    const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?${filesParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 }
    })

    if (!filesRes.ok) {
      return { status: 'error', error: 'Failed to list files inside OPM folder' }
    }

    const filesData = await filesRes.json()
    const containedFiles = filesData.files || []

    return {
      status: 'success',
      folderFound: true,
      filesCount: containedFiles.length,
      files: containedFiles.slice(0, 5) // Return top 5 recent files for preview
    }

  } catch (err: any) {
    console.error('Google Drive Integration error:', err)
    return { status: 'error', error: err.message }
  }
}
