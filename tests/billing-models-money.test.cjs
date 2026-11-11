// Testes extensivos dos dois modelos de faturação. Aqui não podemos falhar com dinheiro.
//
//  - Pré-pagamento (pay_as_you_go): wallet = dinheiro carregado − envios. Descoberto máximo −2,00 €.
//  - Conta corrente: limite de faturação INTERNO (proteção contra calotes), nunca mostrado ao cliente.
//
// A lógica TypeScript corre a partir dos ficheiros reais; o SQL corre as migrações reais num
// PostgreSQL embutido (PGlite). Nada de mocks para as contas de dinheiro.
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const { createLoader } = require('./helpers/load-typescript.cjs')

const load = createLoader({})
const balance = load('lib/billing/client-balance.ts')
const limit = load('lib/billing/client-limit.ts')
const { reserveWallet } = load('lib/billing/wallet.ts')

const cents = n => Math.round(n * 100)
// Gerador determinístico: os testes "aleatórios" repetem sempre os mesmos casos.
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 } }
const money = r => Math.round(r() * 20000) / 100 // 0,00 € a 200,00 €

// ─────────────────────────── Regras puras: troca de modelo e wallet nova ───────────────────────────

describe('troca de modelo de faturação na ficha do cliente', () => {
  const cc = { billing_type: 'conta_corrente', category: 'Cliente Conta Corrente', credit_limit: 5000 }

  test('regressão 5001 €: passar de conta corrente a pré-pagamento começa a wallet a 0 €, nunca herda o limite', () => {
    const next = limit.switchBillingModel(cc, 'pay_as_you_go', cc)
    assert.equal(next.billing_type, 'pay_as_you_go')
    assert.equal(next.credit_limit, 0)
    assert.equal(next.category, 'Cliente Pré-Pagamento')
    // A seguir a um carregamento Stripe de 1 € o cliente tem 1 €, não 5001 €.
    assert.equal(limit.applyWalletInjection(next.credit_limit, 1), 1)
  })

  test('qualquer limite antigo (0, 15000, 2500, decimais) nunca passa a dinheiro', () => {
    for (const old of [0, 1, 2500, 5000, 15000, 99999.99]) {
      const start = { ...cc, credit_limit: old }
      assert.equal(limit.switchBillingModel(start, 'pay_as_you_go', start).credit_limit, 0, `limite ${old}`)
    }
  })

  test('desfazer a troca na mesma edição repõe o limite original de conta corrente', () => {
    const initial = { ...cc, credit_limit: 15000 }
    const prepaid = limit.switchBillingModel(initial, 'pay_as_you_go', initial)
    const back = limit.switchBillingModel(prepaid, 'conta_corrente', initial)
    assert.equal(back.billing_type, 'conta_corrente')
    assert.equal(back.credit_limit, 15000)
  })

  test('desfazer sem limite gravado repõe o valor por omissão de conta corrente', () => {
    const initial = { billing_type: 'conta_corrente' }
    const back = limit.switchBillingModel(limit.switchBillingModel(initial, 'pay_as_you_go', initial), 'conta_corrente', initial)
    assert.equal(back.credit_limit, limit.DEFAULT_CURRENT_ACCOUNT_LIMIT)
  })

  test('clicar no modelo que já está ativo não mexe no dinheiro', () => {
    const wallet = { billing_type: 'pay_as_you_go', credit_limit: 37.5 }
    assert.equal(limit.switchBillingModel(wallet, 'pay_as_you_go', wallet), wallet)
    assert.equal(limit.switchBillingModel(cc, 'conta_corrente', cc), cc)
  })

  test('um cliente que já era pré-pagamento e passa a conta corrente não perde o valor carregado no formulário', () => {
    const initial = { billing_type: 'pay_as_you_go', credit_limit: 40 }
    const back = limit.switchBillingModel(initial, 'conta_corrente', initial)
    assert.equal(back.credit_limit, 40)
  })

  test('valores por omissão: wallet nova começa a 0 €, conta corrente a 5000 € de limite interno', () => {
    assert.equal(limit.defaultCreditLimit('pay_as_you_go'), 0)
    assert.equal(limit.defaultCreditLimit('conta_corrente'), 5000)
    assert.equal(limit.defaultCreditLimit(undefined), 5000)
    assert.equal(limit.defaultCreditLimit(null), 5000)
  })
})

// ─────────────────────────── Injeção manual de saldo (emergências) ───────────────────────────

describe('injetar saldo', () => {
  test('aceita formatos portugueses e ingleses com até 2 casas decimais', () => {
    const ok = { '50': 50, '50,00': 50, '50.5': 50.5, '-10,25': -10.25, ' 7 ': 7, '0,01': 0.01, '-0.01': -0.01, '100000': 100000, '-100000': -100000 }
    for (const [raw, expected] of Object.entries(ok)) assert.equal(limit.parseWalletInjection(raw), expected, raw)
  })

  test('recusa tudo o que não é um valor monetário inequívoco', () => {
    const bad = ['', ' ', '0', '0,00', '-0', 'abc', '1e3', '1.005', '10,123', '1.000,00', '1,000.00', '€50', '50€', '+50', '--5',
      'Infinity', 'NaN', '100000,01', '-100000.01', '1234567', '5,', ',5', '.5', '0x10']
    for (const raw of bad) assert.equal(limit.parseWalletInjection(raw), null, JSON.stringify(raw))
  })

  test('somas em cêntimos exatos, sem erros de vírgula flutuante', () => {
    assert.equal(limit.applyWalletInjection(0.1, 0.2), 0.3)
    assert.equal(limit.applyWalletInjection(5001, -5000), 1)
    assert.equal(limit.applyWalletInjection(undefined, 12.34), 12.34)
    assert.equal(limit.applyWalletInjection(1.1, -1.1), 0)
    let total = 0
    for (let i = 0; i < 1000; i++) total = limit.applyWalletInjection(total, 0.01)
    assert.equal(total, 10)
  })

  test('aleatório: qualquer sequência de injeções válidas dá a soma exata em cêntimos', () => {
    const r = rng(42)
    for (let run = 0; run < 200; run++) {
      let total = 0, expectedCents = 0
      for (let i = 0; i < 25; i++) {
        const v = (r() < 0.3 ? -1 : 1) * Math.max(1, Math.round(r() * 50000)) / 100
        total = limit.applyWalletInjection(total, v); expectedCents += cents(v)
      }
      assert.equal(cents(total), expectedCents)
    }
  })

  test('pré-visualização: saldo atual vem da wallet real, ajuste pendente e saldo após gravar', () => {
    const initial = { billing_type: 'pay_as_you_go', credit_limit: 5001, available_credit: 4990.5 }
    // Correção do caso 5001 €: retirar 5000 deixa o saldo real menos o que já foi gasto.
    const p = limit.walletPreview(initial, 1)
    assert.deepEqual(p, { wasPrepaid: true, baseLoaded: 5001, currentBalance: 4990.5, pending: -5000, projected: -9.5 })
    assert.deepEqual(limit.walletPreview(initial, 5001), { wasPrepaid: true, baseLoaded: 5001, currentBalance: 4990.5, pending: 0, projected: 4990.5 })
  })

  test('pré-visualização de um cliente que acabou de passar a pré-pagamento parte de 0 €', () => {
    const initial = { billing_type: 'conta_corrente', credit_limit: 5000, available_credit: 3000 }
    assert.deepEqual(limit.walletPreview(initial, 0), { wasPrepaid: false, baseLoaded: 0, currentBalance: 0, pending: 0, projected: 0 })
    assert.deepEqual(limit.walletPreview(initial, 25), { wasPrepaid: false, baseLoaded: 0, currentBalance: 0, pending: 25, projected: 25 })
  })

  test('pré-visualização de cliente novo sem dados', () => {
    assert.deepEqual(limit.walletPreview(undefined, undefined), { wasPrepaid: false, baseLoaded: 0, currentBalance: 0, pending: 0, projected: 0 })
  })
})

// ─────────────────────────── Pré-pagamento: saldo e descoberto ───────────────────────────

describe('pré-pagamento: saldo da wallet', () => {
  const ship = (sell_price, extra = {}) => ({ sell_price, status: 'entregue', ...extra })

  test('descoberto de −2,00 € aplicado ao cêntimo', () => {
    assert.equal(balance.PAY_AS_YOU_GO_OVERDRAFT_LIMIT, -2)
    assert.equal(balance.payAsYouGoRefusal(1, 3), null)          // fica em −2,00 €
    assert.notEqual(balance.payAsYouGoRefusal(1, 3.01), null)    // ficaria em −2,01 €
    assert.equal(balance.payAsYouGoRefusal(0, 2), null)
    assert.notEqual(balance.payAsYouGoRefusal(0, 2.01), null)
    assert.equal(balance.payAsYouGoRefusal(-2, 0), null)
    assert.notEqual(balance.payAsYouGoRefusal(-2, 0.01), null)
    assert.notEqual(balance.payAsYouGoRefusal(-1.99, 0.02), null)
    assert.equal(balance.payAsYouGoRefusal(-1.99, 0.01), null)
  })

  test('arredondamentos de vírgula flutuante nunca deixam passar nem bloqueiam por engano', () => {
    assert.equal(balance.payAsYouGoRefusal(0.1 + 0.2, 2.3), null)  // 0,30 − 2,30 = −2,00 exato
    assert.equal(balance.payAsYouGoRefusal(1.1, 3.1), null)
    assert.notEqual(balance.payAsYouGoRefusal(1.1, 3.11), null)
  })

  test('aleatório: recusa se e só se o saldo final ficar abaixo de −2,00 €', () => {
    const r = rng(7)
    for (let i = 0; i < 5000; i++) {
      const bal = Math.round((r() * 40 - 10) * 100) / 100
      const cost = money(r)
      const allowed = cents(bal) - cents(cost) >= -200
      assert.equal(balance.payAsYouGoRefusal(bal, cost) === null, allowed, `saldo ${bal} custo ${cost}`)
    }
  })

  test('mensagem de recusa diz ao cliente o custo, o saldo e o limite', () => {
    const msg = balance.payAsYouGoRefusal(1.5, 10)
    assert.match(msg, /Saldo Insuficiente/); assert.match(msg, /10\.00€/); assert.match(msg, /1\.50€/); assert.match(msg, /-2,00€/)
  })

  test('saldo = carregado − envios; anulados em qualquer grafia não descontam', () => {
    const shipments = [ship(10), ship(4.15), ...['anulado', 'Anulado', 'CANCELADO', 'cancelled', 'canceled'].map(status => ship(999, { status }))]
    assert.equal(balance.payAsYouGoBalance(20, shipments, []), 5.85)
  })

  test('envios antes da data de passagem a pré-pagamento não saem da wallet; o próprio instante conta', () => {
    const since = '2026-11-01T00:00:00.000Z'
    const shipments = [ship(100, { created_at: '2026-10-31T23:59:59.999Z' }), ship(3, { created_at: since }), ship(2, { created_at: '2026-11-02T10:00:00Z' })]
    assert.equal(balance.payAsYouGoSpent(shipments, [], since), 5)
    assert.equal(balance.payAsYouGoBalance(1, shipments, [], since), -4)
  })

  test('envios marcados como conta corrente nunca consomem a wallet', () => {
    assert.equal(balance.payAsYouGoSpent([ship(50, { billing_type: 'conta_corrente' }), ship(5)], []), 5)
  })

  test('preços inválidos contam zero na pré-visualização (o SQL recusa-os; ver testes SQL)', () => {
    assert.equal(balance.payAsYouGoSpent([ship('abc'), ship(null), ship(undefined), ship(2)], []), 2)
  })

  test('aleatório: o saldo é sempre carregado − soma dos envios válidos, ao cêntimo', () => {
    const r = rng(2026)
    for (let run = 0; run < 300; run++) {
      const loaded = money(r)
      const shipments = Array.from({ length: Math.floor(r() * 30) }, () => ship(money(r), r() < 0.15 ? { status: 'anulado' } : {}))
      const expected = cents(loaded) - shipments.filter(s => s.status !== 'anulado').reduce((a, s) => a + cents(s.sell_price), 0)
      assert.equal(cents(balance.payAsYouGoBalance(loaded, shipments, [])), expected)
    }
  })
})

// ─────────────────────────── Conta corrente: o que o cliente deve ───────────────────────────

describe('conta corrente: valor em dívida usado no limite', () => {
  const ship = (sell_price, billing_statement_id = null, status = 'entregue') => ({ sell_price, billing_statement_id, status })

  test('dívida = envios por faturar + faturas sem recibo; recibo, "paid" e anulados não contam', () => {
    const statements = [
      { id: 'aberta', moloni_document_id: 1, total_value: 20 },
      { id: 'parcial', moloni_document_id: 2, total_value: 50, outstanding_value: 12.5 },
      { id: 'recibo-id', moloni_document_id: 3, total_value: 70, moloni_receipt_id: 9 },
      { id: 'recibo-pdf', moloni_document_id: 4, total_value: 80, moloni_receipt_pdf: 'x' },
      { id: 'paga', moloni_document_id: 5, total_value: 90, status: 'paid' },
      { id: 'saldada', moloni_document_id: 6, total_value: 30, outstanding_value: 0 },
    ]
    const shipments = [ship(4), ship(6.5), ship(1000, 'aberta'), ship(77, null, 'anulado')]
    assert.equal(balance.currentAccountOutstanding(shipments, statements), 4 + 6.5 + 20 + 12.5)
  })

  test('um envio já faturado nunca conta duas vezes (envio + fatura)', () => {
    const statements = [{ id: 'f1', moloni_document_id: 1, total_value: 10 }]
    assert.equal(balance.currentAccountOutstanding([ship(10, 'f1')], statements), 10)
  })

  test('aleatório: a dívida é sempre a soma manual, ao cêntimo', () => {
    const r = rng(99)
    for (let run = 0; run < 300; run++) {
      const statements = Array.from({ length: Math.floor(r() * 8) }, (_, i) => {
        const s = { id: `s${i}`, moloni_document_id: i + 1, total_value: money(r) }
        if (r() < 0.3) s.moloni_receipt_id = 1
        if (r() < 0.2) s.outstanding_value = Math.round(s.total_value * r() * 100) / 100
        return s
      })
      const shipments = Array.from({ length: Math.floor(r() * 20) }, () => ship(money(r), r() < 0.3 ? 's0' : null, r() < 0.1 ? 'anulado' : 'entregue'))
      const expected = shipments.filter(s => !s.billing_statement_id && s.status !== 'anulado').reduce((a, s) => a + cents(s.sell_price), 0)
        + statements.filter(s => !s.moloni_receipt_id).reduce((a, s) => a + cents(s.outstanding_value ?? s.total_value), 0)
      assert.equal(cents(balance.currentAccountOutstanding(shipments, statements)), expected)
    }
  })
})

// ─────────────────────────── O cliente nunca vê o limite interno ───────────────────────────

describe('o limite de conta corrente nunca sai do servidor para o cliente', () => {
  const cc = { id: 'c', billing_type: 'conta_corrente', credit_limit: 5000, credit_limit_enabled: true, name: 'Loja' }
  const prepaid = { id: 'p', billing_type: 'pay_as_you_go', credit_limit: 12.5, credit_limit_enabled: false }

  test('cliente em conta corrente não recebe limite nem se está ativo', () => {
    const out = limit.redactClientForViewer(cc, 'client')
    assert.equal(out.credit_limit, undefined); assert.equal(out.credit_limit_enabled, undefined)
    assert.equal(out.name, 'Loja')
    assert.doesNotMatch(JSON.stringify(out), /5000|credit_limit/)
  })

  test('cliente sem modelo definido é tratado como conta corrente e também não recebe o limite', () => {
    assert.equal(limit.redactClientForViewer({ credit_limit: 5000 }, 'client').credit_limit, undefined)
  })

  test('cliente em pré-pagamento continua a receber o seu saldo carregado', () => {
    assert.equal(limit.redactClientForViewer(prepaid, 'client'), prepaid)
  })

  test('a equipa vê sempre tudo', () => {
    for (const role of ['admin', 'staff', 'employee', undefined, null]) assert.equal(limit.redactClientForViewer(cc, role), cc)
  })

  test('não altera o objeto original (cache do servidor fica intacta)', () => {
    const copy = { ...cc }; limit.redactClientForViewer(cc, 'client'); assert.deepEqual(cc, copy)
  })

  test('a ação do servidor usa esta proteção para todos os clientes devolvidos', () => {
    const src = fs.readFileSync('app/actions/clientes.ts', 'utf8')
    assert.match(src, /return clientes\.map\(\(c\) => redactClientForViewer\(c, ctx\.role\)\)/)
    assert.match(src, /credit_limit: cliente\.credit_limit \?\? defaultCreditLimit\(cliente\.billing_type\)/)
  })

  test('o portal do cliente não mostra limite, "Usado" nem percentagem consumida em conta corrente', () => {
    const dash = fs.readFileSync('app/app/components/ClientDashboard.tsx', 'utf8')
    assert.doesNotMatch(dash, /Crédito Disponível|Limite Disponível|consumido|creditLimit/)
    assert.match(dash, /'Saldo Disponível' : 'Por Liquidar'/)
    const details = fs.readFileSync('app/app/components/ClientAccountDetailsModal.tsx', 'utf8')
    assert.doesNotMatch(details, /Limite de Crédito|Limite de Faturação|credit_limit/)
  })
})

// ─────────────────────────── Reserva no servidor (antes de falar com a transportadora) ───────────────────────────

describe('reserva de dinheiro antes de criar o envio', () => {
  const T = 't', C = 'c', S = 's'
  function fakeDb(profile, rpcResult) {
    const calls = []
    return {
      calls,
      from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => profile }; return q },
      rpc: async (name, params) => { calls.push({ name, params }); return rpcResult },
    }
  }
  const profile = details => ({ data: { details }, error: null })

  test('conta corrente sem limite ativo: não reserva nada e não chama a base de dados', async () => {
    const db = fakeDb(profile({ billing_type: 'conta_corrente', credit_limit: 10, credit_limit_enabled: false }), null)
    assert.deepEqual(await reserveWallet(db, T, C, S, 999999, 'x'), { tenant: T, client: C, shipment: S, reserved: false })
    assert.equal(db.calls.length, 0)
  })

  test('conta corrente acima do limite: recusa com mensagem neutra, sem valores nem a palavra limite', async () => {
    const db = fakeDb(profile({ billing_type: 'conta_corrente', credit_limit: 10, credit_limit_enabled: true }), { data: { refused: true, balance: 3.27 }, error: null })
    await assert.rejects(reserveWallet(db, T, C, S, 50, 'x'), err => {
      assert.match(err.message, /valores por regularizar/)
      assert.doesNotMatch(err.message, /\d|limite|crédito|disponível/i)
      return true
    })
    assert.equal(db.calls[0].name, 'reserve_current_account_credit')
    assert.equal(db.calls[0].params.p_amount, 50)
  })

  test('conta corrente dentro do limite: reserva e guarda o saldo anterior', async () => {
    const db = fakeDb(profile({ billing_type: 'conta_corrente', credit_limit_enabled: true }), { data: { reserved: true, balance: 40 }, error: null })
    const r = await reserveWallet(db, T, C, S, 10, 'x')
    assert.equal(r.reserved, true); assert.equal(r.balanceBefore, 40); assert.equal(r.kind, 'credit_limit')
  })

  test('conta corrente: erro da base de dados bloqueia o envio (nunca assume que há margem)', async () => {
    const db = fakeDb(profile({ billing_type: 'conta_corrente', credit_limit_enabled: true }), { data: null, error: { code: 'XX000', message: 'boom' } })
    await assert.rejects(reserveWallet(db, T, C, S, 1, 'x'), /Não foi possível validar o limite/)
  })

  test('pré-pagamento usa sempre a wallet, nunca o limite de conta corrente', async () => {
    const db = fakeDb(profile({ billing_type: 'pay_as_you_go', credit_limit: 0, credit_limit_enabled: true }), { data: { reserved: true, balance: 0 }, error: null })
    await reserveWallet(db, T, C, S, 1, 'x')
    assert.deepEqual(db.calls.map(c => c.name), ['reserve_shipment_wallet'])
  })

  test('ficha do cliente ilegível ou inexistente bloqueia o envio', async () => {
    for (const p of [{ data: null, error: { message: 'x' } }, { data: null, error: null }, { data: {}, error: null }]) {
      await assert.rejects(reserveWallet(fakeDb(p, null), T, C, S, 1, 'x'), /condições de faturação/)
    }
  })

  test('valores de envio inválidos são recusados antes de qualquer leitura', async () => {
    for (const amount of [-0.01, NaN, Infinity, -Infinity]) {
      const db = fakeDb(profile({ billing_type: 'pay_as_you_go' }), null)
      await assert.rejects(reserveWallet(db, T, C, S, amount, 'x'), /custo do envio/)
      assert.equal(db.calls.length, 0)
    }
  })
})

// ─────────────────────────── SQL real: wallet de pré-pagamento + Stripe ───────────────────────────

describe('SQL: wallet de pré-pagamento', () => {
  const T = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222'
  const TX = '44444444-4444-4444-4444-444444444444'
  const sid = i => `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`
  let db
  before(async () => {
    db = await PGlite.create()
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text);
      CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT now());
      CREATE TYPE public.shipment_status AS ENUM ('rascunho','pendente','entregue','anulado');
      CREATE TABLE public.shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,status public.shipment_status,sell_price numeric,created_at timestamptz DEFAULT now());`)
    await db.exec(fs.readFileSync('supabase/migrations/20260921100000_client_transactions.sql', 'utf8'))
    await db.exec(fs.readFileSync('supabase/migrations/20261022180000_atomic_wallet_operations.sql', 'utf8'))
  })
  after(async () => db?.close())

  async function reset({ credit = 0, topUp = 1 } = {}) {
    await db.exec('TRUNCATE public.wallet_reservations,public.client_transactions,public.shipments,public.audit_log,public.clients CASCADE')
    await db.query('INSERT INTO public.clients(id,tenant_id) VALUES ($1,$2)', [A, T])
    await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'client_data',$2)",
      [T, JSON.stringify({ id: A, credit_limit: credit, billing_type: 'pay_as_you_go' })])
    await db.query("INSERT INTO public.client_transactions(id,tenant_id,client_id,amount,status,stripe_session_id) VALUES ($1,$2,$3,$4,'pending','cs_t')", [TX, T, A, topUp])
  }
  const settle = (cents) => db.query('SELECT public.settle_stripe_topup($1,$2,$3,$4,$5,$6) result', [TX, T, A, 'cs_t', cents, 'evt_t'])
  const snap = async () => (await db.query('SELECT public.client_wallet_snapshot($1,$2) result', [T, A])).rows[0].result
  const reserve = (id, amount) => db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,$4,$5) result', [T, A, id, amount, 'LTK'])
  const reserved = r => r.rows[0].result.reserved === true

  test('regressão 5001 €: wallet nova a 0 € + Stripe 1 € = 1,00 € disponível', async () => {
    await reset({ credit: limit.defaultCreditLimit('pay_as_you_go'), topUp: 1 })
    await settle(100)
    const s = await snap()
    assert.equal(Number(s.credit), 1); assert.equal(Number(s.balance), 1)
  })

  test('Stripe converte cêntimos em euros exatamente (1 €, 12,34 €, 500 €)', async () => {
    for (const eur of [1, 12.34, 500]) {
      await reset({ credit: 0, topUp: eur }); await settle(cents(eur))
      assert.equal(Number((await snap()).balance), eur)
    }
  })

  test('Stripe recusa um valor pago diferente do pedido (nem a mais, nem a menos, nem em euros em vez de cêntimos)', async () => {
    for (const wrong of [99, 101, 1, 10000]) {
      await reset({ credit: 0, topUp: 1 }); await assert.rejects(settle(wrong))
      assert.equal(Number((await snap()).balance), 0)
    }
  })

  test('o mesmo pagamento Stripe entregue 5 vezes credita uma única vez', async () => {
    await reset({ credit: 0, topUp: 1 })
    await Promise.all(Array.from({ length: 5 }, () => settle(100)))
    assert.equal(Number((await snap()).balance), 1)
  })

  test('com 1,00 € um envio de 3,00 € passa (fica −2,00 €) e o cêntimo seguinte é recusado', async () => {
    await reset({ credit: 1 })
    assert.equal(reserved(await reserve(sid(1), 3)), true)
    assert.equal(Number((await snap()).balance), -2)
    assert.equal(reserved(await reserve(sid(2), 0.01)), false)
    assert.equal(Number((await snap()).balance), -2)
  })

  test('com 1,00 € um envio de 3,01 € é recusado e não deixa reserva nenhuma', async () => {
    await reset({ credit: 1 })
    assert.equal(reserved(await reserve(sid(1), 3.01)), false)
    const s = await snap(); assert.equal(Number(s.balance), 1); assert.equal(Number(s.reserved), 0)
  })

  test('20 pedidos de envio em simultâneo nunca passam o descoberto de −2,00 €', async () => {
    await reset({ credit: 5 })
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(sid(i + 1), 1)))
    assert.equal(results.filter(reserved).length, 7) // 5 € + 2 € de descoberto
    assert.equal(Number((await snap()).balance), -2)
  })

  test('carregamento e envio ao mesmo tempo: o dinheiro conserva-se', async () => {
    await reset({ credit: 0, topUp: 10 })
    await Promise.all([settle(1000), reserve(sid(1), 4.15)])
    assert.equal(Number((await snap()).balance), 5.85)
  })

  test('injeção admin: corrigir 5001 € para o valor real com a proteção contra gravações desatualizadas', async () => {
    await reset({ credit: 5000, topUp: 1 }); await settle(100)
    assert.equal(Number((await snap()).balance), 5001)
    const save = (credit, expected) => db.query('SELECT public.save_client_financial_profile($1,$2,$3,$4)',
      [T, A, JSON.stringify({ id: A, credit_limit: credit, billing_type: 'pay_as_you_go' }), expected])
    // Ficha aberta antes do carregamento (via 5000) → gravação recusada, o carregamento não se perde.
    await assert.rejects(save(0, 5000), /Balance changed/)
    assert.equal(Number((await snap()).balance), 5001)
    // Ficha atualizada (via 5001) → −5000 aplicado → 1,00 € real.
    await save(limit.applyWalletInjection(5001, limit.parseWalletInjection('-5000')), 5001)
    assert.equal(Number((await snap()).balance), 1)
  })

  test('valores de reserva com mais de 2 casas decimais, negativos ou inválidos são recusados', async () => {
    await reset({ credit: 100 })
    for (const amount of [-1, 0.001, 1.005, 'NaN', 'Infinity', null]) await assert.rejects(reserve(sid(9), amount), /Invalid reservation amount/)
    assert.equal(Number((await snap()).balance), 100)
  })
})

// ─────────────────────────── SQL real: limite interno de conta corrente ───────────────────────────

describe('SQL: limite de faturação de conta corrente', () => {
  const T = '11111111-1111-1111-1111-111111111111', C = '22222222-2222-2222-2222-222222222222'
  const sid = i => `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`
  const sql = fs.readFileSync('supabase/migrations/20261026170000_current_account_credit_limit.sql', 'utf8')
  let db
  before(async () => {
    db = await PGlite.create()
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
      CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,action text,details jsonb,created_at timestamptz DEFAULT now());
      CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,status text,sell_price numeric,billing_statement_id uuid);`)
    await db.exec(sql)
  })
  after(async () => db?.close())

  async function reset(profile = {}) {
    await db.exec('TRUNCATE credit_limit_reservations,audit_log,shipments,clients CASCADE')
    await db.query('INSERT INTO clients VALUES($1,$2)', [C, T])
    await db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'client_data',$2)",
      [T, { id: C, billing_type: 'conta_corrente', credit_limit: 100, credit_limit_enabled: true, ...profile }])
  }
  const reserve = async (amount, id) => (await db.query('SELECT reserve_current_account_credit($1,$2,$3,$4,$5) result', [T, C, id, amount, 'LTK'])).rows[0].result
  const debt = async (id, price) => {
    await db.query("INSERT INTO shipments VALUES($1,$2,$3,'entregue',$4,NULL)", [id, T, C, price])
    await db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'shipment_data',$2)", [T, { id, client_id: C, sell_price: price, status: 'entregue' }])
  }
  const invoice = (details) => db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'billing_statement',$2)", [T, { client_id: C, ...details }])

  test('dívida de 99,99 € com limite de 100 €: 0,01 € passa, o cêntimo seguinte é recusado', async () => {
    await reset(); await debt(sid(100), 99.99)
    assert.equal((await reserve(0.01, sid(1))).reserved, true)
    assert.equal((await reserve(0.01, sid(2))).refused, true)
  })

  test('várias reservas que somam exatamente o limite são aceites; mais nada passa', async () => {
    await reset()
    for (let i = 1; i <= 4; i++) assert.equal((await reserve(25, sid(i))).reserved, true)
    assert.equal((await reserve(0.01, sid(5))).refused, true)
  })

  test('20 pedidos simultâneos de 10 € com limite de 100 € → exatamente 10 aceites', async () => {
    await reset()
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(10, sid(i + 1))))
    assert.equal(results.filter(r => r.reserved).length, 10)
    assert.equal(results.filter(r => r.refused).length, 10)
  })

  test('fatura por pagar ocupa o limite; quando chega o recibo o limite volta a estar livre', async () => {
    await reset(); await invoice({ id: 'f1', moloni_document_id: 1, total_value: 100 })
    assert.equal((await reserve(0.01, sid(1))).refused, true)
    await invoice({ id: 'f1', moloni_document_id: 1, total_value: 100, moloni_receipt_id: 7 })
    assert.equal((await reserve(100, sid(2))).reserved, true)
  })

  test('pagamento parcial liberta só a parte paga', async () => {
    await reset(); await invoice({ id: 'f1', moloni_document_id: 1, total_value: 100, outstanding_value: 40 })
    assert.equal((await reserve(60, sid(1))).reserved, true)
    assert.equal((await reserve(0.01, sid(2))).refused, true)
  })

  test('envios anulados não ocupam o limite', async () => {
    await reset()
    await db.query("INSERT INTO shipments VALUES($1,$2,$3,'anulado',500,NULL)", [sid(100), T, C])
    await db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'shipment_data',$2)", [T, { id: sid(100), client_id: C, sell_price: 500, status: 'anulado' }])
    assert.equal((await reserve(100, sid(1))).reserved, true)
  })

  test('limite desligado: sem bloqueio, mas o valor configurado fica guardado', async () => {
    await reset({ credit_limit_enabled: false, credit_limit: 100 })
    assert.deepEqual(await reserve(1000000, sid(1)), { reserved: false })
    const stored = (await db.query("SELECT details FROM audit_log WHERE action='client_data'")).rows[0].details
    assert.equal(stored.credit_limit, 100)
  })

  test('limite 0 € ativo bloqueia qualquer envio', async () => {
    await reset({ credit_limit: 0 })
    assert.equal((await reserve(0.01, sid(1))).refused, true)
  })

  test('nunca é aplicado a um cliente em pré-pagamento (esse usa a wallet)', async () => {
    await reset({ billing_type: 'pay_as_you_go' })
    await assert.rejects(reserve(1, sid(1)), /Billing model/)
  })

  test('o browser (anon/authenticated) não consegue chamar a reserva nem ler reservas', async () => {
    for (const role of ['anon', 'authenticated']) {
      const r = (await db.query("SELECT has_function_privilege($1,'public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text)','EXECUTE') rpc,has_table_privilege($1,'public.credit_limit_reservations','SELECT') tbl", [role])).rows[0]
      assert.deepEqual(r, { rpc: false, tbl: false })
    }
  })
})
