const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const T = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
const room = 'call-12345678-1234-4234-8234-123456789abc'
const now = new Date().toISOString()
const invite = (sender=A, recipient=B, tenant=T) => ({ tenant_id:tenant, sender_id:sender, recipient_id:recipient, sender_name:'Caller', body:`[call:video:${room}:Conversa]`, created_at:now, sequence:1 })
function setup({ user=A, role='employee', rows=[invite()], logs=[] }={}) {
 const writes=[], reads=[]
 const tables={team_chat_messages:rows,audit_log:logs}
 const value=(row,path)=>path.split(/->>?/).reduce((current,key)=>current?.[key],row)
 const db={from(table){
  const filters=[];let take=Infinity,ascending=true,field='created_at',insert
  const q={select(){return q},eq(k,v){filters.push(row=>value(row,k)===v);return q},gte(k,v){filters.push(row=>value(row,k)>=v);return q},in(k,vs){filters.push(row=>vs.includes(value(row,k)));return q},like(){return q},order(k,o){field=k;ascending=o?.ascending!==false;return q},limit(n){take=n;return q},insert(row){insert=row;return q},then(resolve,reject){return Promise.resolve().then(()=>{
   if(insert){writes.push(insert);tables[table].push(insert);return {data:null,error:null}}
   reads.push(table)
   const data=tables[table].filter(row=>filters.every(f=>f(row))).sort((a,b)=>String(a[field]).localeCompare(String(b[field]))*(ascending?1:-1)).slice(0,take)
   return {data,error:null}
  }).then(resolve,reject)}};return q
 }}
 const context=user?{user:{id:user,email:'employee@example.com',user_metadata:{name:'Verified employee'}},role,tenant_id:T}:null
 const load=createLoader({
  zod:require('zod'), 'server-only':{},
  'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200})}},
  '@/lib/auth/context':{getAuthContext:async()=>context},
  '@/lib/auth/profile':{},'@/lib/team-chat-avatars':{},
  '@/lib/supabase/server':{createAdminClient:()=>db},
 })
 return {context,service:load('lib/team-chat-calls.ts'),api:load('app/api/ops/chat/calls/route.ts'),writes,reads}
}

test('call signals are restricted to the signed-in private participants, including for administrators',async()=>{
 for(const role of ['employee','admin']){
  const h=setup({user:C,role})
  await assert.rejects(h.service.requireCallRoom(h.context,room),error=>error.status===404)
  assert.equal(h.writes.length,0)
 }
 const h=setup({user:B})
 assert.equal((await h.service.requireCallRoom(h.context,room)).sender_id,A)
 const foreign=setup({rows:[invite(A,B,OTHER)]})
 await assert.rejects(foreign.service.requireCallRoom(foreign.context,room),error=>error.status===404)
 const copied=setup({user:C,role:'admin',rows:[invite(),{...invite(C,null),sequence:2}]})
 await assert.rejects(copied.service.requireCallRoom(copied.context,room),error=>error.status===404)
})

test('incoming calls include only fresh invitations visible to this user and exclude cancelled calls',async()=>{
 const h=setup({user:B,rows:[invite(),{...invite(C,A),sequence:2},{...invite(A,B,OTHER),sequence:3},{...invite(),body:'[call:audio:expired-room:Old]',created_at:'2020-01-01T00:00:00Z'}]})
 assert.deepEqual((await h.service.readIncomingCalls(h.context)).map(call=>call.roomId),[room])
 const cancelled=setup({user:B,logs:[{tenant_id:T,action:'team_chat_call_signal',created_at:now,details:{room_id:room,signal:{type:'leave'}}}]})
 assert.deepEqual(await cancelled.service.readIncomingCalls(cancelled.context),[])
})

test('signal identities come from the verified session and malformed/expired signals cannot be stored',async()=>{
 const h=setup()
 await h.service.writeCallSignal(h.context,room,{id:C,instance:'browser-a',type:'join',senderId:B,senderName:'Forged'})
 assert.equal(h.writes[0].tenant_id,T)
 assert.equal(h.writes[0].details.sender_id,A)
 assert.equal(h.writes[0].details.sender_name,'Verified employee')
 assert.equal(h.writes[0].details.signal.senderName,undefined)
 await assert.rejects(h.service.writeCallSignal(h.context,room,{id:B,instance:'b',type:'offer',sdp:{type:'answer',sdp:'bad'}}),error=>error.status===400)
 const old=setup({rows:[{...invite(),created_at:'2020-01-01T00:00:00Z'}]})
 await assert.rejects(old.service.writeCallSignal(old.context,room,{id:C,instance:'a',type:'join'}),error=>error.status===404)
})

test('the signaling API denies anonymous/client sessions, changed logins and cross-origin writes before persistence',async()=>{
 for(const options of [{user:null},{role:'client'}]){
  const h=setup(options)
  const response=await h.api.GET(new Request('https://ops.toke.pt/api/ops/chat/calls?incoming=1'))
  assert.ok([401,403].includes(response.status));assert.equal(h.reads.length,0)
 }
 const h=setup()
 assert.equal((await h.api.GET(new Request(`https://ops.toke.pt/api/ops/chat/calls?viewer=${B}&incoming=1`))).status,409)
 const request=origin=>new Request('https://ops.toke.pt/api/ops/chat/calls',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({viewerId:A,room,signal:{id:C,instance:'a',type:'join'}})})
 assert.equal((await h.api.POST(request('https://bad.example'))).status,403)
 assert.equal(h.writes.length,0)
 assert.equal((await h.api.POST(request('https://ops.toke.pt'))).status,200)
 assert.equal(h.writes.length,1)
})

function fakePeer(){
 const events=[]
 return {events,signalingState:'stable',remoteDescription:null,localDescription:null,
 async createOffer(){return {type:'offer',sdp:'offer'}},async createAnswer(){return {type:'answer',sdp:'answer'}},
 async setLocalDescription(sdp){this.localDescription={...sdp,toJSON:()=>sdp};this.signalingState=sdp.type==='offer'?'have-local-offer':'stable';events.push(`local:${sdp.type}`)},
 async setRemoteDescription(sdp){this.remoteDescription=sdp;this.signalingState=sdp.type==='offer'?'have-remote-offer':'stable';events.push(`remote:${sdp.type}`)},
 async addIceCandidate(){assert.ok(this.remoteDescription,'must have remote SDP before ICE');events.push('ice')},
 }
}
const signal=(type,extra={})=>({id:crypto.randomUUID(),instance:'browser-a',senderId:A,senderName:'Caller',type,createdAt:now,...extra})
test('early ICE is queued until remote SDP and negotiation sends a valid answer',async()=>{
 const {createCallNegotiator}=createLoader({})('lib/chat-call-peer.ts')
 const pc=fakePeer(),sent=[]
 const peer=createCallNegotiator(pc,{instance:'browser-b',hasVideo:()=>true,send:s=>sent.push(s),onPeer(){},onLeave(){},onError:e=>{throw e}})
 await peer.handle(signal('ice',{candidate:{candidate:'test'}}))
 assert.deepEqual(pc.events,[])
 await peer.handle(signal('offer',{sdp:{type:'offer',sdp:'offer'}}))
 assert.deepEqual(pc.events,['remote:offer','ice','local:answer'])
 assert.equal(sent[0].type,'answer');assert.equal(sent[0].target,'browser-a')
})

test('simultaneous offers use polite rollback and unrelated browser signals cannot overwrite the peer',async()=>{
 const {createCallNegotiator}=createLoader({})('lib/chat-call-peer.ts')
 const pc=fakePeer();pc.signalingState='have-local-offer'
 const peer=createCallNegotiator(pc,{instance:'browser-b',hasVideo:()=>false,send(){},onPeer(){},onLeave(){},onError:e=>{throw e}})
 await peer.handle(signal('offer',{sdp:{type:'offer',sdp:'offer'}}))
 assert.equal(pc.signalingState,'stable')
 const before=pc.events.length
 await peer.handle(signal('offer',{instance:'third-browser',sdp:{type:'offer',sdp:'third'}}))
 assert.equal(pc.events.length,before)
 const impolite=fakePeer();impolite.signalingState='have-local-offer'
 const other=createCallNegotiator(impolite,{instance:'browser-0',hasVideo:()=>false,send(){},onPeer(){},onLeave(){},onError:e=>{throw e}})
 await other.handle(signal('offer',{sdp:{type:'offer',sdp:'offer'}}))
 assert.deepEqual(impolite.events,[])
})

test('the HTTP transport retries the same signal id, deduplicates polling and delivers hangup after closing',async()=>{
 const delivered=[],posts=[];let postAttempts=0,reads=0,joined,hangup
 const gotSignal=new Promise(resolve=>{joined=resolve}),gotHangup=new Promise(resolve=>{hangup=resolve})
 const event=signal('join')
 const load=createLoader({fetch:async(_url,init)=>{
  if(init?.method==='POST'){
   const body=JSON.parse(init.body);posts.push(body)
   if(body.signal.type==='join' && postAttempts++===0) throw new Error('Temporary disconnect')
   if(body.signal.type==='leave') hangup()
   return {ok:true,json:async()=>({success:true})}
  }
  reads++
  return {ok:true,json:async()=>({viewerId:B,iceServers:[],signals:[event,event]})}
 }})
 const {openCallTransport}=load('lib/chat-call-transport.ts')
 const transport=await openCallTransport({room,viewer:B,instance:'browser-b',onError:e=>{throw e}})
 transport.send({type:'join'})
 transport.start(async message=>{delivered.push(message.id);joined()})
 await gotSignal
 await new Promise(setImmediate)
 transport.close()
 await gotHangup
 assert.deepEqual(delivered,[event.id])
 const retries=posts.filter(post=>post.signal.type==='join')
 assert.equal(retries.length,2)
 assert.equal(retries[0].signal.id,retries[1].signal.id)
 assert.equal(posts.at(-1).signal.type,'leave')
 assert.ok(reads>=1)
})
