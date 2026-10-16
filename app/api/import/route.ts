import { json, readJson, withUser } from '@/lib/server/accounts'
import { store, StoreError } from '@/lib/server/store'

export const dynamic = 'force-dynamic'

/** The library this browser kept before accounts, copied once into an empty account. */
export const POST = withUser(async (req, user) => {
  try {
    const imported = store().importState(user.id, await readJson(req))
    return json({ imported, ...store().getState(user.id) })
  } catch (err) {
    if (err instanceof StoreError) return json({ error: err.message }, 400)
    throw err
  }
})
