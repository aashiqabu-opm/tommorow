import Anthropic from '@anthropic-ai/sdk'

// Release intelligence: box-office auto-fetch, trend analysis, and online
// piracy / reputation monitoring. The fetch + scan use Claude's server-side
// web_search tool. All of this is READ-ONLY — it never moves money or changes
// financial records; fetched numbers arrive UNCONFIRMED for a human to verify.

export interface CollectionEstimate {
  day_number: number | null
  india_net: number | null        // rupees
  worldwide_gross: number | null  // rupees
  source: string | null
  note: string
}

export interface Finding {
  category: 'piracy' | 'reputation'
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  url: string | null
}

export interface TrendAnalysis {
  headline: string
  commentary: string
}

const WEB_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 6 } as const

export const intelConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY)

// Pull all text from a (possibly tool-using) response and extract the JSON blob.
function extractJson<T>(content: Anthropic.Messages.ContentBlock[]): T | null {
  const text = content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(text.slice(start, end + 1)) as T } catch { return null }
}

function client() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) }

// ── Auto-fetch the latest box-office number via web search ──────────────
export async function fetchCollectionEstimate(film: string, context?: string): Promise<CollectionEstimate | null> {
  if (!intelConfigured()) return null
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2500,
      tools: [WEB_TOOL],
      system: `You research Indian theatrical box-office collections. Use web search to find the most recent publicly reported daily collection for a specific film. Be conservative — only report a number you actually find on a credible source (e.g. Sacnilk, industry trade sites, mainstream news). Report rupees as plain integers (e.g. ₹1.2 crore = 12000000), not "crore". If you cannot find a reliable figure, return nulls with a short note explaining that. Respond with ONLY a JSON object: {"day_number": int|null, "india_net": number|null, "worldwide_gross": number|null, "source": string|null, "note": string}.`,
      messages: [{ role: 'user', content: `Film: "${film}"${context ? ` (${context})` : ''}. Find its latest reported box-office collection (India net and worldwide gross if available) and which day of release it is. Return the JSON.` }],
    })
    return extractJson<CollectionEstimate>(res.content)
  } catch { return null }
}

// ── Scan the web for piracy + reputation threats ────────────────────────
export async function scanOnline(film: string, context?: string): Promise<Finding[]> {
  if (!intelConfigured()) return []
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3500,
      tools: [WEB_TOOL],
      system: `You are a release-protection analyst for a film producer. Use web search to look for two things about a specific film: (1) PIRACY — leaked/pirated copies, torrent listings, Telegram channels, illegal streaming/download sites distributing it; (2) REPUTATION — coordinated hate campaigns, organized review-bombing, or deliberate negative/defamatory campaigns against the film or its makers (distinct from ordinary mixed reviews). Only report concrete, specific findings backed by a real URL you found. Do NOT fabricate. Rate severity: high = active widespread piracy or a clearly coordinated campaign; medium = isolated/emerging; low = minor/unverified. Respond with ONLY a JSON object: {"findings": [{"category": "piracy"|"reputation", "severity": "high"|"medium"|"low", "title": string, "detail": string, "url": string|null}]}. If nothing notable, return {"findings": []}.`,
      messages: [{ role: 'user', content: `Film: "${film}"${context ? ` (${context})` : ''}. Scan for piracy and coordinated hate/negative campaigns. Return the JSON.` }],
    })
    const out = extractJson<{ findings?: Finding[] }>(res.content)
    return (out?.findings ?? []).filter(f => f && f.title && (f.category === 'piracy' || f.category === 'reputation')).slice(0, 20)
  } catch { return [] }
}

// ── Track one campaign asset's online reception (trailer/song/poster…) ──
export interface AssetBuzz {
  summary: string
  sentiment: 'positive' | 'mixed' | 'negative' | 'unknown'
  metrics: { views?: string; likes?: string; comments?: string; trending?: string }
}

export async function trackCampaignAsset(
  film: string, assetType: string, title: string, url?: string | null,
): Promise<AssetBuzz | null> {
  if (!intelConfigured()) return null
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      tools: [WEB_TOOL],
      system: `You track how a film's marketing asset (teaser, trailer, poster, song, promo) is performing online for an Indian (Malayalam) film producer. Use web search to find concrete signals: YouTube view/like counts, whether it's trending, social media reception, and overall sentiment. Be specific with numbers when you find them; say "unknown" when you don't. Respond with ONLY JSON: {"summary": string (2-3 sentences, specific), "sentiment": "positive"|"mixed"|"negative"|"unknown", "metrics": {"views": string|null, "likes": string|null, "comments": string|null, "trending": string|null}}.`,
      messages: [{ role: 'user', content: `Film "${film}" — ${assetType} titled "${title}"${url ? ` (${url})` : ''}. How is it performing / being received online? Return the JSON.` }],
    })
    return extractJson<AssetBuzz>(res.content)
  } catch { return null }
}

// ── Discover new Malayalam releases (films released in the last ~7 days) ─
export interface DiscoveredFilm { title: string; release_date: string | null; note: string }

export async function discoverMalayalamReleases(): Promise<DiscoveredFilm[]> {
  if (!intelConfigured()) return []
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2500,
      tools: [WEB_TOOL],
      system: `You track new Malayalam theatrical releases for a producer. Use web search (Sacnilk, trade pages, Malayalam entertainment news) to list Malayalam films that RELEASED in cinemas within the last 7 days. Only real theatrical releases — exclude OTT-only and re-releases unless notable. Give each film's release date (YYYY-MM-DD) if known. Respond with ONLY JSON: {"films": [{"title": string, "release_date": string|null, "note": string (one line — cast/genre/scale)}]}. If none, return {"films": []}.`,
      messages: [{ role: 'user', content: `List Malayalam films released in the last 7 days. Return the JSON.` }],
    })
    const out = extractJson<{ films?: DiscoveredFilm[] }>(res.content)
    return (out?.films ?? []).filter(f => f && f.title).slice(0, 25)
  } catch { return [] }
}

// ── Fetch one industry film's collection for a specific day ─────────────
export interface DayCollection { day_number: number | null; india_net: number | null; worldwide_gross: number | null; source: string | null; note: string }

export async function fetchIndustryFilmCollection(title: string, releaseDate: string | null, dayNumber: number): Promise<DayCollection | null> {
  if (!intelConfigured()) return null
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      tools: [WEB_TOOL],
      system: `You research Malayalam theatrical box-office collections. Use web search to find a film's collection for a specific day of its release. Report rupees as plain integers (₹1.2 crore = 12000000), not "crore". Only report a figure you actually find on a credible source. Respond with ONLY JSON: {"day_number": int|null, "india_net": number|null, "worldwide_gross": number|null, "source": string|null, "note": string (one line on how it's trending)}.`,
      messages: [{ role: 'user', content: `Film "${title}"${releaseDate ? ` (released ${releaseDate})` : ''} — find its day ${dayNumber} box-office collection (India net, worldwide if available). Return the JSON.` }],
    })
    return extractJson<DayCollection>(res.content)
  } catch { return null }
}

// ── Trend commentary over the collected day-wise numbers (no web) ───────
export async function analyzeCollectionTrend(
  film: string,
  rows: { day_number: number | null; collection_date: string; india_net: number | null; worldwide_gross: number | null; occupancy: number | null }[],
): Promise<TrendAnalysis | null> {
  if (!intelConfigured() || rows.length === 0) return null
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      system: `You are a box-office analyst for an Indian film producer (amounts in ₹). Given day-wise collections, write a short, specific read on the trend: opening strength, weekday/weekend holds, drops, momentum, and a rough lifetime trajectory if sensible. Be concrete with the numbers. No fluff. Respond with ONLY JSON: {"headline": string (one line), "commentary": string (2-4 sentences)}.`,
      messages: [{ role: 'user', content: `Film "${film}" day-wise India net (₹):\n${JSON.stringify(rows)}\n\nAnalyze the trend.` }],
    })
    return extractJson<TrendAnalysis>(res.content)
  } catch { return null }
}
