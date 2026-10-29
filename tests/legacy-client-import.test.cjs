const test=require('node:test'),assert=require('node:assert/strict')
const {planImport,stableId,paymentDays,validPtNif}=require('../scripts/import-legacy-clients.cjs')
const row={Código:'LK0010',Nome:'Loja Exemplo',NIF:'518600300',Morada:'Rua A 12','Código Postal':'4800-019',Localidade:'Guimarães',País:'pt','Designação Social':'Exemplo Lda','Morada Faturação':'Rua Fiscal 21','Código Postal Faturação':'4000-001','Localidade Faturação':'Porto','País Faturação':'pt','E-mail':'loja@example.com','Email Faturação':'finance@example.com','Telemóvel':'912345678','Forma de Pagamento':'A 7 dias','Método de Pagamento':'Transferência',Registo:'2025-01-02','Tabela Preços':'Personalizada'}
test('maps identity and contacts without making up missing shipping or financial settings',()=>{
 const e=planImport([row],[])[0],c=e.record
 assert.equal(e.status,'A importar')
 assert.equal(c.short_name,row.Nome);assert.equal(c.legal_name,row['Designação Social'])
 assert.equal(c.payment_due_days,7);assert.equal(c.payment_terms,'Por definir')
 assert.deepEqual(c.assigned_linke_service_ids,[]);assert.deepEqual(c.allowed_webservices,[])
 assert.equal(c.credit_limit_enabled,false);assert.equal(c.credit_limit,0)
 assert.equal(c.address,'Rua A 12');assert.match(c.observations,/Rua Fiscal 21/)
 assert.equal(c.legacy_import.source['Morada Faturação'],'Rua Fiscal 21')
 assert.deepEqual(planImport([{...row,País:'',Morada:''}],[])[0].record.country_code,'')
 assert.equal(planImport([{...row,'Forma de Pagamento':''}],[])[0].record.payment_due_days,undefined)
})
test('codes, names, NIF, email and clear name prefixes stop duplicate creation without overwriting existing data',()=>{
 for(const current of [{id:'x',code:row.Código},{id:'x',short_name:'loja exemplo'},{id:'x',nif:row.NIF},{id:'x',email:'LOJA@EXAMPLE.COM'},{id:'x',short_name:'Loja Exemplo - Porto'}]){
  const original=JSON.stringify(current),e=planImport([row],[current])[0]
  assert.equal(e.status,'Rever');assert.equal(e.record,undefined);assert.equal(JSON.stringify(current),original)
 }
})
test('generic tax IDs do not merge unrelated clients, while consumer-final placeholders are skipped',()=>{
 const e=planImport([{...row,NIF:'999999990'}],[{id:'x',short_name:'Outra',nif:'999999990'}])[0]
 assert.equal(e.status,'A importar');assert.ok(e.issues.some(s=>s.includes('NIF genérico')))
 assert.equal(planImport([{...row,Código:'CFINAL'}],[])[0].status,'Não importado')
})
test('deterministic identifiers make repeat runs idempotent and registry-only failures resumable',()=>{
 const e=planImport([row],[])[0]
 assert.match(stableId('lk0010'),/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
 assert.equal(stableId('lk0010'),stableId('LK0010'))
 assert.equal(planImport([row],[e.record])[0].status,'Já importado')
 assert.equal(planImport([row],[{id:e.id,name:row.Nome,registryOnly:true}])[0].status,'A importar')
 assert.equal(planImport([row,row],[])[1].status,'Rever')
})
test('payment terms and Portuguese checksum are parsed without inventing missing values',()=>{
 assert.equal(paymentDays('A Pronto'),0);assert.equal(paymentDays('A 30 dias'),30)
 assert.equal(paymentDays(''),undefined);assert.equal(paymentDays('A 500 dias'),undefined)
 assert.equal(validPtNif('518600300'),true);assert.equal(validPtNif('999999990'),false);assert.equal(validPtNif('123456788'),false)
})

test('read-back verifies every imported value and permits metadata owned by the server',()=>{
 const {verifyImportedProfile}=require('../scripts/import-legacy-clients.cjs')
 const record=planImport([row],[])[0].record
 assert.equal(verifyImportedProfile({...record,recurring_since:'2026-10-29T16:40:00Z'},record),true)
 assert.equal(verifyImportedProfile({...record,email:'changed@example.com'},record),false)
 assert.equal(verifyImportedProfile(undefined,record),false)
})
