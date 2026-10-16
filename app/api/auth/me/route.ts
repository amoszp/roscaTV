import { json, withUser } from '@/lib/server/accounts'

export const dynamic = 'force-dynamic'

export const GET = withUser((_req, user) => json({ user }))
