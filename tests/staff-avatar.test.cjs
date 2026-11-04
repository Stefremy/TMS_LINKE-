const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const tenant = '11111111-1111-1111-1111-111111111111'
const ownerEmail = 'owner@example.test'
const profile = { id: 'staff', code: 'COL-1', name: 'Equipa', email: 'staff@example.test', role: 'Operações', department: 'Operações', access_level: 'Operacional', permissions: ['Emissão e Controlo de Guias CTT'], status: 'Ativo', avatar_color: '#2563eb', avatar: 'https://example.test/previous.png' }
const png = () => new File([Uint8Array.from([137,80,78,71,13,10,26,10,0])], 'photo.png', { type: 'image/png' })
const photoForm = file => { const form = new FormData(); form.set('avatar', file); return form }

function harness({ role = 'admin', target = profile, foreign = false, uploadFailure = false, auditFailure = false } = {}) {
  const db = fakeSupabase({ audit_log: [], colaboradores: [], user_profiles: [] }, query => auditFailure && query.write?.table === 'audit_log' ? { code: 'fixture' } : null)
  const uploads = [], removals = [], authUpdates = []
  let clients = 0
  const user = { id: 'target-user', email: target.email, user_metadata: { name: 'Keep name', avatar: target.avatar }, app_metadata: { tenant_id: foreign ? 'foreign' : tenant, role: target.access_level === 'Administrador' ? 'admin' : 'employee', colaborador_id: target.id, sentinel: 'preserved' } }
  db.client.storage = { from(bucket) {
    assert.equal(bucket, 'avatars')
    return {
      async upload(path, bytes, options) { uploads.push({ path, bytes, options }); return { error: uploadFailure ? { message: 'private storage error' } : null } },
      getPublicUrl(path) { return { data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/avatars/${path}` } } },
      async remove(paths) { removals.push(...paths); return { error: null } },
    }
  } }
  db.client.rpc = async () => ({ data: { colaboradores: false, user_profiles: false }, error: null })
  db.client.auth = { admin: { async updateUserById(id, values) { authUpdates.push({ id, values }); return { error: null } } } }
  const load = createLoader({
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createAdminClient: () => { clients++; return db.client } },
    '@/lib/auth/context': {
      requireAdmin: async () => { if (role !== 'admin') throw new Error('Acesso restrito'); return { tenant_id: tenant, role, user: { id: 'actor', email: 'admin@example.test' }, colaborador_id: 'actor' } },
      requireEmployee: async () => ({ tenant_id: tenant, role: 'admin' }),
    },
    '@/lib/auth/staff-directory': { OWNER_EMAIL: ownerEmail, staffEmail: value => value?.trim().toLowerCase() || '', listStaffAuthUsers: async () => [user], loadStaffDirectory: async () => [target] },
  })
  return { action: load('app/actions/colaboradores.ts').saveColaboradorAction, db, uploads, removals, authUpdates, get clients() { return clients } }
}

test('ordinary users and clients cannot upload or change another account photo', async () => {
  for (const role of ['employee', 'client', null]) {
    const h = harness({ role })
    await assert.rejects(h.action(profile, photoForm(png())), /Acesso restrito/)
    assert.equal(h.clients, 0)
    assert.equal(h.uploads.length, 0)
  }
})

test('administrator can attach a Storage photo to a collaborator or the protected principal account', async () => {
  for (const target of [profile, { ...profile, id: 'principal', email: ownerEmail, access_level: 'Administrador' }]) {
    const h = harness({ target })
    const result = await h.action(target, photoForm(png()))
    assert.equal(result.success, true)
    assert.match(result.colaborador.avatar, /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/avatars\//)
    assert.ok(h.uploads[0].path.startsWith(`${tenant}/staff/${target.id}/`))
    assert.equal(h.uploads[0].options.upsert, false)
    assert.equal(h.authUpdates[0].values.user_metadata.avatar, result.colaborador.avatar)
    assert.equal(h.authUpdates[0].values.user_metadata.name, 'Keep name')
    assert.equal(h.authUpdates[0].values.app_metadata.sentinel, 'preserved')
    assert.equal(h.authUpdates[0].values.app_metadata.role, target.access_level === 'Administrador' ? 'admin' : 'employee')
    const saved = h.db.writes.find(write => write.table === 'audit_log').value.details
    assert.equal(saved.avatar, result.colaborador.avatar)
    assert.ok(saved.avatar.length < 500)
    assert.equal(saved.avatar_color, target.avatar_color)
  }
})

test('invalid or foreign targets are rejected before uploading images', async () => {
  for (const [options, input] of [[{}, { ...profile, id: 'foreign-id' }], [{ foreign: true }, profile]]) {
    const h = harness(options)
    await assert.rejects(h.action(input, photoForm(png())), /empresa/)
    assert.equal(h.uploads.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('file size, MIME and signature are validated on the server before upload or profile writes', async () => {
  for (const file of [
    new File(['<svg/>'], 'file.svg', { type: 'image/svg+xml' }),
    new File(['not a photo'], 'file.png', { type: 'image/png' }),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'file.png', { type: 'image/png' }),
  ]) {
    const h = harness()
    await assert.rejects(h.action(profile, photoForm(file)), /imagem|fotografia|ficheiro/i)
    assert.equal(h.uploads.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('removing the photo persists an explicit empty value so legacy audit replay cannot restore it', async () => {
  const h = harness()
  const result = await h.action({ ...profile, avatar: '' })
  assert.equal(result.colaborador.avatar, '')
  assert.equal(h.db.writes.find(write => write.table === 'audit_log').value.details.avatar, '')
  assert.equal(h.authUpdates[0].values.user_metadata.avatar, null)
  assert.equal(h.uploads.length, 0)
})

test('failed upload cannot save a broken URL and failed profile persistence cleans up only the new object', async () => {
  const upload = harness({ uploadFailure: true })
  await assert.rejects(upload.action(profile, photoForm(png())), /carregar a fotografia/)
  assert.equal(upload.db.writes.length, 0)
  const audit = harness({ auditFailure: true })
  await assert.rejects(audit.action(profile, photoForm(png())), /guardar os acessos/)
  assert.deepEqual(audit.removals, [audit.uploads[0].path])
  assert.equal(audit.authUpdates.length, 0)
})

test('saving other fields preserves the current avatar without uploading or rewriting Auth photo metadata', async () => {
  const h = harness()
  const input = { ...profile }
  delete input.avatar
  const result = await h.action({ ...input, name: 'Updated name' })
  assert.equal(result.colaborador.avatar, profile.avatar)
  assert.equal(h.uploads.length, 0)
  assert.equal(h.authUpdates[0].values.user_metadata, undefined)
})
