import { test } from 'node:test'
import assert from 'node:assert/strict'
import { omdbUpstream, tmdbUpstream } from './media'

const q = (s: string) => new URLSearchParams(s)

test('the TMDB requests the app makes are let through', () => {
  assert.equal(
    tmdbUpstream('search/multi', q('query=naruto%20shippuden&include_adult=false&page=1')),
    'https://api.themoviedb.org/3/search/multi?query=naruto+shippuden&include_adult=false&page=1',
  )
  assert.equal(tmdbUpstream('tv/31910', q('')), 'https://api.themoviedb.org/3/tv/31910')
  assert.equal(tmdbUpstream('movie/603', q('')), 'https://api.themoviedb.org/3/movie/603')
  for (const sub of ['watch/providers', 'recommendations', 'external_ids']) {
    assert.ok(tmdbUpstream(`tv/31910/${sub}`, q('')), sub)
  }
  assert.ok(tmdbUpstream('configuration', q('')))
})

test('anything else is refused (no open relay)', () => {
  for (const p of ['account', 'authentication/token/new', 'tv/31910/account_states', 'movie/603/rating',
    'search/person', '../3/account', 'tv/abc', 'tv/1/season/1', 'list/1', '']) {
    assert.equal(tmdbUpstream(p, q('')), null, p)
  }
  assert.equal(tmdbUpstream('search/multi', q('query=x&api_key=steal')), null)
  assert.equal(tmdbUpstream('search/multi', q(`query=${'x'.repeat(201)}`)), null)
})

test('OMDb only takes an IMDb id', () => {
  assert.equal(omdbUpstream('tt0409591', 'k1'), 'https://www.omdbapi.com/?apikey=k1&i=tt0409591&plot=none')
  for (const id of [null, '', 'tt12', 'nm0000001', 'tt0409591&s=x', 'tt0409591/../']) {
    assert.equal(omdbUpstream(id, 'k1'), null, String(id))
  }
})
