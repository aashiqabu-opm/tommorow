import { getFacebookData } from './lib/facebook'
import { getInstagramData } from './lib/instagram'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testScrape() {
  // clear the mock tokens first so it falls back to scraping
  await prisma.socialAccount.deleteMany({
    where: { accessToken: 'FORCE_MOCKED_TOKEN' }
  })
  
  console.log('--- Testing Facebook ---')
  const fbData = await getFacebookData()
  console.dir(fbData)

  console.log('--- Testing Facebook HTML ---')
  const fbRes = await fetch('https://www.facebook.com/AashiqAbuOnline/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  })
  const fbHtml = await fbRes.text()
  console.log('FB Title:', fbHtml.match(/<title[^>]*>([^<]+)<\/title>/)?.[1])
  console.log('FB Description:', fbHtml.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1])
  console.log('FB OG:Description:', fbHtml.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1])
  
  console.log('\n--- Testing Instagram HTML ---')
  const igRes = await fetch('https://www.instagram.com/aashiqabu/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  })
  const igHtml = await igRes.text()
  console.log('IG Title:', igHtml.match(/<title[^>]*>([^<]+)<\/title>/)?.[1])
  console.log('IG Description:', igHtml.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1])
  console.log('IG OG:Description:', igHtml.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1])
}

testScrape()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
