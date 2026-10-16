import { json, withUser } from '@/lib/server/accounts'
import { store } from '@/lib/server/store'

export const dynamic = 'force-dynamic'

/** The whole library and settings of the signed-in user. */
export const GET = withUser((_req, user) => json(store().getState(user.id)))
