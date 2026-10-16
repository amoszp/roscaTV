import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Store, StoreError } from './store'

const ME = 1
const OTHER = 2

const item = (id: number, extra: Record<string, unknown> = {}) => ({
  id, mediaType: 'tv', type: 'series', title: `Show ${id}`, year: '2024', poster: null, tmdbRating: '8.1',
  status: 'watching', seasonData: { '1': { episodes: { '1': true } } }, notes: '', addedAt: 1, updatedAt: 2, ...extra,
})
const settings = { region: 'ES', sortKey: 'status', language: 'es' }

test('items are kept whole, per user', () => {
  const store = new Store(':memory:')
  store.putItem(ME, item(10, { keepWatching: true, imdbRating: '8.4' }))
  store.putItem(OTHER, item(11))
  const mine = store.getState(ME).library
  assert.deepEqual(Object.keys(mine), ['10'])
  assert.equal(mine[10].keepWatching, true)
  assert.equal(mine[10].imdbRating, '8.4')
  assert.deepEqual(mine[10].seasonData, { '1': { episodes: { '1': true } } })
})

test('saving again replaces the item; delete removes only mine', () => {
  const store = new Store(':memory:')
  store.putItem(ME, item(10))
  store.putItem(ME, item(10, { status: 'watched', title: 'Renamed' }))
  store.putItem(OTHER, item(10))
  assert.equal(store.getState(ME).library[10].status, 'watched')
  assert.equal(store.deleteItem(ME, 10), true)
  assert.deepEqual(store.getState(ME).library, {})
  assert.ok(store.getState(OTHER).library[10])
})

test('bad items and settings are refused', () => {
  const store = new Store(':memory:')
  assert.throws(() => store.putItem(ME, { ...item(10), id: -1 }), StoreError)
  assert.throws(() => store.putItem(ME, { ...item(10), title: '' }), StoreError)
  assert.throws(() => store.putItem(ME, { ...item(10), type: 'books' }), StoreError)
  assert.throws(() => store.putItem(ME, { ...item(10), status: 'maybe' }), StoreError)
  assert.throws(() => store.putSettings(ME, { ...settings, language: 'fr' }), StoreError)
  assert.throws(() => store.putSettings(ME, { ...settings, region: 'spain' }), StoreError)
})

test('settings round-trip; only known fields are kept', () => {
  const store = new Store(':memory:')
  assert.equal(store.getState(ME).settings, null)
  store.putSettings(ME, { ...settings, extra: 'x' })
  assert.deepEqual(store.getState(ME).settings, settings)
})

test('import fills an empty account once, skipping invalid items', () => {
  const store = new Store(':memory:')
  const library = { 10: item(10), 11: item(11), 12: { id: 12 } }
  assert.equal(store.importState(ME, { library, settings }), 2)
  assert.deepEqual(Object.keys(store.getState(ME).library).sort(), ['10', '11'])
  assert.deepEqual(store.getState(ME).settings, settings)
  // A second import (another device) never overwrites.
  assert.equal(store.importState(ME, { library: { 20: item(20) } }), 0)
  assert.equal(store.getState(ME).library[20], undefined)
})

test('an account that only has settings is not empty', () => {
  const store = new Store(':memory:')
  store.putSettings(ME, settings)
  assert.equal(store.importState(ME, { library: { 10: item(10) } }), 0)
})
