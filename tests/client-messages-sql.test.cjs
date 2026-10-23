const test=require('node:test'),{before,after}=test,assert=require('node:assert/strict'),fs=require('node:fs')
const{PGlite}=require('@electric-sql/pglite')
const T='11111111-1111-1111-1111-111111111111',A='22222222-2222-2222-2222-222222222222',B='33333333-3333-3333-3333-333333333333',U='44444444-4444-4444-8444-444444444444',V='55555555-5555-4555-8555-555555555555',S='66666666-6666-4666-8666-666666666666',K='77777777-7777-4777-8777-777777777777'
let db
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text,details jsonb);
 CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,status text,ops_substatus text,tracking_number text,carrier_tracking_number text,updated_at timestamptz DEFAULT clock_timestamp());
 CREATE TABLE client_transactions(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,status text,amount numeric,credited_at timestamptz);
 `);const migration=fs.readFileSync('supabase/migrations/20261023180000_client_messages.sql','utf8');await db.exec(migration);await db.exec(migration)
})
after(async()=>db?.close())
async function reset(){await db.exec('TRUNCATE client_messages,client_message_reads,audit_log,shipments,client_transactions,clients CASCADE');await db.query('INSERT INTO clients VALUES($1,$2),($3,$2),($4,$4)',[A,T,B,V])}
const send=(client=A,key=K,title='Aviso',body='Horário de recolhas alterado.')=>db.query('SELECT public.send_client_message($1,$2,$3,$4,$5,$6) id',[T,client,U,key,title,body])
const page=async(client=A,user=U,options={})=>(await db.query('SELECT public.client_message_page($1,$2,$3,$4,$5,$6,$7,$8) result',[T,client,user,options.at||null,options.id||null,!!options.unread,options.limit??20,options.kind||null])).rows[0].result
const read=(ids,client=A,user=U)=>db.query('SELECT public.mark_client_messages_read($1,$2,$3,$4)',[T,client,user,ids])
const event=(action,details,id)=>db.query('INSERT INTO audit_log(id,tenant_id,action,details) VALUES(COALESCE($1,gen_random_uuid()),$2,$3,$4)',[id||null,T,action,details])
const messages=async()=> (await db.query('SELECT * FROM client_messages ORDER BY created_at,id')).rows
test('SQL: messages and unread state are persisted, isolated by store and individual login',async()=>{
 await reset();const id=(await send()).rows[0].id;assert.equal((await page()).unreadCount,1);assert.equal((await page(B)).unreadCount,0)
 await read([id]);assert.equal((await page()).unreadCount,0);assert.ok((await page()).messages[0].read_at);assert.equal((await page(A,V)).unreadCount,1)
 await read([id]);assert.equal((await db.query('SELECT count(*)::int n FROM client_message_reads')).rows[0].n,1)
})
test('SQL: mixed or forged message ids never partially mark another store as read',async()=>{
 await reset();const a=(await send()).rows[0].id,b=(await send(B)).rows[0].id
 for(const ids of [[b],[a,b],[V],[null]])await assert.rejects(read(ids),/Invalid message scope/)
 assert.equal((await page()).unreadCount,1);assert.equal((await page(B)).unreadCount,1)
})
test('SQL: manual send retries deduplicate, changed retry bodies fail and cross-tenant targets are refused',async()=>{
 await reset();const ids=await Promise.all([send(),send(),send()]);assert.equal(new Set(ids.map(r=>r.rows[0].id)).size,1);assert.equal((await page()).messages.length,1)
 await assert.rejects(send(A,K,'Aviso','Diferente'),/retry mismatch/);await assert.rejects(send(V),/Invalid message scope/)
 for(const [title,body] of [['','x'],['x',''],['a'.repeat(161),'x'],['x','a'.repeat(4001)]])await assert.rejects(send(A,V,title,body))
})
test('SQL: keyset pagination preserves every message even with identical timestamps',async()=>{
 await reset();for(let n=0;n<25;n++)await db.query("INSERT INTO client_messages(tenant_id,client_id,source_key,kind,title,body,created_at)VALUES($1,$2,$3,'info','Teste','Texto','2026-10-23T10:00:00Z')",[T,A,'page:'+n])
 const first=await page();assert.equal(first.messages.length,20);assert.ok(first.next)
 const second=await page(A,U,first.next);assert.equal(second.messages.length,5);assert.equal(second.next,null);assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,25)
 assert.equal((await page(A,U,{limit:0})).messages.length,0);assert.equal((await page(A,U,{limit:0})).unreadCount,25)
 await read(first.messages.map(m=>m.id));assert.equal((await page(A,U,{unread:true})).messages.length,5)
})
test('SQL: a pending bank reference does not generate a confirmation; only successful credit does, once',async()=>{
 await reset();await db.query("INSERT INTO client_transactions VALUES($1,$2,$3,'pending',10,NULL)",[S,T,A]);assert.equal((await messages()).length,0)
 await db.query("UPDATE client_transactions SET status='paid' WHERE id=$1",[S]);assert.equal((await messages()).length,0)
 await db.query('UPDATE client_transactions SET credited_at=clock_timestamp() WHERE id=$1',[S]);assert.equal((await messages()).length,1);assert.equal((await messages())[0].kind,'payment')
 await db.query("UPDATE client_transactions SET status='paid' WHERE id=$1",[S]);assert.equal((await messages()).length,1)
})
test('SQL: invoice and receipt notices use confirmed fiscal IDs, exclude proformas, and deduplicate',async()=>{
 await reset();await event('billing_statement',{client_id:A,statement_number:'EXT-1'});await event('billing_statement',{client_id:A,moloni_document_id:7,is_pro_forma:true});assert.equal((await messages()).length,0)
 await event('billing_statement',{client_id:A,moloni_document_id:8,moloni_document_number:'FT 2026/8'});await event('billing_statement',{client_id:A,moloni_document_id:8,moloni_document_number:'FT 2026/8'});assert.equal((await messages()).length,1)
 await event('billing_statement',{client_id:A,moloni_document_id:8,moloni_document_number:'FT 2026/8',moloni_receipt_id:9,status:'paid'});assert.equal((await messages()).length,2);assert.match((await messages())[1].body,/FT 2026\/8/)
})
test('SQL: incident and weight notices bind the native shipment to its store and preserve the before/after information',async()=>{
 await reset();await db.query("INSERT INTO shipments VALUES($1,$2,$3,'pendente',NULL,'LTK-TEST','EQ-TEST',clock_timestamp())",[S,T,A])
 await db.query("UPDATE shipments SET status='incidencia',ops_substatus='EDF' WHERE id=$1",[S]);assert.equal((await messages()).length,1)
 await db.query("UPDATE shipments SET status='incidencia',ops_substatus='EDF' WHERE id=$1",[S]);assert.equal((await messages()).length,1)
 const details={client_id:A,shipment_id:S,previousWeightKg:1,weightKg:6,previousPrice:4,price:8,difference:4}
 await event('shipment_weight_adjustment',{...details,client_id:B});assert.equal((await messages()).length,1)
 await event('shipment_weight_adjustment',details,K);await db.query('UPDATE audit_log SET details=details WHERE id=$1',[K]);assert.equal((await messages()).length,2);assert.match((await messages())[1].body,/1 kg para 6 kg/)
})
test('SQL: notification failure cannot roll back a confirmed financial operation',async()=>{
 await reset();await db.exec(`CREATE FUNCTION fail_message() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture unavailable';END $$;CREATE TRIGGER fixture_fail BEFORE INSERT ON client_messages FOR EACH ROW EXECUTE FUNCTION fail_message();`)
 try{await db.query("INSERT INTO client_transactions VALUES($1,$2,$3,'paid',10,clock_timestamp())",[S,T,A]);assert.equal((await db.query('SELECT status FROM client_transactions')).rows[0].status,'paid');assert.equal((await messages()).length,0)}finally{await db.exec('DROP TRIGGER fixture_fail ON client_messages;DROP FUNCTION fail_message()')}
 await db.query("UPDATE client_transactions SET status='paid' WHERE id=$1",[S]);assert.equal((await messages()).length,1)
})
test('SQL: parent transaction rollback also removes its uncommitted notification',async()=>{
 await reset();await db.exec('BEGIN');await db.query("INSERT INTO client_transactions VALUES($1,$2,$3,'paid',10,clock_timestamp())",[S,T,A]);await db.exec('ROLLBACK');assert.equal((await messages()).length,0)
})
test('SQL: browser roles cannot access inbox tables, send messages or change read states directly',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);try{await assert.rejects(send(),/permission denied/);await assert.rejects(page(),/permission denied/);await assert.rejects(read([K]),/permission denied/);for(const table of ['client_messages','client_message_reads'])await assert.rejects(db.query('SELECT * FROM '+table),/permission denied/)}finally{await db.exec('RESET ROLE')}}
})

test('SQL: category filtering searches the complete history and keeps global unread totals',async()=>{
 await reset()
 for(let n=0;n<25;n++)await db.query("INSERT INTO client_messages(tenant_id,client_id,source_key,kind,title,body)VALUES($1,$2,$3,'info','Aviso','Texto')",[T,A,'info:'+n])
 await db.query("INSERT INTO client_messages(tenant_id,client_id,source_key,kind,title,body,created_at)VALUES($1,$2,'invoice-old','invoice','Fatura','Texto','2026-10-20')",[T,A])
 const result=await page(A,U,{kind:'invoice'});assert.equal(result.messages.length,1);assert.equal(result.messages[0].kind,'invoice');assert.equal(result.unreadCount,26)
 await assert.rejects(page(A,U,{kind:'private'}),/Invalid message kind/)
})
test('SQL: zero fiscal IDs and invalid payment amounts never create confirmation notices',async()=>{
 await reset();await event('billing_statement',{client_id:A,moloni_document_id:0});assert.equal((await messages()).length,0)
 await db.query("INSERT INTO client_transactions VALUES($1,$2,$3,'paid',-5,clock_timestamp())",[S,T,A]);assert.equal((await messages()).length,0)
})
