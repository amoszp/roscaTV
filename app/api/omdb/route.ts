import { json, withUser } from '@/lib/server/accounts'
import { omdbUpstream, relay } from '@/lib/server/media'

export const dynamic = 'force-dynamic'

/** OMDb ratings for signed-in users, with the server's key (see lib/server/media.ts). */
export const GET = withUser((req) => {
  const key = process.env.OMDB_KEY
  if (!key) return json({ error: 'OMDb is not configured on the server' }, 503)
  const url = omdbUpstream(new URL(req.url).searchParams.get('i'), key)
  if (!url) return json({ error: 'bad id' }, 400)
  return relay(url)
})
