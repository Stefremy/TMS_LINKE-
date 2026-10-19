const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLParser } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')

function load(fetch) {
  return createLoader({ 'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
    'fast-xml-parser': { XMLParser }, fetch })('app/api/news/route.ts')
}
const request = category => ({ url: `http://localhost/api/news?category=${encodeURIComponent(category)}` })
const item = (id, extra = '') => `<item><title>Notícia ${id} - Jornal</title><source url="https://example.com">Jornal</source><link>https://example.com/news/${id}</link><guid isPermaLink="false">news-${id}</guid><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate>${extra}</item>`
const rss = items => `<rss version="2.0"><channel>${items}</channel></rss>`
const success = xml => ({ ok: true, text: async () => xml })

test('the markets feed requests stocks, ETFs and financial markets, preserving logistics as a separate category', async () => {
  const urls = []
  const api = load(async url => { urls.push(new URL(url)); return success(rss(item(1))) })
  const result = await api.GET(request('mercados'))
  assert.equal(result.status, 200)
  assert.equal(result.body.items[0].title, 'Notícia 1')
  assert.equal(result.body.items[0].source, 'Jornal')
  assert.equal(result.body.items[0].id, 'news-1')
  assert.match(urls[0].searchParams.get('q'), /ETF/)
  assert.match(urls[0].searchParams.get('q'), /mercados financeiros/)
  await api.GET(request('geral'))
  assert.match(urls[1].searchParams.get('q'), /logistica/)
})

test('a failed feed returns an explicit error with no invented headlines', async () => {
  const api = load(async () => { throw new Error('offline') })
  const result = await api.GET(request('mercados'))
  assert.equal(result.status, 503)
  assert.deepEqual(result.body.items, [])
  assert.match(result.body.error, /Não foi possível/)
})

test('Portugal uses the national headlines feed for the Portuguese edition, separate from logistics', async () => {
  const urls = []
  const api = load(async url => { urls.push(new URL(url)); return success(rss(item(1))) })
  const result = await api.GET(request('portugal'))
  assert.equal(result.status, 200)
  assert.equal(urls[0].pathname, '/rss/headlines/section/topic/NATION')
  assert.equal(urls[0].searchParams.get('hl'), 'pt-PT')
  assert.equal(urls[0].searchParams.get('gl'), 'PT')
  assert.equal(urls[0].searchParams.get('ceid'), 'PT:pt-150')
  await api.GET(request('geral'))
  assert.equal(urls[1].pathname, '/rss/search')
})

test('cached and stale headlines always belong to their original category', async () => {
  const originalNow = Date.now
  let now = originalNow(), online = true, calls = 0
  Date.now = () => now
  try {
    const api = load(async () => { calls++; if (!online) throw new Error('offline'); return success(rss(item(42))) })
    const first = await api.GET(request('mercados'))
    const cached = await api.GET(request('mercados'))
    assert.equal(cached.body.cached, true)
    assert.equal(calls, 1)
    online = false; now += 4 * 60 * 60 * 1000
    const stale = await api.GET(request('mercados'))
    assert.equal(stale.body.stale, true)
    assert.equal(stale.body.fetchedAt, first.body.fetchedAt)
    assert.equal(stale.body.items[0].id, 'news-42')
    const other = await api.GET(request('ctt'))
    assert.equal(other.status, 503)
    assert.deepEqual(other.body.items, [])
  } finally { Date.now = originalNow }
})

test('unknown categories share a bounded default cache instead of creating arbitrary cache keys', async () => {
  let calls = 0
  const api = load(async () => { calls++; return success(rss(item(1))) })
  await api.GET(request('unrecognized-one'))
  const second = await api.GET(request('unrecognized-two'))
  assert.equal(calls, 1)
  assert.equal(second.body.cached, true)
})

test('invalid links and duplicate feed items are removed, without fabricating publication dates', async () => {
  const noDate = '<item><title>Sem data</title><link>https://example.com/no-date</link><pubDate>invalid</pubDate></item>'
  const badLink = '<item><title>Invalid</title><link>javascript:alert(1)</link></item>'
  const api = load(async () => success(rss(item(1) + item(1) + noDate + badLink)))
  const result = await api.GET(request('mercados'))
  assert.equal(result.body.items.length, 2)
  const unknown = result.body.items.find(row => row.title === 'Sem data')
  assert.equal(unknown.pubDate, '')
  assert.equal(unknown.timeAgo, 'Data indisponível')
})

test('invalid upstream content and genuine empty feeds remain distinguishable', async () => {
  const invalid = await load(async () => success('<html>Unavailable</html>')).GET(request('mercados'))
  assert.equal(invalid.status, 503)
  const empty = await load(async () => success(rss(''))).GET(request('mercados'))
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.body.items, [])
})

test('relative ages are recalculated when cached items are served', async () => {
  const originalNow = Date.now
  let now = Date.parse('2026-10-19T11:00:00Z')
  Date.now = () => now
  try {
    const api = load(async () => success(rss(item(1))))
    const first = await api.GET(request('mercados'))
    assert.equal(first.body.items[0].timeAgo, 'há 1h')
    now += 3600000
    const later = await api.GET(request('mercados'))
    assert.equal(later.body.items[0].timeAgo, 'há 2h')
    assert.equal(later.body.cached, true)
  } finally { Date.now = originalNow }
})
