const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const tenant='11111111-1111-1111-1111-111111111111'
function actions(preview){
 const calls=[],paths=[]
 const load=createLoader({'@/lib/auth/context':{requireAdmin:async()=>({tenant_id:tenant})},'@/lib/supabase/server':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null}}})},'next/cache':{revalidatePath:p=>paths.push(p)},'@/lib/billing/recurring-statements':{recurringPreview:preview},'@/lib/services/shipments/shipment-fetcher':{SHIPMENT_LIST_COLUMNS:'*'}})
 return {api:load('app/actions/recurring-statements.ts'),calls,paths}
}
test('administrators can disable automation even when preview dependencies are unavailable, preserving the anchor',async()=>{
 const h=actions(async()=>{throw Error('Unavailable')})
 assert.equal((await h.api.configureRecurringStatementsAction(false,'2026-10-16')).success,true)
 assert.deepEqual(h.calls,[{name:'configure_recurring_statements',args:{p_tenant:tenant,p_enabled:false,p_anchor:'2026-10-16'}}])
 assert.ok(h.paths.includes('/ops/configuracao/faturacao'))
 assert.ok(h.paths.includes('/ops/faturacao/contas-corrente'))
})
test('enabling still requires complete preview, email and scheduler configuration',async()=>{
 for(const preview of [{ready:false,error:'unavailable'},{ready:true,emailConfigured:false,cronConfigured:true},{ready:true,emailConfigured:true,cronConfigured:false}]){
  const h=actions(async()=>preview)
  assert.equal((await h.api.configureRecurringStatementsAction(true,'2026-10-16')).success,false)
  assert.equal(h.calls.length,0)
 }
 const h=actions(async()=>({ready:true,emailConfigured:true,cronConfigured:true}))
 assert.equal((await h.api.configureRecurringStatementsAction(true,'2026-10-16')).success,true)
 assert.equal(h.calls[0].args.p_enabled,true)
})
test('a scheduled run with automation disabled issues no invoices, sends no emails and writes no billing records',async()=>{
 const db=fakeSupabase({recurring_statement_settings:[{tenant_id:tenant,enabled:false,anchor_date:'2026-10-16'}]})
 const forbidden=()=>{throw Error('Unexpected financial or email operation')}
 const load=createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},'@/lib/billing/recurring-invoices':{ensureRecurringInvoice:forbidden,recurringInvoiceAttachment:forbidden},'@/lib/email/resend':{sendEmail:forbidden},'@/lib/services/billing/statement-pdf':{generateStatementPdfBuffer:forbidden}})
 const result=await load('lib/billing/recurring-statements.ts').runRecurringStatements(new Date('2026-10-30T12:00:00Z'))
 assert.equal(result.generated,0);assert.equal(result.sent,0);assert.deepEqual(result.errors,[])
 assert.equal(db.writes.length,0)
})
