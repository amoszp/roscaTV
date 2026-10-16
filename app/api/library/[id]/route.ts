import { json, readJson, withUser } from '@/lib/server/accounts'
import { store, StoreError } from '@/lib/server/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** Saves one item whole (adds it or replaces it). */
export const PUT = withUser<Ctx>(async (req, user, { params }) => {
  const item = await readJson(req)
  if (!item || Number(params.id) !== item.id) return json({ error: 'item id must match the address' }, 400)
  try {
    return json({ item: store().putItem(user.id, item) })
  } catch (err) {
    if (err instanceof StoreError) return json({ error: err.message }, 400)
    throw err
  }
})

export const DELETE = withUser<Ctx>((_req, user, { params }) => {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad id' }, 400)
  store().deleteItem(user.id, id)
  return json({ ok: true })
})
