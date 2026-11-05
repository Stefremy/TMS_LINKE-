const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const names=['CHAT_TURN_URLS','CHAT_TURN_USERNAME','CHAT_TURN_CREDENTIAL','CHAT_TURN_FORCE_RELAY','CLOUDFLARE_TURN_KEY_ID','CLOUDFLARE_TURN_API_TOKEN']
function setup(t,env={},fetch=()=>{throw new Error('Unexpected network request')}){
 const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]))
 for(const name of names){delete process.env[name];if(env[name]!==undefined)process.env[name]=env[name]}
 t.after(()=>{for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name]}})
 return createLoader({zod:require('zod'),fetch})('lib/chat-call-ice.ts')
}
const iceServers=[{urls:['stun:stun.cloudflare.com:3478']},{urls:['turn:turn.cloudflare.com:3478?transport=udp','turns:turn.cloudflare.com:443?transport=tcp','turn:turn.cloudflare.com:53?transport=udp'],username:'temporary-user',credential:'temporary-credential'}]
test('without a relay, configuration reports direct-only mode and never claims TURN is ready',async t=>{
 const {getCallIceConfiguration}=setup(t)
 const result=await getCallIceConfiguration('tenant:user:room')
 assert.equal(result.relayConfigured,false);assert.equal(result.iceTransportPolicy,'all')
 assert.ok(result.iceServers.every(server=>!JSON.stringify(server.urls).includes('turn:')))
})
test('static TURN supports forced relay and rejects incomplete configuration',async t=>{
 const {getCallIceConfiguration}=setup(t,{CHAT_TURN_URLS:'turns:relay.example:443?transport=tcp',CHAT_TURN_USERNAME:'user',CHAT_TURN_CREDENTIAL:'credential',CHAT_TURN_FORCE_RELAY:'true'})
 const result=await getCallIceConfiguration('tenant:user:room')
 assert.equal(result.relayConfigured,true);assert.equal(result.iceTransportPolicy,'relay')
 delete process.env.CHAT_TURN_CREDENTIAL
 await assert.rejects(getCallIceConfiguration('other-room'),error=>error.status===503)
})
test('Cloudflare issues temporary participant credentials, keeps the provider token private, and does not regenerate on polling',async t=>{
 const requests=[]
 const {getCallIceConfiguration}=setup(t,{CLOUDFLARE_TURN_KEY_ID:'turn-key',CLOUDFLARE_TURN_API_TOKEN:'private-provider-token'},async(url,init)=>{requests.push({url,...init});return {ok:true,json:async()=>({iceServers})}})
 const first=await getCallIceConfiguration('tenant:user-a:room')
 await getCallIceConfiguration('tenant:user-a:room')
 assert.equal(requests.length,1)
 assert.equal(requests[0].url,'https://rtc.live.cloudflare.com/v1/turn/keys/turn-key/credentials/generate-ice-servers')
 assert.equal(requests[0].headers.Authorization,'Bearer private-provider-token')
 assert.deepEqual(JSON.parse(requests[0].body),{ttl:14400})
 assert.equal(first.relayConfigured,true)
 assert.ok(!JSON.stringify(first).includes('private-provider-token'))
 assert.ok(!JSON.stringify(first).includes(':53?'))
 assert.ok(JSON.stringify(first).includes('turns:turn.cloudflare.com:443?transport=tcp'))
 await getCallIceConfiguration('tenant:user-b:room')
 assert.equal(requests.length,2)
})
test('provider errors do not silently downgrade to a broken direct call and failed results can be retried',async t=>{
 let attempts=0
 const {getCallIceConfiguration}=setup(t,{CLOUDFLARE_TURN_KEY_ID:'key',CLOUDFLARE_TURN_API_TOKEN:'secret'},async()=>++attempts===1?{ok:false}:{ok:true,json:async()=>({iceServers})})
 await assert.rejects(getCallIceConfiguration('tenant:user:room'),error=>error.status===503 && !error.message.includes('secret'))
 assert.equal((await getCallIceConfiguration('tenant:user:room')).relayConfigured,true)
 assert.equal(attempts,2)
})
test('a forced relay or a partial Cloudflare setup cannot return an unusable success response',async t=>{
 const {getCallIceConfiguration}=setup(t,{CHAT_TURN_FORCE_RELAY:'true'})
 await assert.rejects(getCallIceConfiguration('room'),error=>error.status===503)
 process.env.CHAT_TURN_FORCE_RELAY='false';process.env.CLOUDFLARE_TURN_KEY_ID='key'
 await assert.rejects(getCallIceConfiguration('room'),error=>error.status===503)
})
