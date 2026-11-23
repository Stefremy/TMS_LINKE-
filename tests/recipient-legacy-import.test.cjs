const test = require('node:test'), assert = require('node:assert/strict')
const path = require('node:path'), XLSX = require('xlsx')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const lib = createLoader({})('lib/recipients/legacy-import.ts')

const T = 'tenant-linke', OWN = 'client-encanto', OTHER = 'client-outro'
const row = (o = {}) => ({ 'Cód. Cliente': 'LK0006', Cliente: 'ENCANTO', Código: '', Nome: 'Ana Silva', Morada: 'Rua A 1', 'Código Postal': '4800-019', Localidade: 'Guimarães', País: 'Po', Estado: '', Telefone: 912345678, 'E-mail': '', 'Pessoa de Contacto': '', ...o })

test('old-platform values are normalized: country, phone, postal code, contact', () => {
  const [r] = lib.planRecipientImport([row({ País: 'pt', Telefone: ' 00351 912 345 678', 'Código Postal': '4800019', 'Pessoa de Contacto': 'Rui', Código: 7, 'E-mail': 'A@B.PT' })]).recipients
  assert.deepEqual(r, { name: 'Ana Silva', address: 'Rua A 1', postal_code: '4800-019', city: 'Guimarães', country: 'PT', phone: '+351912345678', email: 'a@b.pt', observations: 'Contacto: Rui', legacy_code: '7' })
  assert.equal(lib.normalizeRecipientCountry('lu'), 'LU'); assert.equal(lib.normalizeRecipientCountry('Po'), 'PT')
  assert.equal(lib.normalizeRecipientPostalCode('L-1234', 'LU'), 'L-1234')
})

test('repeated and incomplete rows are reported, not imported', () => {
  const plan = lib.planRecipientImport([row(), row({ Nome: ' ana  silva ', Morada: 'RUA A 1' }), row({ Morada: '' }), row({ Nome: 'Outra' })])
  assert.equal(plan.recipients.length, 2); assert.equal(plan.duplicates, 1)
  assert.deepEqual(plan.invalid, [{ row: 4, reason: 'Falta morada.' }]); assert.deepEqual(plan.fileClientCodes, ['LK0006'])
})

test('the real LK0006 export is read in full', { skip: !require('node:fs').existsSync(path.join(__dirname, '../public/Moradas Frequentes - LK0006 - ENCANTO PERFEITO - SANDRA TEIXEIRA (imported).xlsx')) }, () => {
  const wb = XLSX.readFile(path.join(__dirname, '../public/Moradas Frequentes - LK0006 - ENCANTO PERFEITO - SANDRA TEIXEIRA (imported).xlsx'))
  const plan = lib.planRecipientImport(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }))
  assert.equal(plan.recipients.length + plan.duplicates + plan.invalid.length, 7041)
  assert.equal(plan.invalid.length, 0); assert.ok(plan.recipients.length >= 6600)
  assert.ok(plan.recipients.every(r => /^[A-Z]{2}$/.test(r.country) && (!r.phone || /^\+?\d+$/.test(r.phone))))
})

function harness(role = 'client', clientId = OWN) {
  const profile = (id, code) => ({ id: `p-${id}`, tenant_id: T, action: 'client_data', created_at: '2026-01-01T00:00:00Z', details: { id, code, short_name: id } })
  const tables = { clients: [{ id: OWN, tenant_id: T, name: 'Encanto' }, { id: OTHER, tenant_id: T, name: 'Outro' }], audit_log: [profile(OWN, 'LK0006'), profile(OTHER, 'LK0009')] }
  const db = fakeSupabase(tables, null, { persistInserts: true })
  const api = createLoader({
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    '@/lib/auth/context': { async requireUser() { return { tenant_id: T, role, client_id: role === 'client' ? clientId : null } } },
    'next/cache': { revalidatePath() {} },
    '@/lib/services/geo/postal-code.service': { lookupPostalCode: () => null },
  })('app/actions/destinatarios.ts')
  const saved = (id) => tables.audit_log.filter(r => r.action === 'saved_recipient' && (!id || r.details.client_id === id))
  return { api, saved }
}

test('a client imports into its own agenda only, and re-importing skips what exists', async () => {
  const h = harness('client', OWN)
  const recipients = lib.planRecipientImport([row(), row({ Nome: 'Bruno' })]).recipients
  const first = await h.api.importDestinatariosAction(OTHER, recipients, ['LK0006'])
  assert.deepEqual(first, { success: true, imported: 2, skipped: 0 })
  assert.equal(h.saved(OWN).length, 2); assert.equal(h.saved(OTHER).length, 0, 'the client id in the request is ignored for client accounts')
  assert.equal(h.saved(OWN)[0].details.source, 'legacy_import')
  assert.deepEqual(await h.api.importDestinatariosAction(OWN, recipients, ['LK0006']), { success: true, imported: 0, skipped: 2 })
  const listed = await h.api.getDestinatariosAction()
  assert.equal(listed.length, 2); assert.ok(listed.every(d => d.is_saved && d.client_id === OWN))
})

test('a file from another old-platform client is refused, and oversized batches are rejected', async () => {
  const h = harness('employee')
  const recipients = lib.planRecipientImport([row()]).recipients
  const wrong = await h.api.importDestinatariosAction(OTHER, recipients, ['LK0006'])
  assert.equal(wrong.success, false); assert.match(wrong.error, /LK0006/)
  assert.equal(h.saved().length, 0)
  const big = Array.from({ length: lib.RECIPIENT_IMPORT_BATCH + 1 }, (_, i) => ({ ...recipients[0], name: `N${i}` }))
  assert.equal((await h.api.importDestinatariosAction(OWN, big, ['LK0006'])).success, false)
  assert.equal((await h.api.importDestinatariosAction(OWN, recipients, ['LK0006'])).imported, 1)
})
