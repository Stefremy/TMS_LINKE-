const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

// Pay as you go: top-ups are VAT-inclusive money, so each shipment must consume its total WITH VAT.
const T = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222'
const S1 = '55555555-5555-4555-8555-555555555555', S2 = '66666666-6666-4666-8666-666666666666'
const Q = '77777777-7777-4777-8777-777777777777'
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT now());
    CREATE TYPE public.shipment_status AS ENUM ('rascunho','pendente','entregue','anulado');
    CREATE TABLE public.shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,status public.shipment_status,sell_price numeric,created_at timestamptz DEFAULT now());`)
  await db.exec(fs.readFileSync('supabase/migrations/20260921100000_client_transactions.sql','utf8'))
  for (const f of ['20261022180000_atomic_wallet_operations','20261123150000_wallet_no_overdraft']) await db.exec(fs.readFileSync(`supabase/migrations/${f}.sql`,'utf8'))
  const vat = fs.readFileSync('supabase/migrations/20261124120000_wallet_debit_with_vat.sql','utf8')
  await db.exec(vat); await db.exec(vat) // Reruns are safe.
})
after(async () => db?.close())
async function reset(credit) {
  await db.exec('TRUNCATE public.wallet_reservations,public.shipments,public.audit_log,public.clients CASCADE')
  await db.query('INSERT INTO public.clients(id,tenant_id) VALUES ($1,$2)', [A,T])
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'client_data',$2)", [T,JSON.stringify({id:A,credit_limit:credit,billing_type:'pay_as_you_go'})])
}
const balance = async () => Number((await db.query('SELECT public.client_wallet_snapshot($1,$2) r',[T,A])).rows[0].r.balance)
const reserve = async (id, net, vat) => (await db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,$4,$5,$6) r',[T,A,id,net,'LTK',vat])).rows[0].r
const ship = (id, price) => db.query("INSERT INTO public.shipments(id,tenant_id,client_id,status,sell_price) VALUES ($1,$2,$3,'pendente',$4)",[id,T,A,price])

test('SQL: 3,39 € s/ IVA em PT-CONT consome 4,17 € (reservado e depois de criado)', async () => {
  await reset(5)
  const r = await reserve(S1, 3.39, 23)
  assert.equal(r.reserved, true); assert.equal(Number(r.amount), 4.17)
  assert.equal(await balance(), 0.83)
  await ship(S1, 3.39); assert.equal(await balance(), 0.83)
})
test('SQL: envios isentos (ilhas/internacional) consomem o valor sem IVA', async () => {
  await reset(5); await reserve(S1, 3.39, 0); await ship(S1, 3.39); assert.equal(await balance(), 1.61)
})
test('SQL: a recusa compara o saldo com o total c/ IVA', async () => {
  await reset(4)
  const r = await reserve(S1, 3.39, 23)
  assert.equal(r.refused, true); assert.equal(Number(r.amount), 4.17)
  assert.equal((await db.query('SELECT count(*)::int n FROM public.wallet_reservations')).rows[0].n, 0)
})
test('SQL: reservas antigas (sem taxa) mantêm o consumo s/ IVA — nenhum saldo existente muda', async () => {
  await reset(10)
  await db.query("INSERT INTO public.wallet_reservations(shipment_id,tenant_id,client_id,amount,state,reference) VALUES ($1,$2,$3,3.39,'consumed','old')",[S1,T,A])
  await ship(S1, 3.39); assert.equal(await balance(), 6.61)
})
test('SQL: acerto de peso posterior também é descontado com IVA', async () => {
  await reset(10); await reserve(S1, 3.39, 23); await ship(S1, 3.39)
  await db.query('UPDATE public.shipments SET sell_price=5 WHERE id=$1',[S1])
  assert.equal(await balance(), 3.85)
})
test('SQL: cotação aceite (assinatura antiga) aplica o IVA da proposta', async () => {
  await reset(20)
  await db.query("INSERT INTO public.audit_log(id,tenant_id,action,details) VALUES ($1,$2,'shipment_quote_request',$3)",[Q,T,JSON.stringify({has_iva:true})])
  const r = (await db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,$4,$5) r',[T,A,Q,10,'Q'])).rows[0].r
  assert.equal(Number(r.amount), 12.3)
  const legacy = (await db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,$4,$5) r',[T,A,S2,1,'L'])).rows[0].r
  assert.equal(Number(legacy.amount), 1)
})
test('SQL: taxas de IVA inválidas são recusadas', async () => {
  await reset(10)
  for (const v of [-1, 101]) await assert.rejects(reserve(S1, 1, v), /Invalid VAT rate/)
})
