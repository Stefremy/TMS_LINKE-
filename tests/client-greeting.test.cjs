const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {clientGreeting}=createLoader({})('lib/greeting.ts')
const at=iso=>clientGreeting(new Date(iso))

test('time of day uses Lisbon time, including summer time',()=>{
 assert.equal(at('2026-11-25T09:00:00Z'),'Bom dia')
 assert.equal(at('2026-11-25T11:59:00Z'),'Bom dia')
 assert.equal(at('2026-11-25T12:00:00Z'),'Boa tarde')
 assert.equal(at('2026-11-25T20:00:00Z'),'Boa noite')
 assert.equal(at('2026-11-25T05:30:00Z'),'Boa noite')
 assert.equal(at('2026-07-15T11:30:00Z'),'Boa tarde') // 12:30 em Lisboa (UTC+1)
})

test('special occasions take priority over the time of day',()=>{
 assert.equal(at('2026-12-24T22:00:00Z'),'Feliz Natal')
 assert.equal(at('2026-12-26T10:00:00Z'),'Feliz Natal')
 assert.equal(at('2026-12-27T10:00:00Z'),'Bom dia')
 assert.equal(at('2026-12-31T10:00:00Z'),'Feliz Ano Novo')
 assert.equal(at('2027-01-01T23:30:00Z'),'Feliz Ano Novo')
 assert.equal(at('2027-01-02T00:30:00Z'),'Boa noite')
})

test('Easter and Carnival follow the moving date',()=>{
 // Páscoa 2026: 5 abril; 2027: 28 março
 assert.equal(at('2026-04-03T10:00:00Z'),'Boa Páscoa')
 assert.equal(at('2026-04-05T10:00:00Z'),'Boa Páscoa')
 assert.equal(at('2026-04-06T10:00:00Z'),'Bom dia')
 assert.equal(at('2026-04-02T10:00:00Z'),'Bom dia')
 assert.equal(at('2027-03-28T10:00:00Z'),'Boa Páscoa')
 assert.equal(at('2026-02-17T10:00:00Z'),'Bom Carnaval')
 assert.equal(at('2027-02-09T10:00:00Z'),'Bom Carnaval')
})
