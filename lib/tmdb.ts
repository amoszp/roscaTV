import type { TMDBResult, TMDBProvider, TMDBSeason } from './types'
import { SERVER_SYNC } from './api'

const BASE  = 'https://api.themoviedb.org/3'
const IMG   = 'https://image.tmdb.org/t/p'
const TOKEN = () => process.env.NEXT_PUBLIC_TMDB_TOKEN || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (SERVER_SYNC) {
    // Self-hosted build: through RoscaTV's own server, which holds the token
    // (app/api/tmdb); the browser never sees it.
    const res = await fetch(`/api/tmdb${path}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`TMDB ${res.status}`)
    return res.json() as Promise<T>
  }
  const token = TOKEN()
  if (token) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (res.ok) return res.json() as Promise<T>
    if (res.status !== 401 && res.status !== 403) throw new Error(`TMDB ${res.status}`)
  }
  const sep = path.includes('?') ? '&' : '?'
  const res2 = await fetch(`${BASE}${path}${sep}api_key=${TOKEN()}`, { headers: { 'Content-Type': 'application/json' } })
  if (!res2.ok) throw new Error(`TMDB ${res2.status}`)
  return res2.json() as Promise<T>
}

export function buildPosterUrlSync(posterPath: string, size = 'w500'): string {
  const path = posterPath.startsWith('/') ? posterPath : `/${posterPath}`
  return `${IMG}/${size}${path}`
}
export async function buildPosterUrl(posterPath: string, size = 'w500'): Promise<string> {
  return buildPosterUrlSync(posterPath, size)
}
export function posterUrl(path: string | null | undefined, size = 'w185'): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return buildPosterUrlSync(path, size)
}

export async function searchMulti(query: string): Promise<TMDBResult[]> {
  if (!query.trim()) return []
  const data = await apiFetch<{ results: TMDBResult[] }>(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false&page=1`)
  return (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 25)
}

interface WPResult { flatrate?: TMDBProvider[]; rent?: TMDBProvider[]; buy?: TMDBProvider[]; free?: TMDBProvider[] }
export async function getWatchProviders(mediaType: 'movie'|'tv', id: number, region: string): Promise<TMDBProvider[]> {
  try {
    const data = await apiFetch<{ results: Record<string, WPResult> }>(`/${mediaType}/${id}/watch/providers`)
    const rd = (data.results || {})[region] || {}
    const providers = [...(rd.flatrate || []), ...(rd.free || [])]
    const seen = new Set<number>()
    return providers.filter(p => { if (seen.has(p.provider_id)) return false; seen.add(p.provider_id); return true }).slice(0, 10)
  } catch { return [] }
}

export async function getTVSeasons(id: number): Promise<TMDBSeason[]> {
  try {
    const data = await apiFetch<{ seasons: TMDBSeason[] }>(`/tv/${id}`)
    return (data.seasons || []).filter(s => s.season_number > 0)
  } catch { return [] }
}

/* Home "Coming Soon" — reads TMDB's next_episode_to_air for a tracked series.
   Returns the air date plus season/episode number if a new episode is scheduled, else null. */
export interface NextEpisode { airDate: string; seasonNumber: number; episodeNumber: number }
export async function getTVNextEpisode(id: number): Promise<NextEpisode | null> {
  try {
    const data = await apiFetch<{ next_episode_to_air?: { air_date?: string; season_number?: number; episode_number?: number } | null }>(`/tv/${id}`)
    const n = data.next_episode_to_air
    if (!n?.air_date) return null
    return { airDate: n.air_date, seasonNumber: n.season_number ?? 0, episodeNumber: n.episode_number ?? 0 }
  } catch { return null }
}

/* Home "Based on Your Interests" — TMDB's per-title recommendations,
   tagged with media_type since the sub-resource response omits it. */
export async function getRecommendations(mediaType: 'movie'|'tv', id: number): Promise<TMDBResult[]> {
  try {
    const data = await apiFetch<{ results: TMDBResult[] }>(`/${mediaType}/${id}/recommendations`)
    return (data.results || []).map(r => ({ ...r, media_type: mediaType }))
  } catch { return [] }
}

export interface TMDBItemDetails {
  id: number; poster_path: string | null; backdrop_path?: string | null
  title?: string; name?: string; vote_average?: number
  release_date?: string; first_air_date?: string; imdb_id?: string
}

export function resolveMediaPath(mediaType: string): 'movie' | 'tv' { return mediaType === 'movie' ? 'movie' : 'tv' }

export async function fetchItemDetails(mediaType: string, id: number): Promise<TMDBItemDetails | null> {
  try { return await apiFetch<TMDBItemDetails>(`/${resolveMediaPath(mediaType)}/${id}`) } catch { return null }
}
export async function fetchTVExternalIds(id: number): Promise<{ imdb_id?: string } | null> {
  try { return await apiFetch<{ imdb_id?: string }>(`/tv/${id}/external_ids`) } catch { return null }
}

export const ANIME_GENRE_ID = 16; export const ANIME_COUNTRIES = ['JP', 'KR']
export function detectAnime(r: TMDBResult): boolean {
  return r.media_type === 'tv' && Boolean(r.genre_ids?.includes(ANIME_GENRE_ID)) && Boolean(r.origin_country?.some(c => ANIME_COUNTRIES.includes(c)))
}
export function getLibraryType(r: TMDBResult): 'movies'|'series'|'anime' {
  if (r.media_type === 'movie') return 'movies'; if (detectAnime(r)) return 'anime'; return 'series'
}
export function formatRating(v: number | undefined): string { if (!v) return '—'; return (Math.round(v*10)/10).toFixed(1) }
export function getYear(r: TMDBResult): string { return (r.release_date || r.first_air_date || '').slice(0,4) }
export function getTitle(r: TMDBResult): string { return r.title || r.name || 'Unknown' }

let _cfg: { images: { secure_base_url: string; poster_sizes: string[] } } | null = null
export async function getTMDBConfig() {
  if (_cfg) return _cfg
  _cfg = await apiFetch('/configuration')
  return _cfg
}
