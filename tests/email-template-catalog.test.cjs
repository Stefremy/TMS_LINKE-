const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

function harness(role = 'admin', rows = [], failure) {
  const db = fakeSupabase({ email_templates: rows }, failure)
  const load = createLoader({
    '@/lib/auth/context': { requireEmployee: async () => { if (!role) throw Error('AUTH'); return { role } } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
  })
  return { db, load, ...load('app/actions/templates.ts') }
}

test('catalog lists every delivery model without seed data and renders code templates with fictional samples', async () => {
  const h = harness(), templates = await h.getEmailTemplates()
  assert.equal(templates.length, 12)
  for (const id of ['pickup_scheduled','pickup_confirmed','low_balance','tracking','in_transit','incident','quotation_tracking','client_invitation','client_recovery','billing_invoice','period_statement','mail_composer']) {
    const row = templates.find(t => t.id === id)
    assert.ok(row?.html_content, id)
  }
  const pickup = templates.find(t => t.id === 'pickup_confirmed')
  assert.match(pickup.html_content, /Estado do pedido:<\/strong> Efetuado/)
  assert.equal(pickup.sender, 'notificacoes@linke.pt')
  assert.equal(pickup.readonly, true)
  for (const id of ['client_invitation','client_recovery']) {
    assert.match(templates.find(t => t.id === id).html_content, /example.invalid/)
    assert.doesNotMatch(templates.find(t => t.id === id).html_content, /token_hash=/)
  }
})

test('saved edits survive catalog merge while code-defined previews always match delivery', async () => {
  const h = harness('admin', [
    { id: 'tracking', name: 'Custom tracking', html_content: '<p>Saved tracking</p>' },
    { id: 'pickup_confirmed', html_content: '<p>Stale DB copy never used by delivery</p>' },
    { id: 'legacy_custom', name: 'Old custom template', html_content: '<p>Old</p>' },
  ])
  const rows = await h.getEmailTemplates()
  assert.equal(rows.find(t => t.id === 'tracking').html_content, '<p>Saved tracking</p>')
  assert.doesNotMatch(rows.find(t => t.id === 'pickup_confirmed').html_content, /Stale DB/)
  assert.equal(rows.find(t => t.id === 'legacy_custom').readonly, true)
})

test('template reads and writes require admin before obtaining privileged DB access', async () => {
  for (const role of [null, 'client', 'employee']) {
    const h = harness(role)
    await assert.rejects(h.getEmailTemplates())
    await assert.rejects(h.updateEmailTemplate('tracking', '<p>Denied</p>'))
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.db.adminClients, 0)
  }
})

test('save inserts absent editable templates and rejects code-managed or empty templates', async () => {
  const h = harness()
  assert.equal((await h.updateEmailTemplate('tracking', '<p>Saved</p>')).success, true)
  assert.equal(h.db.writes[0].kind, 'upsert')
  assert.equal(h.db.writes[0].value.id, 'tracking')
  for (const [id, html] of [['pickup_confirmed','<p>Denied</p>'],['unknown','x'],['tracking',''],['tracking','x'.repeat(200001)]]) {
    assert.equal((await h.updateEmailTemplate(id, html)).success, false)
  }
  assert.equal(h.db.writes.length, 1)
})

test('saved pickup and low-balance edits are used with safe built-in fallback', async () => {
  const h = harness('admin', [{id:'pickup_scheduled',html_content:'<p>Saved pickup</p>'}])
  const {storedEmailTemplate} = h.load('lib/email/stored-template.ts')
  assert.equal(await storedEmailTemplate(h.db.client,'pickup_scheduled'), '<p>Saved pickup</p>')
  assert.match(await storedEmailTemplate(h.db.client,'low_balance'), /{{current_balance}}/)
  const broken = harness('admin', [], () => ({message:'Fixture failure'}))
  assert.match(await storedEmailTemplate(broken.db.client,'pickup_scheduled'), /{{date}}/)
})

test('preview frames are sandboxed and Resend credential never enters rendered input', () => {
  const ui = fs.readFileSync('app/ops/configuracao/notificacoes/TemplatesClient.tsx','utf8')
  assert.equal((ui.match(/sandbox=""/g)||[]).length, 2)
  assert.match(ui, /<button\s+onClick={onPreview}/)
  assert.match(ui, /!template.readonly && <button\s+onClick={onEdit}/)
  const page = fs.readFileSync('app/ops/configuracao/notificacoes/page.tsx','utf8')
  assert.doesNotMatch(page, /value={resendKey/)
})
