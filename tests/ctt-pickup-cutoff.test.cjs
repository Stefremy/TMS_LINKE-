const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {getCttPickupCutoff}=load('lib/ctt-pickup-cutoff.ts')
const {CTT_PICKUP_CUTOFFS}=load('lib/data/ctt-pickup-cutoffs.ts')
const base={postalCode:'4800-019',country:'PT',destination:'PT',date:'2026-10-19',period:'09:00-19:00'}
const check=(changes={},time='2026-10-19T10:00:00Z')=>getCttPickupCutoff({...base,...changes},new Date(time))

test('all 506 PDF prefixes are imported; final-column exceptions remain distinct from timed windows',()=>{
  assert.equal(Object.keys(CTT_PICKUP_CUTOFFS).length,506)
  // Independent visual checks of the supplied PDF: pages 1, 7, 8, 13.
  for(const cp of ['1000','4610','4650','4800','4805','4835']) assert.equal(check({postalCode:cp}).cutoff,'16:00')
  for(const cp of ['2205','4600','4640','4830','4960','9980']) assert.equal(check({postalCode:cp}).cutoff,'13:00')
  assert.equal(CTT_PICKUP_CUTOFFS['4960'][2],8)
})

test('national warnings use the pickup postal prefix, accepting 4 or 7 digits',()=>{
  for(const postalCode of ['4800','4800019','4800-019',' 4800-019 ']) assert.equal(check({postalCode}).state,'within')
  assert.equal(check({postalCode:'4600-001'},'2026-10-19T12:01:00Z').state,'passed')
  assert.equal(check({},'2026-10-19T12:01:00Z').state,'within')
})

test('warnings change within the last 30 minutes and at the exact cutoff',()=>{
  assert.equal(check({},'2026-10-19T14:29:00Z').state,'within')
  assert.equal(check({},'2026-10-19T14:30:00Z').state,'soon')
  assert.equal(check({},'2026-10-19T14:59:00Z').state,'soon')
  assert.equal(check({},'2026-10-19T15:00:00Z').state,'passed')
  assert.equal(check({},'2026-10-19T20:00:00Z').state,'passed')
})

test('tomorrow is not marked late just because today is after the cutoff; past and invalid dates are distinguished',()=>{
  assert.equal(check({date:'2026-10-20'},'2026-10-19T21:00:00Z').state,'future')
  assert.equal(check({date:'2026-10-18'}).state,'past')
  assert.equal(check({date:'2026-02-30'}).state,'unknown')
  assert.equal(check({date:''}).state,'unknown')
})

test('Lisbon and Azores local clocks respect summer and winter offsets, independently of browser timezone',()=>{
  assert.equal(check({postalCode:'9700-001'},'2026-10-19T12:30:00Z').state,'soon')
  assert.equal(check({postalCode:'9700-001'},'2026-10-19T13:00:00Z').state,'passed')
  assert.equal(check({postalCode:'9700-001',date:'2026-01-19'},'2026-01-19T13:30:00Z').state,'soon')
  assert.equal(check({date:'2026-01-19'},'2026-01-19T15:30:00Z').state,'soon')
})

test('unknown codes, invalid formats, foreign origins and other windows never inherit a guessed cutoff',()=>{
  for(const changes of [{postalCode:'9999-001'},{postalCode:'123'},{postalCode:''},{country:'ES'},{period:'10:00-13:00'},{destination:'XX'}]){
    const result=check(changes)
    assert.equal(result.state,'unknown');assert.equal(result.cutoff,undefined)
  }
})

test('PT to Spain/international uses the earlier webservice channel limit',()=>{
  for(const destination of ['ES','RM']){
    assert.equal(check({destination}).cutoff,'12:00')
    assert.equal(check({destination}).ruleSource,'channel')
    assert.equal(check({destination},'2026-10-19T11:00:00Z').state,'passed')
    assert.equal(check({destination,date:'2026-10-20'},'2026-10-19T21:00:00Z').state,'future')
  }
  assert.match(check({destination:'ES'}).message,/Portugal → Espanha/)
  assert.match(check({destination:'RM'}).message,/Portugal → Internacional/)
  assert.equal(check().ruleSource,'postal')
})

test('outbound channel rule does not require a domestic CP-table match or inherit its later cutoff',()=>{
  assert.equal(check({destination:'ES',postalCode:'9999-001'}).cutoff,'12:00')
  assert.equal(check({destination:'RM',postalCode:'4600-001'},'2026-10-19T11:00:00Z').state,'passed')
  assert.equal(check({},'2026-10-19T11:00:00Z').state,'within')
})

test('inbound references preserve the published 10h and D-1 rules without guessing foreign timezones',()=>{
  const spain=check({country:'ES',postalCode:'28001'})
  assert.equal(spain.state,'unknown');assert.equal(spain.cutoff,undefined);assert.match(spain.message,/10:00/)
  const other=check({country:'FR',postalCode:'75001'})
  assert.equal(other.state,'unknown');assert.match(other.message,/D-1/);assert.match(other.message,/sem indicar uma hora exata/)
  assert.equal(check({country:'ES',destination:'ES'}).state,'unknown')
})
