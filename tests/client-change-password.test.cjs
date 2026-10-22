const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const input={currentPassword:'old-fixture-password',password:'new-fixture-password',confirmation:'new-fixture-password'}
function harness(options={}){
  const calls={created:0,signIn:[],update:[],signOut:[]}
  const ctx={role:'client',client_id:'store-a',user:{id:'user-a',email:'owner@example.invalid'},...options.ctx}
  const load=createLoader({
    '@/lib/auth/context':{requireUser:async()=>{if(options.denied)throw Error('ACCESS_DENIED');return ctx}},
    '@supabase/supabase-js':{createClient:(url,key,config)=>{
      calls.created++;assert.equal(key,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      assert.deepEqual(config.auth,{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false})
      return{auth:{
        signInWithPassword:async data=>{calls.signIn.push(data);return{data:{user:{id:options.otherUser?'user-b':'user-a'},session:options.badPassword?null:{access_token:'fixture-only'}},error:options.badPassword?{message:'private provider detail'}:null}},
        updateUser:async data=>{calls.update.push(data);if(options.throwUpdate)throw Error('private provider detail');return{data:{user:{id:'user-a'}},error:options.updateError?{message:'private provider detail'}:null}},
        signOut:async data=>{calls.signOut.push(data)},
      }}
    }},
  })
  return{calls,change:load('app/actions/client-change-password.ts').changeClientPasswordAction}
}
test('only the current client can change their own password, using their server-verified email and an isolated session',async()=>{
  const h=harness()
  const result=await h.change({...input,userId:'user-b',email:'victim@example.invalid',clientId:'other-store'})
  assert.deepEqual(result,{success:true})
  assert.deepEqual(h.calls.signIn,[{email:'owner@example.invalid',password:input.currentPassword}])
  assert.deepEqual(h.calls.update,[{password:input.password,current_password:input.currentPassword}])
  assert.deepEqual(h.calls.signOut,[{scope:'local'}])
  assert.doesNotMatch(JSON.stringify(result),/fixture-password|access_token/)
})
test('employees, including impersonating operators, and invalid sessions cannot update a client password',async()=>{
  for(const ctx of [{role:'admin'},{role:'employee'},{client_id:null},{user:null}]){
    const h=harness({ctx});assert.equal((await h.change(input)).success,false);assert.equal(h.calls.created,0)
  }
  const h=harness({denied:true});await assert.rejects(h.change(input),/ACCESS_DENIED/);assert.equal(h.calls.created,0)
})
test('missing current password, mismatched confirmation, unsafe lengths and unchanged passwords fail before contacting Auth',async()=>{
  for(const value of [null,{...input,currentPassword:''},{...input,password:'short'},{...input,confirmation:'different'},
    {...input,password:'a'.repeat(129),confirmation:'a'.repeat(129)},
    {...input,password:input.currentPassword,confirmation:input.currentPassword}]){
    const h=harness();assert.equal((await h.change(value)).success,false);assert.equal(h.calls.created,0)
  }
})
test('a wrong current password or a different authenticated identity never reaches the password update',async()=>{
  for(const options of [{badPassword:true},{otherUser:true}]){
    const h=harness(options),result=await h.change(input)
    assert.equal(result.success,false);assert.match(result.error,/palavra-passe atual/);assert.equal(h.calls.update.length,0)
    assert.equal(h.calls.signOut.length,options.otherUser?1:0)
  }
})
test('update failures do not claim success, expose provider errors or leave the verification session open',async()=>{
  for(const options of [{updateError:true},{throwUpdate:true}]){
    const h=harness(options),result=await h.change(input)
    assert.equal(result.success,false);assert.doesNotMatch(JSON.stringify(result),/private provider|fixture-password/)
    assert.deepEqual(h.calls.signOut,[{scope:'local'}])
  }
})
test('the account Security tab is offered only in the client view',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const load=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
    '@/app/actions/servicos-linke':{},'./ClientChangePasswordForm':{ClientChangePasswordForm:()=>null}})
  const Modal=load('app/app/components/ClientAccountDetailsModal.tsx').ClientAccountDetailsModal
  const render=canChangePassword=>renderToStaticMarkup(React.createElement(Modal,{isOpen:true,onClose(){},client:{id:'a',short_name:'Store A'},canChangePassword}))
  assert.match(render(true),/Segurança/);assert.doesNotMatch(render(false),/Segurança/)
})

test('password form blocks mismatched confirmation, shows loading and clears credentials after success',async t=>{
  const slots=[],calls=[];let cursor=0,finish,resets=0
  const original=global.FormData
  let values={...input}
  global.FormData=class{get(name){return values[name]}}
  t.after(()=>{global.FormData=original})
  const jsx=(type,props)=>({type,props:props||{}})
  const load=createLoader({
    react:{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=value}]}},
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'lucide-react':new Proxy({},{get:(_,name)=>name}),
    '@/app/actions/client-change-password':{changeClientPasswordAction:data=>{calls.push(data);return new Promise(resolve=>{finish=resolve})}},
  })
  const Form=load('app/app/components/ClientChangePasswordForm.tsx').ClientChangePasswordForm
  const flat=node=>Array.isArray(node)?node.flatMap(flat):node&&typeof node==='object'?[node,...flat(node.props.children)]:[]
  const render=()=>{cursor=0;return flat(Form())}
  const event={preventDefault(){},currentTarget:{reset(){resets++}}}
  values.confirmation='different';await render().find(n=>n.type==='form').props.onSubmit(event)
  assert.equal(calls.length,0);assert.ok(render().some(n=>n.props.role==='alert'))
  values={...input};const pending=render().find(n=>n.type==='form').props.onSubmit(event)
  assert.ok(render().filter(n=>n.type==='input').every(n=>n.props.disabled&&n.props.type==='password'))
  assert.equal(render().find(n=>n.type==='button').props.disabled,true)
  finish({success:true});await pending
  assert.equal(resets,1);assert.equal(render().find(n=>n.type==='button').props.disabled,false)
  assert.ok(render().some(n=>n.props.role==='status'))
})
