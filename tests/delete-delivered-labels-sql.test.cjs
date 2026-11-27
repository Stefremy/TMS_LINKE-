const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const T = '11111111-1111-1111-1111-111111111111', OTHER = '99999999-9999-4999-8999-999999999999'
const A = '44444444-4444-4444-4444-444444444444', B = '55555555-5555-4555-8555-555555555555'
const migration = fs.readFileSync('supabase/migrations/20261127130000_delete_delivered_labels.sql', 'utf8')
const snapshot = id => ({ id, recipient_name: 'Ana', ctt_label_base64: 'PDF', carrier_label_base64: 'PDF', label_base64: 'PDF', labelBase64: 'PDF',
  carrier_labels: [{ data: 'PDF' }], ctt_documents: [{ FileName: 'GIC.pdf', File: 'PDF' }, { FileName: 'Certificado_Aceitacao_CTT.pdf', File: 'CERT' }],
  rawResponse: { Status: 'Success', ShipmentData: [{ FirstObject: 'EQ1PT', LabelList: [{ Label: 'PDF' }], DocumentsList: [{ File: 'PDF' }] }] }, ctt_close_data: { x: 1 } })
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.shipments(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, status text NOT NULL);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, action text NOT NULL, details jsonb);
    CREATE TABLE public.wallet_reservations(shipment_id uuid, tenant_id uuid, result jsonb);`)
  await db.exec(migration); await db.exec(migration)
})
after(async () => db?.close())

test('only becoming delivered deletes that shipment labels; certificates and other data stay', async () => {
  for (const id of [A, B]) {
    await db.query("INSERT INTO public.shipments VALUES ($1,$2,'pendente')", [id, T])
    for (const tenant of [T, T, OTHER]) await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2)", [tenant, JSON.stringify(snapshot(id))])
    await db.query('INSERT INTO public.wallet_reservations VALUES ($1,$2,$3)', [id, T, JSON.stringify(snapshot(id))])
  }
  await db.query("UPDATE public.shipments SET status='entrada_rede' WHERE id=$1", [A])
  const read = async (tenant, id) => (await db.query("SELECT details FROM public.audit_log WHERE tenant_id=$1 AND details->>'id'=$2", [tenant, id])).rows.map(r => r.details)
  assert.deepEqual((await read(T, A))[0], snapshot(A), 'in transit keeps labels')

  await db.query("UPDATE public.shipments SET status='entregue' WHERE id=$1", [A])
  const expected = { id: A, recipient_name: 'Ana', ctt_documents: [{ FileName: 'Certificado_Aceitacao_CTT.pdf', File: 'CERT' }],
    rawResponse: { Status: 'Success', ShipmentData: [{ FirstObject: 'EQ1PT' }] }, ctt_close_data: { x: 1 } }
  assert.deepEqual(await read(T, A), [expected, expected])
  assert.deepEqual((await db.query('SELECT result FROM public.wallet_reservations WHERE shipment_id=$1', [A])).rows[0].result, expected)
  assert.deepEqual((await read(T, B))[0], snapshot(B))
  assert.deepEqual((await read(OTHER, A))[0], snapshot(A))
})
