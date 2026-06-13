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

const WEB_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 12 } as const

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
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      tools: [WEB_TOOL],
      system: `You research Indian (Malayalam) theatrical box-office collections. Use web search aggressively (up to 12 searches) to find the most recent publicly reported daily collection for a specific film. Search Sacnilk specifically — query "<film> sacnilk box office collection" and open the tracker page (it has day-wise India net for Malayalam films); also try trade sites and "<film> day N collection". Report rupees as plain integers (₹1.2 crore = 12000000), never "crore"/"lakh" strings. Only report a number you actually find on a credible source. If after genuinely trying you find nothing, return nulls with a short note. Respond with ONLY a JSON object: {"day_number": int|null, "india_net": number|null, "worldwide_gross": number|null, "source": string|null, "note": string}.`,
      messages: [{ role: 'user', content: `Film: "${film}"${context ? ` (${context})` : ''}. Find its latest reported box-office collection (India net + worldwide if available) and which day of release it is, using Sacnilk and trade trackers. Return the JSON.` }],
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

// ── Track ALL recent Malayalam releases day-wise in one agentic pass ─────
// One rich web-search call that both discovers the films and pulls each one's
// day-by-day collection — far more reliable than discover-then-fetch, and not
// dependent on knowing release dates up front.
export interface TrackedFilm {
  title: string
  release_date: string | null            // YYYY-MM-DD
  days: { day: number; india_net: number | null; worldwide: number | null; source: string | null }[]
  total_india: number | null
  note: string
}

export interface WebSearchDebug {
  configured: boolean
  stop_reason: string | null
  searches: string[]        // the queries the model actually issued
  result_blocks: number     // # of web_search_tool_result blocks
  total_results: number     // # of results returned across them
  search_errors: string[]   // any tool-level errors
  text_preview: string      // first part of the final text (to inspect JSON)
  parsed: boolean
  films_count: number
  error?: string
}

function normalizeTrackedFilms(out: { films?: TrackedFilm[] } | null): TrackedFilm[] {
  return (out?.films ?? [])
    .filter(f => f && f.title)
    .map(f => {
      const days = (Array.isArray(f.days) ? f.days : []).filter(d => d && typeof d.day === 'number').sort((a, b) => a.day - b.day)
      const total = days.reduce((s, d) => s + (Number(d.india_net) || 0), 0)
      return { ...f, days, total_india: total > 0 ? total : (f.total_india ?? null) }
    })
    .slice(0, 30)
}

const TRACKER_SYSTEM = (todayISO: string) => `You are a box-office data analyst for a Malayalam film producer. Today is ${todayISO}. Your job: find EVERY Malayalam film that released in theatres in the last ~10 days and pull its DAY-BY-DAY India net box-office collection.

Be thorough and aggressive — make as many web searches as you need (you have up to 12). Work like this:
1. Search for recent Malayalam theatrical releases (e.g. "Malayalam movies released this week", "<this month> Malayalam releases", entertainment news).
2. For EACH film, search Sacnilk specifically — query "<film name> sacnilk box office collection" and open the tracker page. Sacnilk publishes day-wise India net collections for Malayalam films and is the most reliable source. Also try "<film name> day 1 day 2 collection" and trade sites.
3. Extract the day-wise India net figures (Day 1, Day 2, …) and worldwide gross if reported.

Rules:
- Report rupees as PLAIN INTEGERS: ₹1.25 crore = 12500000, ₹40 lakh = 4000000. Never output "crore"/"lakh" strings in number fields.
- Only include real THEATRICAL Malayalam releases (skip OTT-only and re-releases unless clearly notable).
- Include a film even if you only found Day 1 — partial day data is fine. Use null for days/figures you genuinely can't find, but TRY HARD first.
- release_date in YYYY-MM-DD.

Respond with ONLY JSON (no prose):
{"films": [{"title": string, "release_date": string|null, "days": [{"day": int, "india_net": number|null, "worldwide": number|null, "source": string|null}], "note": string (one line: cast/verdict/how it's trending)}]}
If you truly find nothing, return {"films": []}.`

// Tracker with full web-search diagnostics — surfaces whether the search tool
// actually fired, what it searched, how many results came back, and the raw
// model text, so we can tell search failures from parsing failures.
export async function trackMalayalamReleasesDebug(todayISO: string): Promise<{ films: TrackedFilm[]; debug: WebSearchDebug }> {
  const debug: WebSearchDebug = { configured: intelConfigured(), stop_reason: null, searches: [], result_blocks: 0, total_results: 0, search_errors: [], text_preview: '', parsed: false, films_count: 0 }
  if (!intelConfigured()) { debug.error = 'ANTHROPIC_API_KEY not set'; return { films: [], debug } }
  try {
    const res = await client().messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      tools: [WEB_TOOL],
      system: TRACKER_SYSTEM(todayISO),
      messages: [{ role: 'user', content: `Find all Malayalam theatrical releases from the last ~10 days and their day-wise India net collections (use Sacnilk and trade trackers). Return the JSON.` }],
    })
    debug.stop_reason = res.stop_reason ?? null
    for (const b of res.content) {
      if (b.type === 'server_tool_use') {
        const q = (b as { input?: { query?: string } }).input?.query
        if (q) debug.searches.push(q)
      } else if (b.type === 'web_search_tool_result') {
        debug.result_blocks++
        const c = (b as { content?: unknown }).content
        if (Array.isArray(c)) debug.total_results += c.length
        else if (c && typeof c === 'object' && 'error_code' in (c as object)) debug.search_errors.push(String((c as { error_code?: string }).error_code))
      }
    }
    const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n')
    debug.text_preview = text.slice(0, 2000)
    const out = extractJson<{ films?: TrackedFilm[] }>(res.content)
    debug.parsed = Boolean(out)
    const films = normalizeTrackedFilms(out)
    debug.films_count = films.length
    return { films, debug }
  } catch (e) {
    debug.error = (e as { message?: string })?.message ?? 'unknown error'
    return { films: [], debug }
  }
}

export async function trackMalayalamReleases(todayISO: string): Promise<TrackedFilm[]> {
  return (await trackMalayalamReleasesDebug(todayISO)).films
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
