const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

test('chat photos use the staff directory, isolate tenants and cache only the avatar projection', async () => {
  let reads = 0
  let avatar = 'https://example.com/current.png'
  const load = createLoader({
    '@/lib/supabase/server': { createAdminClient: () => ({}) },
    '@/lib/auth/staff-directory': {
      staffEmail: email => (email || '').toLowerCase(),
      listStaffAuthUsers: async () => [
        { id: 'a', email: 'A@example.com', app_metadata: { tenant_id: 'one', colaborador_id: 'staff-a' } },
        { id: 'b', email: 'b@example.com', app_metadata: { tenant_id: 'two' } },
        { id: 'client', email: 'client@example.com', app_metadata: { role: 'client' } },
      ],
      loadStaffDirectory: async () => {
        reads++
        return [{ id: 'staff-a', email: 'a@example.com', name: 'A', avatar, notes: 'Private' },
          { id: 'staff-b', email: 'b@example.com', name: 'B', avatar: 'https://example.com/other.png' }]
      },
    },
  })
  const { getChatStaffAvatars, getChatStaffMembers, invalidateChatAvatars } = load('lib/team-chat-avatars.ts')
  assert.deepEqual([...await getChatStaffAvatars('one')], [['a', avatar]])
  await getChatStaffAvatars('one')
  assert.equal(reads, 1)
  avatar = ''
  invalidateChatAvatars('one')
  assert.deepEqual([...await getChatStaffAvatars('one')], [['a', null]])
  assert.equal(reads, 2)
  for (const image of ['data:image/png;base64,aGVsbG8=', '/avatars/staff.png']) {
    avatar = image
    invalidateChatAvatars('one')
    assert.equal((await getChatStaffAvatars('one')).get('a'), image)
  }
  avatar = 'data:image/svg+xml;base64,aGVsbG8='
  invalidateChatAvatars('one')
  assert.equal((await getChatStaffAvatars('one')).get('a'), null)
  assert.deepEqual([...await getChatStaffAvatars('two')], [['b', 'https://example.com/other.png']])
})
