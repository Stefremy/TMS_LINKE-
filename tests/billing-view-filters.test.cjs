const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {billingViewSelection,billingViewFiltersUrl}=createLoader({})('lib/billing/view-filters.ts')
test('view filters preserve a same-day selection and invoice grouping without changing shared settings',()=>{
 const selected=billingViewSelection({from:'2026-10-30',to:'2026-10-30',grouping:'detailed'})
 assert.deepEqual(selected,{startDate:'2026-10-30',endDate:'2026-10-30',grouping:'detailed'})
 const url=new URL(billingViewFiltersUrl(selected),'https://fixture.invalid')
 assert.equal(url.pathname,'/ops/configuracao/faturacao')
 assert.equal(url.searchParams.get('from'),'2026-10-30')
 assert.equal(url.searchParams.get('to'),'2026-10-30')
 assert.equal(url.searchParams.get('grouping'),'detailed')
 assert.equal(billingViewSelection({},'detailed').grouping,'detailed')
})
test('invalid or repeated filters cannot silently broaden the selected invoice period',()=>{
 for(const query of [{from:'2026-02-30'},{from:'2026-11-01',to:'2026-10-01'},{from:['2026-10-01','2026-10-02']},{grouping:'invalid'}])assert.throws(()=>billingViewSelection(query),/inválido|duplicado/)
})
test('the configuration form submits dates and format directly to Accounts Current as a read-only GET',()=>{
 const jsx=(type,props)=>({type,props:props||{}})
 const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[]
 const load=createLoader({react:{useState:initial=>[initial,()=>{}]},'react/jsx-runtime':{jsx,jsxs:jsx}})
 const Form=load('app/ops/configuracao/faturacao/components/BillingViewFilters.tsx').BillingViewFilters
 const nodes=flat(Form({initialSelection:{startDate:'2026-10-01',endDate:'2026-10-30',grouping:'detailed'}}))
 const form=nodes.find(n=>n.type==='form')
 assert.equal(form.props.method,'get')
 assert.equal(form.props.action,'/ops/faturacao/contas-corrente')
 assert.equal(nodes.find(n=>n.type==='input'&&n.props.name==='from').props.value,'2026-10-01')
 assert.equal(nodes.find(n=>n.type==='input'&&n.props.name==='to').props.min,'2026-10-01')
 assert.equal(nodes.find(n=>n.type==='select').props.defaultValue,'detailed')
})
test('configuration page owns the automation control and date filters; the saved grouping default is passed to the form',async()=>{
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/auth/context':{requireEmployee:async()=>({tenant_id:'tenant',role:'admin'})},
  '@/lib/billing/recurring-statements':{recurringPreview:async()=>({enabled:false})},'@/app/ops/faturacao/contas-corrente/RecurringStatementsPanel':{RecurringStatementsPanel:'automation'},
  '@/app/actions/billing-config':{getBillingConfigAction:async()=>({defaultGrouping:'detailed'}),getMoloniDetailsAction:async()=>({})},
  './components/BillingConfigClient':{BillingConfigClient:'config'},'./components/BillingViewFilters':{BillingViewFilters:'filters'}})
 const result=await load('app/ops/configuracao/faturacao/page.tsx').default({searchParams:Promise.resolve({from:'2026-10-01'})})
 const children=result.props.automationSettings.props.children
 assert.equal(children[0].type,'automation')
 assert.equal(children[1].type,'filters')
 assert.equal(children[1].props.initialSelection.startDate,'2026-10-01')
 assert.equal(children[1].props.initialSelection.grouping,'detailed')
})
