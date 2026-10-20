/* TMDB and OMDb through RoscaTV's own server (Docker builds). The keys live
   only in the server's environment (TMDB_TOKEN, OMDB_KEY in .env): they never
   reach the browser or the image. Only the requests the app makes are let
   through, so the routes can't be used as an open relay. */

const TMDB_BASE = 'https://api.themoviedb.org/3'
const OMDB_BASE = 'https://www.omdbapi.com'

// The TMDB paths the app uses (lib/tmdb.ts), and the query parameters they take.
const TMDB_PATHS = [
  /^search\/multi$/,
  /^configuration$/,
  /^(movie|tv)\/\d{1,9}$/,
  /^(movie|tv)\/\d{1,9}\/(watch\/providers|recommendations|external_ids)$/,
]
const TMDB_PARAMS = new Set(['query', 'include_adult', 'page', 'language'])

/** The upstream TMDB address for an allowed request, or null. */
export function tmdbUpstream(path: string, search: URLSearchParams): string | null {
  if (!TMDB_PATHS.some(re => re.test(path))) return null
  const q = new URLSearchParams()
  for (const [k, v] of search) {
    if (!TMDB_PARAMS.has(k) || v.length > 200) return null
    q.append(k, v)
  }
  const qs = q.toString()
  return `${TMDB_BASE}/${path}${qs ? `?${qs}` : ''}`
}

/** The upstream OMDb address for an IMDb id (tt + digits), or null. */
export function omdbUpstream(imdbId: string | null, key: string): string | null {
  if (!imdbId || !/^tt\d{5,10}$/.test(imdbId)) return null
  return `${OMDB_BASE}/?apikey=${encodeURIComponent(key)}&i=${imdbId}&plot=none`
}

/** Passes an upstream answer back as JSON; keys never appear in it. */
export async function relay(url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
  } catch {
    return Response.json({ error: 'upstream unreachable' }, { status: 502 })
  }
  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
  })
}
