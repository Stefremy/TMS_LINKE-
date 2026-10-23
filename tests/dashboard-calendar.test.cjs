const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {fakeSupabase} = require('./helpers/fake-supabase.cjs')

const TODAY = '2026-10-23'
function harness({role='employee',events=[],failure}={}) {
  const db=fakeSupabase({calendar_events:events},failure)
  let sessions=0
  const load=createLoader({
    '@/lib/auth/context':{getAuthContext:async()=>role?{role,user:{id:'fixture'}}:null},
    '@/lib/supabase/server':{createClient:async()=>{sessions++;return db.client}},
    '@/lib/billing/recurring-periods':{lisbonDate:()=>TODAY},
  })
  return {db,get:load('app/api/calendar/today/route.ts').GET,get sessions(){return sessions}}
}
for(const role of [null,'client']) {
  test(`calendar summary denies ${role||'anonymous'} before reading team events`,async()=>{
    const h=harness({role}),response=await h.get()
    assert.equal(response.status,role?403:401);assert.equal(h.sessions,0);assert.equal(h.db.queries.length,0)
    assert.match(response.headers.get('cache-control'),/private.*no-store/)
  })
}
test('an empty day is distinguished from an unavailable calendar',async()=>{
  const h=harness(),response=await h.get()
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),{date:TODAY,total:0,event:null})
})
for(const role of ['employee','admin']) {
  test(`${role} receives today's full count but only one compact event, with no emails or descriptions`,async()=>{
    const h=harness({role,events:[
      {id:'morning',event_date:TODAY,title:'Reunião da equipa',time:'09:00',creator_email:'private@example.invalid',description:'private'},
      {id:'afternoon',event_date:TODAY,title:'Planeamento',time:'14:00'},
      {id:'past',event_date:'2026-10-22',title:'Yesterday',time:'08:00'},
      {id:'future',event_date:'2026-10-24',title:'Tomorrow',time:'08:00'},
    ]})
    const response=await h.get(),data=await response.json()
    assert.equal(data.total,2);assert.deepEqual(data.event,{title:'Reunião da equipa',time:'09:00'})
    assert.doesNotMatch(JSON.stringify(data),/private|Yesterday|Tomorrow/)
    assert.equal(h.db.queries[0].projection,'title,time');assert.equal(h.db.queries[0].count,'exact');assert.equal(h.db.queries[0].limit,1)
    assert.ok(h.db.queries[0].filters.some(f=>f.field==='event_date'&&f.value===TODAY))
  })
}
test('all-day entries, including days within a holiday period, appear in the summary',async()=>{
  const h=harness({events:[{id:'leave',event_date:TODAY,title:'Férias',time:null},{id:'meeting',event_date:TODAY,title:'Reunião',time:'10:00'}]})
  const data=await (await h.get()).json()
  assert.equal(data.total,2);assert.deepEqual(data.event,{title:'Férias',time:null})
})
test('a failed calendar read returns unavailable rather than a misleading zero-event day',async()=>{
  const h=harness({failure:()=>({message:'private connection details'})}),response=await h.get()
  assert.equal(response.status,503)
  const body=await response.json();assert.equal(body.total,undefined);assert.equal(body.date,TODAY)
  assert.doesNotMatch(JSON.stringify(body),/private connection/)
})
