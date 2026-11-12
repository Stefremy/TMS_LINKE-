const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const row=(id,extra={})=>({id,carrier_code:'ctt',status:'pendente',...extra})
function harness(){
 const slots=[];let cursor=0
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]}}
 const {useCttCertificateSelection}=createLoader({react,'react/jsx-runtime':{}})('components/shipments/CttCertificateControls.tsx')
 return{render(rows,scope='store-a'){cursor=0;return useCttCertificateSelection(rows,scope)}}
}
test('page selection accumulates across pages, removes a page only and never includes closed, foreign-carrier or cancelled rows',()=>{
 const h=harness(),rows=[row('a'),row('b'),row('c'),row('closed',{ops_substatus:'manifesto_fechado'}),row('correos',{carrier_code:'correos'}),row('cancelled',{status:'cancelado'})]
 let s=h.render(rows);s.togglePage(rows.slice(0,2));s=h.render(rows);assert.deepEqual(s.selectedIds,['a','b'])
 s.togglePage(rows.slice(2));s=h.render(rows);assert.deepEqual(s.selectedIds,['a','b','c'])
 s.togglePage(rows.slice(0,2));s=h.render(rows);assert.deepEqual(s.selectedIds,['c'])
 s.toggle('closed');s.toggle('correos');s.toggle('cancelled');assert.deepEqual(h.render(rows).selectedIds,['c'])
})
test('selection is bounded at 100, reconciles closed rows and cannot survive a store change',()=>{
 const h=harness(),rows=Array.from({length:110},(_,i)=>row(String(i)))
 h.render(rows).togglePage(rows);assert.equal(h.render(rows).selectedIds.length,100)
 const closed=rows.map(r=>r.id==='0'?{...r,ops_substatus:'manifesto_fechado'}:r)
 assert.equal(h.render(closed).selectedIds.length,99)
 assert.equal(h.render(closed,'store-b').selectedIds.length,0)
 h.render(closed,'store-b').toggle('109');assert.deepEqual(h.render(closed,'store-b').selectedIds,['109'])
})
test('closure filters distinguish CTT paperwork from transport status and exclude Correos',()=>{
 const {matchesCttCertificateFilter,hasCttClosure}=createLoader({})('lib/services/ctt/certificate-status.ts')
 const closed=row('closed',{ops_substatus:'manifesto_fechado'})
 assert.equal(hasCttClosure(closed),true);assert.equal(closed.status,'pendente')
 assert.equal(matchesCttCertificateFilter(closed,'closed'),true);assert.equal(matchesCttCertificateFilter(closed,'open'),false)
 assert.equal(matchesCttCertificateFilter(row('new'),'open'),true)
 assert.equal(matchesCttCertificateFilter(row('correos',{carrier_code:'correos'}),'closed'),false)
})
