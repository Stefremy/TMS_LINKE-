const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const T = '11111111-1111-1111-1111-111111111111'
const types = createLoader({})('app/ops/configuracao/servicos/types.ts')

const TWELVE_CONTRACTED_BASE_TABLES = [
  { id: 'srv_linke_dd_std', code: 'LK-DD-STD', name: 'Linke Para Amanhã 24H (Guia DD)' },
  { id: 'srv_linke_db_std', code: 'LK-DB-STD', name: 'Linke Em 2 Dias 48H (Guia DB)' },
  { id: 'srv_linke_1793009571268', code: 'LK-EQ-VIP', name: 'CTT Expresso Económico 48 (Guia EQ)' },
  { id: 'srv_linke_multiplo_std', code: 'LK-MULT-STD', name: 'Linke 19 Múltiplo (10+ volumes)' },
  { id: 'srv_linke_europa_air', code: 'LK-EU-AIR', name: 'Linke EMS Internacional Aéreo (Guia EE)' },
  { id: 'srv_linke_ce_std', code: 'LK-CE-STD', name: 'Linke Europa Terrestre Económico (Guia CE)' },
  { id: 'srv_linke_cor_24', code: 'LK-COR-24', name: 'Linke Ibérico 24H (Correos Paq 24)' },
  { id: 'srv_linke_cor_48', code: 'LK-COR-48', name: 'Linke Ibérico 48H (Correos Paq 48)' },
  { id: 'srv_linke_cor_ecom', code: 'LK-COR-ECOM', name: 'Linke e-Paq 24 B2C (Correos Express)' },
  { id: 'srv_linke_cor_islas', code: 'LK-COR-ISLAS', name: 'Linke Ilhas Espanholas (Correos Express)' },
  { id: 'srv_linke_cor_intl', code: 'LK-COR-INTL', name: 'Linke Internacional Expresso (Correos Express)' },
  { id: '26179d74-c276-4500-8df6-386f76c53503', code: 'LK-COR-ECOM', name: 'Linke Correos E-Commerce' },
]

const AUTHORIZED_EMAILS = ['stefano.remy@gmail.com', 'geral@linke.pt']
const UNAUTHORIZED_STAFF = [
  { role: 'employee', email: 'clientes@linke.pt', colaborador_id: 'col-clientes-003' },
  { role: 'employee', email: 'aldara.linke@gmail.com', colaborador_id: 'col-aldara-004' },
  { role: 'admin', email: 'outro.admin@linke.pt', colaborador_id: 'col-outro-999' },
]

const fixture = {
  id: 'custom-a',
  code: 'LK-CUSTOM-A',
  name: 'Fixture table',
  is_active: true,
  is_primordial: false,
  category: 'Nacional',
  pricing_profile: 'Standard / Geral',
  global_markup_pct: 20,
  fuel_surcharge_pct: 12,
  zones: [
    {
      zone_code: 'PT-CONT',
      zone_name: 'Portugal',
      tiers: [
        {
          id: 'tier-a',
          weight_max: 1,
          cost_price: 10,
          sell_price: 12,
          margin_pct: 20,
          delivery_time: '48h',
          enabled: true,
        },
      ],
    },
  ],
}

function harness({
  service = fixture,
  auditOnly = false,
  failure,
  role = 'admin',
  email = 'stefano.remy@gmail.com',
  colaborador_id = 'col-stefano-001',
} = {}) {
  const tables = {
    servicos_linke: auditOnly ? [] : [service],
    audit_log: [
      {
        id: 'profile',
        tenant_id: T,
        action: 'servicos_linke_data',
        details: service,
      },
    ],
  }
  const db = fakeSupabase(tables, failure, { persistInserts: true })
  const ctx = { role, tenant_id: T, user: { email }, colaborador_id }
  const employee = async () => {
    if (!['admin', 'employee'].includes(role)) throw Error('Unauthorized')
    return ctx
  }
  const load = createLoader({
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    '@/lib/auth/context': {
      requireEmployee: employee,
      requireUser: async () => ctx,
      getTenantId: async () => T,
    },
    '@/app/actions/fornecedores': { getFornecedoresAction: async () => [] },
    '@/app/actions/ctt': { getCarrierConnectionsAction: async () => [] },
    '@/lib/services/geo/international-zones': {
      buildOfficialLinkeInternationalZones: () => [],
      buildOfficialCeTruckZones: () => [],
    },
  })
  return { actions: load('app/actions/servicos-linke.ts'), db, tables }
}

test('all 12 contracted base tables and built-in core IDs/codes remain protected even with a forged false flag or renamed service', () => {
  assert.equal(TWELVE_CONTRACTED_BASE_TABLES.length, 12)
  for (const base of TWELVE_CONTRACTED_BASE_TABLES) {
    assert.equal(
      types.isPrimordialServico({ ...base, code: 'FORGED-CODE', is_primordial: false }),
      true,
      `Expected ${base.name} (${base.id}) to be protected`
    )
  }
  for (const id of types.PRIMORDIAL_SERVICE_IDS) {
    assert.equal(types.isPrimordialServico({ id, name: 'Renamed', code: 'changed', is_primordial: false }), true)
  }
  for (const code of types.PRIMORDIAL_SERVICE_CODES) {
    assert.equal(types.isPrimordialServico({ id: 'other', code: ` ${code.toLowerCase()} `, is_primordial: false }), true)
  }
  assert.equal(types.isPrimordialServico(fixture), false)
})

test('only stefano.remy@gmail.com and geral@linke.pt are authorized to manage primordial base tables', () => {
  assert.equal(types.canManagePrimordialServices('stefano.remy@gmail.com'), true)
  assert.equal(types.canManagePrimordialServices('  STEFANO.REMY@GMAIL.COM '), true)
  assert.equal(types.canManagePrimordialServices({ email: 'geral@linke.pt' }), true)
  assert.equal(types.canManagePrimordialServices({ email: ' GERAL@LINKE.PT ' }), true)

  for (const denied of [
    'clientes@linke.pt',
    'aldara.linke@gmail.com',
    'stefano@linke.pt',
    'stefano.remy@gmail.com.evil.com',
    'evil+geral@linke.pt',
    '',
    null,
    undefined,
  ]) {
    assert.equal(types.canManagePrimordialServices(denied), false)
  }
})

for (const staff of UNAUTHORIZED_STAFF) {
  test(`unauthorized ${staff.role} (${staff.email}) cannot delete, edit, toggle, or re-margin any of the 12 contracted base tables`, async () => {
    for (const base of TWELVE_CONTRACTED_BASE_TABLES) {
      const storedBase = { ...fixture, ...base, is_primordial: true }
      const h = harness({ ...staff, service: storedBase })

      const delRes = await h.actions.deleteServicoLinkeAction(base.id)
      assert.equal(delRes.success, false)
      assert.match(delRes.error, /bloqueada/i)
      assert.equal(h.db.writes.length, 0)

      const editRes = await h.actions.saveServicoLinkeAction({
        ...storedBase,
        name: 'Tampered Name',
        code: 'TAMPERED-CODE',
        is_primordial: false,
      })
      assert.equal(editRes.success, false)
      assert.match(editRes.error, /bloqueada/i)
      assert.equal(h.db.writes.length, 0)

      const toggleRes = await h.actions.toggleServicoLinkeStatusAction(base.id, false)
      assert.equal(toggleRes.success, false)
      assert.equal(h.db.writes.length, 0)

      const markupRes = await h.actions.updateServicoMarkupAction(base.id, 35)
      assert.equal(markupRes.success, false)
      assert.equal(h.db.writes.length, 0)
    }
  })

  test(`unauthorized ${staff.role} (${staff.email}) cannot delete or edit audit-only or code-protected base tables, nor hijack primordial codes`, async () => {
    for (const auditOnly of [false, true]) {
      const hFlag = harness({ ...staff, auditOnly, service: { ...fixture, is_primordial: true } })
      assert.equal((await hFlag.actions.deleteServicoLinkeAction(fixture.id)).success, false)
      assert.equal((await hFlag.actions.saveServicoLinkeAction({ ...fixture, name: 'Edited', is_primordial: false })).success, false)
      assert.equal(hFlag.db.writes.length, 0)

      const hCode = harness({ ...staff, auditOnly, service: { ...fixture, code: 'LK-DD-STD', is_primordial: false } })
      assert.equal((await hCode.actions.deleteServicoLinkeAction(fixture.id)).success, false)
      assert.equal((await hCode.actions.saveServicoLinkeAction({ ...fixture, code: 'CUSTOM-RENAMED' })).success, false)
      assert.equal(hCode.db.writes.length, 0)
    }

    const hHijack = harness({ ...staff })
    assert.equal(
      (await hHijack.actions.saveServicoLinkeAction({ ...fixture, id: 'brand-new', code: 'LK-COR-ECOM' })).success,
      false
    )
    assert.equal(
      (await hHijack.actions.saveServicoLinkeAction({ ...fixture, id: 'brand-new', is_primordial: true })).success,
      false
    )
    assert.equal(hHijack.db.writes.length, 0)

    const dash = await hHijack.actions.getServicosDashboardDataAction()
    assert.equal(dash.canManageBaseTables, false)
  })
}

for (const email of AUTHORIZED_EMAILS) {
  const role = email.includes('stefano') ? 'admin' : 'employee'

  test(`authorized user (${email}) can edit, toggle, and update markup on contracted base tables, but cannot delete them`, async () => {
    for (const base of TWELVE_CONTRACTED_BASE_TABLES) {
      const storedBase = { ...fixture, ...base, is_primordial: true }

      const hSave = harness({ role, email, service: storedBase })
      const saved = await hSave.actions.saveServicoLinkeAction({
        ...storedBase,
        name: `${base.name} Editado`,
        is_primordial: false,
      })
      assert.equal(saved.success, true)
      assert.equal(saved.data.is_primordial, true)
      assert.equal(saved.data.name, `${base.name} Editado`)

      const hToggle = harness({ role, email, service: storedBase })
      assert.equal((await hToggle.actions.toggleServicoLinkeStatusAction(base.id, false)).success, true)

      const hMarkup = harness({ role, email, service: storedBase })
      assert.equal((await hMarkup.actions.updateServicoMarkupAction(base.id, 30)).success, true)

      const hDelete = harness({ role, email, service: storedBase })
      const del = await hDelete.actions.deleteServicoLinkeAction(base.id)
      assert.equal(del.success, false)
      assert.equal(hDelete.db.writes.length, 0)
      assert.equal((await hDelete.actions.getServicosLinkeAction()).some(s => s.id === base.id), true)
    }

    const dash = await harness({ role, email }).actions.getServicosDashboardDataAction()
    assert.equal(dash.canManageBaseTables, true)
  })
}

for (const auditOnly of [false, true]) {
  test(`flagged base tables cannot be deleted even by authorized managers in ${auditOnly ? 'audit fallback' : 'native storage'}`, async () => {
    const h = harness({ auditOnly, email: 'geral@linke.pt', role: 'employee', service: { ...fixture, is_primordial: true } })
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success, false)
    assert.equal(h.db.writes.length, 0)
    assert.equal((await h.actions.getServicosLinkeAction()).some(s => s.id === fixture.id), true)
  })
}

test('authorized editing of a protected service cannot clear its core flag', async () => {
  const h = harness({ auditOnly: true, email: 'stefano.remy@gmail.com', service: { ...fixture, is_primordial: true } })
  const saved = await h.actions.saveServicoLinkeAction({ ...fixture, name: 'New label', code: 'NEW-CODE', is_primordial: false })
  assert.equal(saved.success, true)
  assert.equal(saved.data.is_primordial, true)
  assert.equal(saved.data.name, 'New label')
  assert.equal(saved.data.zones[0].tiers[0].sell_price, 12)
  assert.equal(saved.data.zones[0].tiers[0].cost_price, 10)
  assert.equal(h.db.writes.find(w => w.kind === 'upsert').value.is_primordial, true)
})

test('native schemas without the protection column still save prices and retain the marker in the audit snapshot', async () => {
  const h = harness({
    email: 'geral@linke.pt',
    role: 'employee',
    failure: q =>
      q.table === 'servicos_linke' && q.write?.kind === 'upsert' && 'is_primordial' in q.write.value
        ? { code: 'PGRST204', message: "Could not find the 'is_primordial' column" }
        : null,
  })
  const result = await h.actions.saveServicoLinkeAction({ ...fixture, id: 'srv_linke_dd_std', is_primordial: false })
  assert.equal(result.success, true)
  assert.equal(result.data.is_primordial, true)
  assert.equal(h.db.writes.find(w => w.kind === 'upsert').value.zones[0].tiers[0].sell_price, 12)
  assert.equal(
    h.db.writes.find(w => w.kind === 'insert' && w.value.action === 'servicos_linke_data').value.details.is_primordial,
    true
  )
})

test('lookup failures refuse mutation and deletion before any database write', async () => {
  for (const table of ['servicos_linke', 'audit_log']) {
    const h = harness({
      email: 'clientes@linke.pt',
      role: 'employee',
      failure: q => (q.table === table && !q.write ? { code: '08006', message: 'Connection unavailable' } : null),
    })
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success, false)
    assert.equal((await h.actions.saveServicoLinkeAction(fixture)).success, false)
    assert.equal(h.db.writes.length, 0)
  }
})

test('legacy missing native table or UUID mismatch still blocks base deletion for all staff including managers', async () => {
  for (const code of ['PGRST205', '22P02']) {
    for (const user of [
      { email: 'clientes@linke.pt', role: 'employee' },
      { email: 'stefano.remy@gmail.com', role: 'admin' },
      { email: 'geral@linke.pt', role: 'employee' },
    ]) {
      const denied = harness({
        auditOnly: true,
        ...user,
        service: { ...fixture, is_primordial: true },
        failure: q => (q.table === 'servicos_linke' ? { code } : null),
      })
      assert.equal((await denied.actions.deleteServicoLinkeAction(fixture.id)).success, false)
      assert.equal(denied.db.writes.length, 0)
    }
  }
})

test('default primordial base tables cannot be deleted even by authorized managers', async () => {
  const h = harness({ auditOnly: true, email: 'geral@linke.pt', role: 'employee' })
  const id = 'srv_linke_dd_std'
  assert.ok((await h.actions.getServicosLinkeAction()).some(s => s.id === id))
  assert.equal((await h.actions.deleteServicoLinkeAction(id)).success, false)
  assert.equal(h.db.writes.length, 0)
  assert.equal((await h.actions.getServicosLinkeAction()).some(s => s.id === id), true)
})

test('failure to persist deletion leaves the original table intact', async () => {
  for (const throws of [false, true]) {
    const h = harness({
      failure: q => {
        if (q.table !== 'audit_log' || q.write?.kind !== 'insert') return null
        if (throws) throw Error('Connection unavailable')
        return { code: '08006', message: 'Connection unavailable' }
      },
    })
    assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success, false)
    assert.equal(h.db.writes.length, 0)
    assert.ok((await h.actions.getServicosLinkeAction()).some(s => s.id === fixture.id))
  }
})

test('a tombstone keeps referenced native rows hidden when physical cleanup fails', async () => {
  const h = harness({ failure: q => (q.write?.kind === 'delete' ? { code: '23503', message: 'Referenced row' } : null) })
  assert.equal((await h.actions.deleteServicoLinkeAction(fixture.id)).success, true)
  assert.equal(h.tables.servicos_linke.length, 1)
  assert.equal((await h.actions.getServicosLinkeAction()).some(s => s.id === fixture.id), false)
})

test('non-manager staff can still create custom variants from base tables and manage custom tables', async () => {
  const hVariant = harness({
    email: 'clientes@linke.pt',
    role: 'employee',
    service: { ...fixture, id: 'srv_linke_dd_std', code: 'LK-DD-STD', is_primordial: true },
  })
  const variant = await hVariant.actions.duplicateServicoForClientAction(
    'srv_linke_dd_std',
    'Tabela Negociada Cliente',
    'Fixture Client'
  )
  assert.equal(variant.success, true)
  assert.equal(variant.data.is_primordial, false)
  assert.notEqual(variant.data.id, 'srv_linke_dd_std')
  assert.equal(types.isPrimordialServico(variant.data), false)
  // Variants copy the source sell/cost prices exactly (no automatic volume discount)
  const sourcePrices = fixture.zones.map(z => z.tiers.map(t => [t.cost_price, t.sell_price, t.margin_pct]))
  const variantPrices = variant.data.zones.map(z => z.tiers.map(t => [t.cost_price, t.sell_price, t.margin_pct]))
  assert.deepEqual(variantPrices, sourcePrices)
  // Isolation: the variant shares no objects or tier ids with its source table
  assert.notEqual(variant.data.zones, fixture.zones)
  assert.notEqual(variant.data.zones[0].tiers[0], fixture.zones[0].tiers[0])
  assert.notEqual(variant.data.zones[0].tiers[0].id, fixture.zones[0].tiers[0].id)
  variant.data.zones[0].tiers[0].sell_price = 999
  assert.notEqual(fixture.zones[0].tiers[0].sell_price, 999)

  const hCustom = harness({ email: 'aldara.linke@gmail.com', role: 'employee' })
  assert.equal((await hCustom.actions.saveServicoLinkeAction({ ...fixture, name: 'Updated Custom' })).success, true)
  assert.equal((await hCustom.actions.toggleServicoLinkeStatusAction(fixture.id, false)).success, true)
  assert.equal((await hCustom.actions.updateServicoMarkupAction(fixture.id, 28)).success, true)
  assert.equal((await hCustom.actions.deleteServicoLinkeAction(fixture.id)).success, true)
  assert.ok(hCustom.db.writes.some(w => w.table === 'servicos_linke' && w.kind === 'delete'))

  const missing = harness({ email: 'clientes@linke.pt', role: 'employee' })
  assert.equal((await missing.actions.deleteServicoLinkeAction('missing')).success, false)
  assert.equal(missing.db.writes.length, 0)

  const client = harness({ role: 'client', email: 'stefano.remy@gmail.com' })
  await assert.rejects(client.actions.deleteServicoLinkeAction(fixture.id), /Unauthorized/)
  await assert.rejects(client.actions.deleteServicoLinkeAction('srv_linke_dd_std'), /Unauthorized/)
  await assert.rejects(client.actions.saveServicoLinkeAction(fixture), /Unauthorized/)
  assert.equal(client.db.writes.length, 0)
})

test('catalogue UI locks base tables for non-authorized staff and keeps the delete button locked on base tables even for stefano.remy / geral@linke', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const load = createLoader({
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': require('lucide-react'),
  })
  const { TabelasLinkeTab } = load('app/ops/configuracao/servicos/components/TabelasLinkeTab.tsx')
  const render = (service, canManageBaseTables) =>
    renderToStaticMarkup(
      React.createElement(TabelasLinkeTab, {
        mode: 'linke_services',
        servicos: [service],
        ...(canManageBaseTables === undefined ? {} : { canManageBaseTables }),
      })
    )

  // 1. Default / unauthorized staff on all 12 base tables: locked badge, no edit/toggle/delete/markup controls
  for (const base of TWELVE_CONTRACTED_BASE_TABLES) {
    for (const flag of [undefined, false]) {
      const markup = render({ ...fixture, ...base, is_primordial: false }, flag)
      assert.match(markup, /Protegida · Bloqueada/)
      assert.doesNotMatch(markup, /Editar tabela/)
      assert.doesNotMatch(markup, /title="Eliminar Tabela"/)
      assert.doesNotMatch(markup, /Ajustar margem e recalcular preços/)
      assert.match(markup, /Criar variante/)
    }
  }

  // 2. Unauthorized staff on custom tables: edit, toggle, delete, and markup controls remain visible
  const customMarkup = render(fixture, false)
  assert.doesNotMatch(customMarkup, /Protegida · Bloqueada/)
  assert.match(customMarkup, /Editar tabela/)
  assert.match(customMarkup, /title="Eliminar Tabela"/)
  assert.match(customMarkup, /Ajustar margem e recalcular preços/)

  // 3. Authorized managers (canManageBaseTables=true) on base tables: edit/markup controls visible, delete button stays locked/disabled
  for (const base of TWELVE_CONTRACTED_BASE_TABLES) {
    const managerMarkup = render({ ...fixture, ...base, is_primordial: true }, true)
    assert.doesNotMatch(managerMarkup, /Protegida · Bloqueada/)
    assert.match(managerMarkup, /Editar tabela/)
    assert.doesNotMatch(managerMarkup, /title="Eliminar Tabela"/)
    assert.match(managerMarkup, /Eliminação bloqueada para tabela base/)
    assert.match(managerMarkup, /disabled=""/)
    assert.match(managerMarkup, /Ajustar margem e recalcular preços/)
  }
})

test('saving a visual tier order preserves storage indexes and round-trips the order metadata',async()=>{
 const original={...fixture,zones:[{...fixture.zones[0],tiers:[{...fixture.zones[0].tiers[0],id:'a',display_order:1},{...fixture.zones[0].tiers[0],id:'b',weight_max:5,display_order:0}]}]}
 const h=harness({service:original})
 const result=await h.actions.saveServicoLinkeAction(original)
 assert.equal(result.success,true,result.error)
 assert.deepEqual(result.data.zones[0].tiers.map(t=>[t.id,t.display_order]),[['a',1],['b',0]])
 const loaded=await h.actions.getServicosLinkeAction()
 assert.deepEqual(loaded.find(s=>s.id===original.id).zones[0].tiers.map(t=>[t.id,t.display_order]),[['a',1],['b',0]])
})
