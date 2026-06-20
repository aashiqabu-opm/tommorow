import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getInstagramData(targetHandle?: string) {
  const handle = targetHandle || process.env.INSTAGRAM_HANDLE || 'aashiqabu'

  // First check the database for an authenticated token
  const dbAccount = await prisma.socialAccount.findUnique({
    where: { id: 'instagram_primary' }
  })
  
  const accessToken = dbAccount?.accessToken || process.env.FACEBOOK_ACCESS_TOKEN
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID

  // If we have a mock token injected from our force-sync script, return dummy data instantly
  if (accessToken === 'FORCE_MOCKED_TOKEN') {
    return {
      status: 'success',
      handle: handle,
      followers: 545000,
      posts: 2794,
      method: 'mocked'
    }
  }

  // If we have a real access token and an IG account ID, try the Graph API first
  if (accessToken && igAccountId && accessToken !== 'PASTE_YOUR_FACEBOOK_TOKEN_HERE') {
    try {
      const igRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}?fields=username,followers_count,media_count&access_token=${accessToken}`, {
        next: { revalidate: 3600 }
      })

      if (igRes.ok) {
        const igData = await igRes.json()
        return {
          status: 'success',
          handle: igData.username || handle,
          followers: igData.followers_count || 0,
          posts: igData.media_count || 0,
          method: 'api'
        }
      }
    } catch (err) {
      console.error('Instagram Graph API failed, falling back to public scrape', err)
    }
  }

  try {
    const htmlRes = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 }
    })
    
    if (!htmlRes.ok) {
      return { status: 'error', error: 'Failed to scrape public page', handle }
    }

    const html = await htmlRes.text()
    
    // Use regex to extract the followers from the meta description
    // Example: "545K Followers, 766 Following, 2,794 Posts - See Instagram photos and videos from Aashiq Abu (@aashiqabu)"
    const descriptionMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    
    if (descriptionMatch && descriptionMatch[1]) {
      const desc = descriptionMatch[1]
      const followersMatch = desc.match(/([\d.,KMBkmb]+)\s+Followers/i)
      const postsMatch = desc.match(/([\d.,KMBkmb]+)\s+Posts/i)
      
      const parseNumber = (str: string) => {
        let numStr = str.replace(/,/g, '').toUpperCase()
        let multiplier = 1
        if (numStr.endsWith('K')) {
          multiplier = 1000
          numStr = numStr.slice(0, -1)
        } else if (numStr.endsWith('M')) {
          multiplier = 1000000
          numStr = numStr.slice(0, -1)
        } else if (numStr.endsWith('B')) {
          multiplier = 1000000000
          numStr = numStr.slice(0, -1)
        }
        return Math.floor(parseFloat(numStr) * multiplier)
      }

      const followers = followersMatch ? parseNumber(followersMatch[1]) : 0
      const posts = postsMatch ? parseNumber(postsMatch[1]) : 0

      return {
        status: 'success',
        handle: handle,
        followers: followers,
        posts: posts,
        method: 'scrape'
      }
    }

    return { status: 'error', error: 'Could not parse public page stats', handle }

  } catch (err: any) {
    console.error('Instagram Scrape error:', err)
    return { status: 'error', error: err.message, handle }
  }
}
