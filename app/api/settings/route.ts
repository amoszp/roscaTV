import { json, readJson, withUser } from '@/lib/server/accounts'
import { store, StoreError } from '@/lib/server/store'

export const dynamic = 'force-dynamic'

export const PUT = withUser(async (req, user) => {
  try {
    return json({ settings: store().putSettings(user.id, await readJson(req)) })
  } catch (err) {
    if (err instanceof StoreError) return json({ error: err.message }, 400)
    throw err
  }
})
