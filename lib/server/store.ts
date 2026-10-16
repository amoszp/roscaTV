import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AppSettings, Library, LibraryItem } from '../types'

/*
 * Per-user library and settings in SQLite (Node's built-in node:sqlite).
 * Each library item is kept whole, as JSON, keyed by its TMDB id, so the app
 * keeps full control of the item's shape and new fields need no migration.
 *
 * node:sqlite is loaded with process.getBuiltinModule so the bundler never
 * tries to resolve it.
 */

type Sqlite = typeof import('node:sqlite')
type DatabaseSync = InstanceType<Sqlite['DatabaseSync']>

export class StoreError extends Error {}

const MAX_ITEM_BYTES = 200_000
const MAX_IMPORT_ITEMS = 20_000
const TYPES = ['movies', 'series', 'anime']
const MEDIA = ['movie', 'tv']
const STATUSES = ['pending', 'watching', 'watched', null]
const LANGS = ['en', 'es']

/** Checks the fields the app relies on; everything else is kept as sent. */
export function cleanItem(raw: unknown): LibraryItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StoreError('item must be an object')
  const item = raw as Record<string, unknown>
  if (typeof item.id !== 'number' || !Number.isInteger(item.id) || item.id <= 0) throw new StoreError('item id must be a positive integer')
  if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500) throw new StoreError('item title is required')
  if (typeof item.type !== 'string' || !TYPES.includes(item.type)) throw new StoreError('item type is invalid')
  if (item.mediaType !== undefined && !MEDIA.includes(item.mediaType as string)) throw new StoreError('item mediaType is invalid')
  if (item.status !== undefined && !STATUSES.includes(item.status as string | null)) throw new StoreError('item status is invalid')
  const clean = { ...item, mediaType: item.mediaType ?? 'movie', updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now() }
  if (JSON.stringify(clean).length > MAX_ITEM_BYTES) throw new StoreError('item is too large')
  return clean as unknown as LibraryItem
}

export function cleanSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new StoreError('settings must be an object')
  const s = raw as Record<string, unknown>
  if (typeof s.region !== 'string' || !/^[A-Z]{2}$/.test(s.region)) throw new StoreError('settings region is invalid')
  if (typeof s.sortKey !== 'string' || s.sortKey.length > 32) throw new StoreError('settings sortKey is invalid')
  if (typeof s.language !== 'string' || !LANGS.includes(s.language)) throw new StoreError('settings language is invalid')
  return { region: s.region, sortKey: s.sortKey as AppSettings['sortKey'], language: s.language as AppSettings['language'] }
}

export interface UserState {
  library: Library
  settings: AppSettings | null
}

export class Store {
  private db: DatabaseSync

  constructor(path: string) {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as Sqlite
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS items (
        user_id    INTEGER NOT NULL,
        id         INTEGER NOT NULL,
        data       TEXT    NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY,
        data    TEXT NOT NULL
      );
    `)
  }

  getState(userId: number): UserState {
    const library: Library = {}
    const rows = this.db.prepare('SELECT data FROM items WHERE user_id = ?').all(userId) as { data: string }[]
    for (const row of rows) {
      const item = JSON.parse(row.data) as LibraryItem
      library[item.id] = item
    }
    const s = this.db.prepare('SELECT data FROM settings WHERE user_id = ?').get(userId) as { data: string } | undefined
    return { library, settings: s ? (JSON.parse(s.data) as AppSettings) : null }
  }

  putItem(userId: number, raw: unknown): LibraryItem {
    const item = cleanItem(raw)
    this.db
      .prepare('INSERT INTO items (user_id, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
      .run(userId, item.id, JSON.stringify(item), item.updatedAt ?? Date.now())
    return item
  }

  deleteItem(userId: number, id: number): boolean {
    return Number(this.db.prepare('DELETE FROM items WHERE user_id = ? AND id = ?').run(userId, id).changes) > 0
  }

  putSettings(userId: number, raw: unknown): AppSettings {
    const settings = cleanSettings(raw)
    this.db
      .prepare('INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data')
      .run(userId, JSON.stringify(settings))
    return settings
  }

  /**
   * Copies a library kept in the browser into an account that has nothing yet.
   * An account that already has items or settings is left alone (returns 0),
   * so a second device can't overwrite it. Invalid items are skipped.
   */
  importState(userId: number, raw: unknown): number {
    const body = (raw && typeof raw === 'object' ? raw : {}) as { library?: unknown; settings?: unknown }
    const hasItems = this.db.prepare('SELECT 1 FROM items WHERE user_id = ? LIMIT 1').get(userId)
    const hasSettings = this.db.prepare('SELECT 1 FROM settings WHERE user_id = ?').get(userId)
    if (hasItems || hasSettings) return 0

    const items = body.library && typeof body.library === 'object' ? Object.values(body.library as object) : []
    if (items.length > MAX_IMPORT_ITEMS) throw new StoreError('too many items')
    let count = 0
    this.db.exec('BEGIN')
    try {
      for (const raw of items) {
        try {
          this.putItem(userId, raw)
          count++
        } catch (err) {
          if (!(err instanceof StoreError)) throw err
        }
      }
      if (body.settings) {
        try {
          this.putSettings(userId, body.settings)
        } catch (err) {
          if (!(err instanceof StoreError)) throw err
        }
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return count
  }
}

let shared: Store | null = null

/** The one store for this server process. */
export function store(): Store {
  if (!shared) shared = new Store(process.env.DB_PATH ?? './data/roscatv.db')
  return shared
}
