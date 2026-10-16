import type { Library, AppSettings, ExportData, LibraryItem } from './types'
import { api, ApiError, SERVER_SYNC, signalSignedOut } from './api'

const LS_LIB = 'rosca_lib'
const LS_SET = 'rosca_settings'
let dbp: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open('rosca-db', 3)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    }
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
  return dbp
}

async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => res(req.result as T)
    req.onerror   = () => rej(req.error)
  })
}
async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await getDB()
  return new Promise((res, rej) => {
    const req = key !== undefined
      ? db.transaction(store, 'readwrite').objectStore(store).put(value, key)
      : db.transaction(store, 'readwrite').objectStore(store).put(value)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}
async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await getDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}
async function idbClear(store: string): Promise<void> {
  const db = await getDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).clear()
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}
async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await getDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => res(req.result as T[])
    req.onerror   = () => rej(req.error)
  })
}

export async function loadLibrary(): Promise<Library> {
  try {
    const items = await idbGetAll<LibraryItem>('library')
    const lib: Library = {}
    for (const item of items) if (item && typeof item.id === 'number') lib[item.id] = item
    try {
      const lsLib: Library = JSON.parse(localStorage.getItem(LS_LIB) || '{}')
      for (const [k, v] of Object.entries(lsLib)) {
        const id = Number(k)
        if (!lib[id] && v) lib[id] = v as LibraryItem
      }
    } catch { /* ignore */ }
    return lib
  } catch {
    try { return JSON.parse(localStorage.getItem(LS_LIB) || '{}') } catch { return {} }
  }
}

function cleanItem(item: LibraryItem): LibraryItem {
  return { ...item, id: item.id, mediaType: item.mediaType || 'movie',
    type: item.type, title: item.title, year: item.year || '', poster: item.poster ?? null,
    tmdbRating: item.tmdbRating || '—', status: item.status ?? null,
    seasonData: item.seasonData ?? {}, notes: item.notes ?? '',
    addedAt: item.addedAt || Date.now(), updatedAt: item.updatedAt || Date.now() }
}

async function saveItemLocal(clean: LibraryItem): Promise<void> {
  try { await idbPut('library', clean) } catch { /* ignore */ }
  try {
    const lib: Library = JSON.parse(localStorage.getItem(LS_LIB) || '{}')
    lib[clean.id] = clean
    localStorage.setItem(LS_LIB, JSON.stringify(lib))
  } catch { /* ignore */ }
}

async function deleteItemLocal(id: number): Promise<void> {
  try { await idbDelete('library', id) } catch { /* ignore */ }
  try {
    const lib: Library = JSON.parse(localStorage.getItem(LS_LIB) || '{}')
    delete lib[id]; localStorage.setItem(LS_LIB, JSON.stringify(lib))
  } catch { /* ignore */ }
}

export async function saveItem(item: LibraryItem): Promise<void> {
  if (!item || typeof item.id !== 'number' || !item.title || !item.type) return
  const clean = cleanItem(item)
  await saveItemLocal(clean)
  if (SERVER_SYNC) enqueue({ op: 'put', item: clean })
}

export async function deleteItem(id: number): Promise<void> {
  await deleteItemLocal(id)
  if (SERVER_SYNC) enqueue({ op: 'delete', id })
}

const DEFAULT_SETTINGS: AppSettings = { region: 'ES', sortKey: 'status', language: 'es' }

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = await idbGet<AppSettings>('settings', 'cfg')
    // Merge over the defaults so settings saved before a field (e.g. language)
    // existed still come back with a valid value instead of undefined.
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) }
  } catch {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(LS_SET) || '{}') } }
    catch { return DEFAULT_SETTINGS }
  }
}
async function saveSettingsLocal(s: AppSettings): Promise<void> {
  try { await idbPut('settings', s, 'cfg') } catch { /* ignore */ }
  try { localStorage.setItem(LS_SET, JSON.stringify(s)) } catch { /* ignore */ }
}
export async function saveSettings(s: AppSettings): Promise<void> {
  await saveSettingsLocal(s)
  if (SERVER_SYNC) enqueue({ op: 'settings', settings: s })
}
export async function exportLibrary(): Promise<ExportData> {
  const library = await loadLibrary()
  return { version: 3, exportedAt: new Date().toISOString(), library }
}
export async function importLibrary(data: ExportData): Promise<number> {
  const lib = data.library ?? {}
  let count = 0
  for (const item of Object.values(lib))
    if (item && typeof (item as LibraryItem).id === 'number') { await saveItem(item as LibraryItem); count++ }
  return count
}

/* ─────────────────────────────────────────────────────────────────────────
   Server sync (builds with NEXT_PUBLIC_SERVER_SYNC=1)

   The server holds each user's library. This browser keeps a copy (the same
   IndexedDB + localStorage as before) so the app opens instantly and works
   offline. Every change is written to the copy at once and queued in an
   outbox, which is sent in order whenever the server can be reached. A pull
   replaces the copy with the server's version, but only once the outbox is
   empty, so a change made offline is never lost.
   ───────────────────────────────────────────────────────────────────────── */

type Op =
  | { op: 'put'; item: LibraryItem }
  | { op: 'delete'; id: number }
  | { op: 'settings'; settings: AppSettings }

const LS_OUTBOX = 'rosca_outbox'
const LS_OWNER = 'rosca_cache_owner'
const LS_BACKUP = 'rosca_lib_before_account'

function readOutbox(): Op[] {
  try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || '[]') } catch { return [] }
}
function writeOutbox(ops: Op[]): void {
  try { localStorage.setItem(LS_OUTBOX, JSON.stringify(ops)) } catch { /* ignore */ }
}

function enqueue(op: Op): void {
  // A newer save of the same item (or of settings) replaces the queued one.
  const ops = readOutbox().filter((o) =>
    op.op === 'settings' ? o.op !== 'settings'
      : !((o.op === 'put' && o.item.id === (op.op === 'put' ? op.item.id : op.id)) || (o.op === 'delete' && o.id === (op.op === 'put' ? op.item.id : op.id))))
  ops.push(op)
  writeOutbox(ops)
  void flushOutbox()
}

let flushing: Promise<boolean> | null = null

/** Sends queued changes in order. True when nothing is left to send. */
export function flushOutbox(): Promise<boolean> {
  if (!flushing) {
    flushing = (async () => {
      for (;;) {
        const ops = readOutbox()
        if (!ops.length) return true
        const op = ops[0]
        try {
          if (op.op === 'put') await api.put(`/api/library/${op.item.id}`, op.item)
          else if (op.op === 'delete') await api.del(`/api/library/${op.id}`)
          else await api.put('/api/settings', op.settings)
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0
          if (status === 401) { signalSignedOut(); return false }
          // Offline or the server is busy: keep it for the next try.
          if (status === 0 || status >= 500) return false
          // Rejected (400): it will never succeed, so drop it.
        }
        writeOutbox(readOutbox().slice(1))
      }
    })().finally(() => { flushing = null })
  }
  return flushing
}

async function replaceCache(library: Library, settings: AppSettings | null): Promise<void> {
  try {
    await idbClear('library')
    for (const item of Object.values(library)) await idbPut('library', item)
  } catch { /* ignore */ }
  try { localStorage.setItem(LS_LIB, JSON.stringify(library)) } catch { /* ignore */ }
  if (settings) await saveSettingsLocal({ ...DEFAULT_SETTINGS, ...settings })
}

/**
 * Brings this browser's copy up to date with the server. Returns null when the
 * server can't be reached or local changes are still waiting to be sent; the
 * copy is then used as it is.
 */
export async function pullFromServer(): Promise<{ library: Library; settings: AppSettings } | null> {
  if (!(await flushOutbox())) return null
  try {
    const state = await api.get<{ library: Library; settings: AppSettings | null }>('/api/library')
    if (readOutbox().length) return null
    await replaceCache(state.library, state.settings)
    return { library: state.library, settings: { ...DEFAULT_SETTINGS, ...(state.settings ?? (await loadSettings())) } }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) signalSignedOut()
    return null
  }
}

/** Whose library this browser's copy is: null for a copy from before accounts. */
export function cacheOwner(): number | null {
  const v = Number(localStorage.getItem(LS_OWNER))
  return Number.isInteger(v) && v > 0 ? v : null
}

/**
 * Called right after sign-in. A copy from before accounts is sent to the
 * server once (it only lands in an account that is still empty) and kept
 * aside as a backup; a copy belonging to another account is dropped.
 */
export async function adoptCacheFor(userId: number): Promise<void> {
  const owner = cacheOwner()
  if (owner === userId) return
  if (owner === null) {
    const library = await loadLibrary()
    if (Object.keys(library).length) {
      try { localStorage.setItem(LS_BACKUP, JSON.stringify(library)) } catch { /* ignore */ }
      const settings = await loadSettings()
      await api.post('/api/import', { library, settings })
    }
  } else {
    writeOutbox([])
    await replaceCache({}, null)
  }
  localStorage.setItem(LS_OWNER, String(userId))
}

/** Sign-out: send what's left, then forget this account's copy. */
export async function forgetLocalCopy(): Promise<void> {
  await flushOutbox()
  writeOutbox([])
  await replaceCache({}, null)
  try { localStorage.removeItem(LS_OWNER) } catch { /* ignore */ }
}
