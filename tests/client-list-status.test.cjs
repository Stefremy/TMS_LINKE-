const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const load = createLoader({})
const { clientListStatus, matchesClientStatus } = load('lib/client-portal/list-status.ts')

test('suspended and blocked customers appear among inactive customers without changing their profile active flag', () => {
  for (const portal_access_status of ['suspended', 'blocked']) {
    const client = { is_active: true, portal_access_status }
    assert.equal(matchesClientStatus(client, 'Ativo'), false)
    assert.equal(matchesClientStatus(client, 'Inativo'), true)
    assert.equal(matchesClientStatus(client, 'Todos'), true)
    assert.equal(matchesClientStatus(client, clientListStatus(client)), true)
    assert.equal(client.is_active, true)
  }
  assert.equal(matchesClientStatus({is_active:false}, 'Inativo'), true)
  assert.equal(matchesClientStatus({is_active:true}, 'Ativo'), true)
  assert.equal(matchesClientStatus({is_active:true}, 'Inativo'), false)
})

test('operations status reads all audit pages, isolates tenant, and respects latest reactivation and block priority', async () => {
  const record = (id, client, details, date, tenant_id='tenant') => ({ id, tenant_id, action:'client_portal_access', created_at:date, details:{id:client,...details} })
  const logs = [
    record('new','reactivated',{suspended:false},'2026-10-30'),
    record('old','reactivated',{suspended:true},'2026-10-28'),
    record('b','blocked',{blocked:true,suspended:true},'2026-10-30'),
    record('foreign','outsider',{suspended:true},'2026-10-31','other'),
    ...Array.from({length:1001},(_,i)=>record(String(i).padStart(5,'0'),`client${i}`,{suspended:true},'2026-10-29')),
    record('last','older-customer',{suspended:true},'2026-10-20'),
  ]
  const db = fakeSupabase({audit_log:logs})
  const read = createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()}})('lib/client-portal/suspension.ts').readPortalAccessStatuses
  const result = await read('tenant')
  assert.equal(result.get('reactivated'), 'active')
  assert.equal(result.get('blocked'), 'blocked')
  assert.equal(result.get('older-customer'), 'suspended')
  assert.equal(result.has('outsider'), false)
  assert.equal(db.queries.length, 2)
})

test('failed access loading does not silently label restricted accounts as active', async () => {
  const db = fakeSupabase({},()=>({message:'unavailable'}))
  const read = createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()}})('lib/client-portal/suspension.ts').readPortalAccessStatuses
  await assert.rejects(read('tenant'), /Não foi possível verificar/)
})
