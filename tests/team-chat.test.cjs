const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const T = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const member = (user_id, tenant_id = T) => ({ tenant_id, user_id, name: user_id[0], avatar_url: null })
const message = (sequence, sender_id, recipient_id, tenant_id = T) => ({ id: `message-${sequence}`, sequence, sender_id, recipient_id, tenant_id, body: `Text ${sequence}`, sender_name: 'Name', created_at: '2026-10-19T12:00:00Z' })

// In-memory database with the constraints/defaults used by the chat. No live messages.
function database(seed = {}, failure) {
  const tables = { team_chat_members: [member(A), member(B), member(C)], team_chat_messages: [], ...seed }
  const calls = []
  let clients = 0
  function from(table) {
    const state = { table, predicates: [], filters: [], take: Infinity }
    const q = {
      select() { return q },
      eq(field, value) { state.filters.push([field, value]); state.predicates.push(row => row[field] === value); return q },
      is(field, value) { return q.eq(field, value) },
      lt(field, value) { state.predicates.push(row => row[field] < value); return q },
      gt(field, value) { state.predicates.push(row => row[field] > value); return q },
      or(expression) {
        state.or = expression
        const groups = [...expression.matchAll(/and\(sender_id\.eq\.([\w-]+),recipient_id\.eq\.([\w-]+)\)/g)]
        assert.equal(groups.length, 2)
        state.predicates.push(row => groups.some(group => row.sender_id === group[1] && row.recipient_id === group[2]))
        return q
      },
      order(field, options) { state.order = { field, ascending: options?.ascending !== false }; return q },
      limit(n) { state.take = n; return q },
      maybeSingle() { state.single = true; return q }, single() { state.single = true; return q },
      upsert(value) { state.upsert = value; return q },
      insert(value) { state.insert = value; return q },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          calls.push(state)
          const error = failure?.(state)
          if (error) return { data: null, error }
          if (state.upsert) {
            const existing = tables[table].find(row => row.tenant_id === state.upsert.tenant_id && row.user_id === state.upsert.user_id)
            if (existing) Object.assign(existing, state.upsert)
            else tables[table].push(state.upsert)
            return { data: null, error: null }
          }
          if (state.insert) {
            if (tables[table].some(row => ['tenant_id', 'sender_id', 'client_message_id'].every(key => row[key] === state.insert[key]))) return { data: null, error: { code: '23505' } }
            const sequence = Math.max(0, ...tables[table].map(row => row.sequence)) + 1
            tables[table].push({ ...state.insert, id: `message-${sequence}`, sequence, created_at: '2026-10-19T12:00:00Z' })
            return { data: tables[table].at(-1), error: null }
          }
          let rows = tables[table].filter(row => state.predicates.every(predicate => predicate(row)))
          if (state.order) {
            const { field, ascending } = state.order
            rows = [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (ascending ? 1 : -1))
          }
          rows = rows.slice(0, state.take)
          return { data: structuredClone(state.single ? rows[0] || null : rows), error: null }
        }).then(resolve, reject)
      },
    }
    return q
  }
  return { tables, calls, get clients() { return clients }, createAdminClient() { clients++; return { from } } }
}

function setup({ role = 'employee', userId = A, tenant = T, seed, failure, anonymous = false } = {}) {
  const db = database(seed, failure)
  const context = anonymous ? null : { role, user: { id: userId, email: 'colleague@example.com', user_metadata: { name: 'Login Name' } }, tenant_id: tenant }
  const load = createLoader({
    'server-only': {},
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200, headers: init?.headers }) } },
    '@/lib/auth/context': { getAuthContext: async () => context },
    '@/lib/auth/profile': { getMyProfile: async () => ({ name: 'Actual Profile', avatar_url: 'https://example.com/photo.png' }) },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
  })
  return { db, context, service: load('lib/team-chat-server.ts'), api: load('app/api/ops/chat/route.ts'), shared: load('lib/team-chat.ts') }
}
function get(params = '') { return new Request(`https://ops.toke.pt/api/ops/chat${params}`) }
function post(input = {}, origin = 'https://ops.toke.pt') {
  return new Request('https://ops.toke.pt/api/ops/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({ viewerId: A, clientMessageId: requestId, body: 'Hello team', ...input }) })
}

test('anonymous users and client accounts cannot read or send chat messages', async () => {
  for (const options of [{ anonymous: true }, { role: 'client' }, { role: null }]) {
    const { api, db } = setup(options)
    assert.ok([401, 403].includes((await api.GET(get())).status))
    assert.ok([401, 403].includes((await api.POST(post())).status))
    assert.equal(db.clients, 0)
  }
})

test('general history excludes all DMs and other tenants', async () => {
  const { api, db } = setup({ seed: { team_chat_messages: [message(1, A, null), message(2, B, A), message(3, B, null, OTHER), message(4, B, C)] } })
  const response = await api.GET(get())
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.messages.map(row => row.sequence), [1])
  assert.match(response.headers['Cache-Control'], /no-store/)
  for (const query of db.calls) assert.ok(query.filters.some(([key, value]) => key === 'tenant_id' && value === T))
})

test('DM history contains only the two signed-in participants, even for administrators', async () => {
  for (const role of ['employee', 'admin']) {
    const { api } = setup({ role, seed: { team_chat_messages: [message(1, A, B), message(2, B, A), message(3, B, C), message(4, A, C), message(5, A, null), message(6, A, B, OTHER)] } })
    const response = await api.GET(get(`?recipient=${B}`))
    assert.deepEqual(response.body.messages.map(row => row.sequence), [1, 2])
  }
})

test('message identity and tenant come from the verified login, never from the request', async () => {
  const { api, db } = setup()
  const response = await api.POST(post({ sender_id: B, sender_name: 'Someone Else', tenant_id: OTHER }))
  assert.equal(response.status, 201)
  const row = db.tables.team_chat_messages[0]
  assert.equal(row.sender_id, A)
  assert.equal(row.tenant_id, T)
  assert.equal(row.sender_name, 'Actual Profile')
  assert.equal(row.sender_avatar_url, 'https://example.com/photo.png')
  assert.equal(row.recipient_id, null)
})

test('a retry after an ambiguous network failure returns the same persisted message', async () => {
  const { api, db } = setup()
  const first = await api.POST(post({ recipient: B }))
  const retry = await api.POST(post({ recipient: B }))
  assert.equal(first.body.message.id, retry.body.message.id)
  assert.equal(db.tables.team_chat_messages.length, 1)
  assert.equal((await api.POST(post({ body: 'Changed text', recipient: B }))).status, 409)
  assert.equal((await api.POST(post({ recipient: C }))).status, 409)
})

test('a changed login cannot reuse an old page to send or read as another user', async () => {
  const { api, db } = setup({ userId: B })
  assert.equal((await api.POST(post())).status, 409)
  assert.equal((await api.GET(get(`?viewer=${A}`))).status, 409)
  assert.equal(db.clients, 0)
})

test('private recipients must be registered in the same tenant and cannot be oneself', async () => {
  const { api, db } = setup({ seed: { team_chat_members: [member(A), member(B, OTHER)] } })
  assert.equal((await api.POST(post({ recipient: B }))).status, 404)
  assert.equal((await api.GET(get(`?recipient=${B}`))).status, 404)
  assert.equal((await api.POST(post({ recipient: A }))).status, 400)
  assert.equal(db.tables.team_chat_messages.length, 0)
})

test('empty, oversized, malformed and cross-origin requests do not send messages', async () => {
  const { api, db } = setup()
  for (const body of ['', '   ', 'x'.repeat(4001), 'hello\0world', 42]) assert.equal((await api.POST(post({ body }))).status, 400)
  assert.equal((await api.POST(post({ recipient: 'x),sender_id.neq.y' }))).status, 400)
  assert.equal((await api.POST(post({}, 'https://attacker.example'))).status, 403)
  const badJson = new Request('https://ops.toke.pt/api/ops/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
  assert.equal((await api.POST(badJson)).status, 400)
  assert.equal(db.tables.team_chat_messages.length, 0)
})

test('history pagination keeps chronological order and drains a large new-message backlog', async () => {
  const { api } = setup({ seed: { team_chat_messages: Array.from({ length: 126 }, (_, index) => message(index + 1, A, null)) } })
  const newest = (await api.GET(get())).body
  assert.equal(newest.hasMore, true)
  assert.deepEqual([newest.messages[0].sequence, newest.messages.at(-1).sequence], [77, 126])
  const older = (await api.GET(get('?before=77'))).body
  assert.deepEqual([older.messages[0].sequence, older.messages.at(-1).sequence], [27, 76])
  const after = (await api.GET(get('?after=20'))).body
  assert.equal(after.hasMore, true)
  assert.deepEqual([after.messages[0].sequence, after.messages.at(-1).sequence], [21, 70])
  assert.equal((await api.GET(get('?before=2&after=1'))).status, 400)
  assert.equal((await api.GET(get('?after=0'))).status, 400)
})

test('an unapplied migration returns a clear unavailable state rather than an empty history', async () => {
  const { api } = setup({ failure: () => ({ code: 'PGRST205' }) })
  const response = await api.GET(get())
  assert.equal(response.status, 503)
  assert.match(response.body.error, /migração team_chat/)
})

test('polling and send acknowledgements merge without duplicating or reordering messages', () => {
  const { shared } = setup()
  const merged = shared.mergeChatMessages([message(4, A, null), message(2, B, null)], [message(4, A, null), message(3, B, null)])
  assert.deepEqual(merged.map(row => row.sequence), [2, 3, 4])
})
