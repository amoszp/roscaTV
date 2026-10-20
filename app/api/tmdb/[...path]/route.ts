import { json, withUser } from '@/lib/server/accounts'
import { relay, tmdbUpstream } from '@/lib/server/media'

export const dynamic = 'force-dynamic'

type Ctx = { params: { path: string[] } }

/** TMDB for signed-in users, with the server's token (see lib/server/media.ts). */
export const GET = withUser<Ctx>((req, _user, { params }) => {
  const token = process.env.TMDB_TOKEN
  if (!token) return json({ error: 'TMDB is not configured on the server' }, 503)
  const url = tmdbUpstream(params.path.join('/'), new URL(req.url).searchParams)
  if (!url) return json({ error: 'not allowed' }, 404)
  return relay(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
})
