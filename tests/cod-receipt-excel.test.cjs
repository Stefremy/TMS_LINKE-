const test=require('node:test'),assert=require('node:assert/strict'),XLSX=require('xlsx')
const {createLoader}=require('./helpers/load-typescript.cjs')
const generate=createLoader({xlsx:XLSX})('lib/services/reembolsos/reembolso-receipt-excel.ts').generateCodReceiptExcel
const data=()=>({requestId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',requestedAt:'2026-10-29T23:30:00Z',generatedAt:'2026-10-30T12:00:00Z',state:'requested',client:{name:'Loja Demonstração',code:'DEMO',nif:'012345678',address:'Rua de Teste, 1',city:'4800-019 Guimarães'},amountCents:3055,items:[{shipmentId:'one',tracking:'0012345678901234',amountCents:1000,date:'2026-10-28'},{shipmentId:'two',tracking:'DD000000002PT',amountCents:2055,date:'2026-10-29'}]})
const read=input=>XLSX.read(generate(input),{type:'buffer',cellNF:true}).Sheets.Reembolso
test('Excel includes the exact selected guides, numeric amounts, typed dates, original identifiers and a reconciled total',()=>{
 const sheet=read(data())
 assert.equal(sheet.C4.v,'Loja Demonstração');assert.equal(sheet.C5.v,'DEMO / 012345678')
 assert.equal(sheet.C16.v,'0012345678901234');assert.equal(sheet.C16.t,'s')
 assert.equal(sheet.C17.v,'DD000000002PT');assert.equal(sheet.D16.t,'n');assert.equal(sheet.D16.v,10);assert.equal(sheet.D17.v,20.55)
 assert.equal(sheet.D18.f,'SUM(D16:D17)');assert.equal(sheet.D18.v,30.55);assert.match(sheet.D18.z,/EUR/)
 assert.equal(sheet.B16.t,'n');assert.equal(sheet.B16.z,'dd/mm/yyyy')
 const parsed=XLSX.SSF.parse_date_code(sheet.B16.v);assert.deepEqual([parsed.y,parsed.m,parsed.d],[2026,10,28])
 assert.equal(sheet['!autofilter'].ref,'A15:D17')
})
test('pending and disputed exports never claim a paid reimbursement; paid exports include the recorded date and reference',()=>{
 assert.match(read(data()).C8.v,/Por reembolsar/);assert.match(read(data()).A13.v,/não confirma/)
 const paid=read({...data(),state:'paid',paidAt:'2026-10-30T12:00:00Z',paymentRef:'BANK-123'})
 assert.equal(paid.A1.v,'LINKE | COMPROVATIVO DE REEMBOLSO');assert.equal(paid.C8.v,'Reembolsado');assert.equal(paid.C10.t,'n');assert.equal(paid.C11.v,'BANK-123')
 assert.match(read({...data(),state:'review'}).C8.v,/Em revisão/)
})
test('spreadsheet totals are validated and customer/tracking text cannot become injected Excel formulas',()=>{
 assert.throws(()=>generate({...data(),amountCents:999}),/não coincidem/)
 const input=data();input.client.name='=HYPERLINK("https://example.invalid","click")';input.items[0].tracking='+SUM(1,2)'
 const sheet=read(input)
 assert.equal(sheet.C4.t,'s');assert.equal(sheet.C4.f,undefined);assert.equal(sheet.C4.v,input.client.name)
 assert.equal(sheet.C16.t,'s');assert.equal(sheet.C16.f,undefined)
})
