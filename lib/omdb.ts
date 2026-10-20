import { SERVER_SYNC } from './api'

const OMDB_BASE = 'https://www.omdbapi.com'
const OMDB_KEY  = () => process.env.NEXT_PUBLIC_OMDB_KEY || ''

export interface OmdbRatings {
  imdbRating?: string; rottenTomatoes?: string; metacritic?: string
  rated?: string; runtime?: string; director?: string
}
interface OmdbResponse {
  Response: string; imdbRating?: string; Rated?: string; Runtime?: string; Director?: string
  Ratings?: Array<{ Source: string; Value: string }>
}

export async function fetchOmdbByImdbId(imdbId: string): Promise<OmdbRatings | null> {
  if (!imdbId || !imdbId.startsWith('tt')) return null
  try {
    // Self-hosted build: through RoscaTV's own server, which holds the key (app/api/omdb).
    const res = SERVER_SYNC
      ? await fetch(`/api/omdb?i=${encodeURIComponent(imdbId)}`, { credentials: 'same-origin' })
      : await fetch(`${OMDB_BASE}/?apikey=${OMDB_KEY()}&i=${imdbId}&plot=none`)
    if (!res.ok) return null
    const data: OmdbResponse = await res.json()
    if (data.Response !== 'True') return null
    const r: OmdbRatings = {}
    if (data.imdbRating && data.imdbRating !== 'N/A') r.imdbRating = data.imdbRating
    if (data.Rated    && data.Rated    !== 'N/A') r.rated    = data.Rated
    if (data.Runtime  && data.Runtime  !== 'N/A') r.runtime  = data.Runtime
    if (data.Director && data.Director !== 'N/A') r.director = data.Director
    for (const entry of data.Ratings ?? []) {
      if (entry.Source === 'Rotten Tomatoes') r.rottenTomatoes = entry.Value
      else if (entry.Source === 'Metacritic') r.metacritic     = entry.Value
    }
    return Object.keys(r).length > 0 ? r : null
  } catch { return null }
}
