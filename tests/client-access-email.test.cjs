const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

test('email delegation grants Aldara and permitted employees without granting client/admin capabilities',()=>{
  const {canSendClientAccessEmail}=createLoader({})('lib/auth/client-access-email.ts')
  const ctx={role:'employee',user:{email:' ALDARA.LINKE@GMAIL.COM '},permissions:[]}
  assert.equal(canSendClientAccessEmail(ctx),true)
  assert.equal(canSendClientAccessEmail({...ctx,user:{email:'clientes@linke.pt'}}),true)
  assert.equal(canSendClientAccessEmail({...ctx,user:{email:'other@example.invalid'}}),false)
  assert.equal(canSendClientAccessEmail({...ctx,user:{email:'other@example.invalid'},permissions:['Enviar email de acesso ao cliente']}),true)
  assert.equal(canSendClientAccessEmail({...ctx,role:'client'}),false)
  assert.equal(canSendClientAccessEmail(null),false)
  assert.equal(canSendClientAccessEmail({...ctx,role:'admin',user:{email:'admin@example.invalid'}}),true)
})

function renderComponent(file,exportName,props={}){
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const load=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
    '@/app/actions/auth':{},'@/app/actions/client-invitations':{},'@/app/actions/client-change-password':{}})
  return renderToStaticMarkup(React.createElement(load(file)[exportName],props))
}

test('delegated email modal hides manual password controls and locks the recipient to the saved email',()=>{
  const props={clientId:'fixture',clientName:'Fixture client',clientEmail:'client@example.invalid',onClose(){}}
  const delegated=renderComponent('app/ops/entidades/clientes/components/ClientAuthModal.tsx','ClientAuthModal',props)
  assert.match(delegated,/Enviar email de palavra-passe/)
  assert.doesNotMatch(delegated,/Definir palavra-passe manualmente/)
  assert.match(delegated,/<input[^>]*id="client-access-email"[^>]*readOnly=""/)
  const admin=renderComponent('app/ops/entidades/clientes/components/ClientAuthModal.tsx','ClientAuthModal',{...props,allowManualPassword:true})
  assert.match(admin,/Definir palavra-passe manualmente/)
})

test('delegated staff see the client Access tab and email button without administrator controls',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const load=createLoader({
    react:{...React,useState:initial=>React.useState(initial==='geral'?'acesso':initial)},
    'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
    '@/app/actions/clientes':{},'@/app/actions/client-invitations':{},
    './ClientPortalAccessControl':{ClientPortalAccessControl:()=>React.createElement('p',null,'ADMIN_ACCESS_CONTROLS')},
  })
  const Modal=load('app/ops/entidades/clientes/components/ClienteModal.tsx').ClienteModal
  const render=permissions=>renderToStaticMarkup(React.createElement(Modal,{initialData:{id:'fixture',short_name:'Fixture client',email:'client@example.invalid'},onManageAccess(){},onClose(){},onSaved(){},...permissions}))
  const delegated=render({canManageAccess:false,canSendAccessEmail:true})
  assert.match(delegated,/Acesso à Área do Cliente/)
  assert.match(delegated,/Enviar email de palavra-passe/)
  assert.doesNotMatch(delegated,/ADMIN_ACCESS_CONTROLS/)
  const denied=render({canManageAccess:false,canSendAccessEmail:false})
  assert.doesNotMatch(denied,/Acesso à Área do Cliente/)
  assert.match(render({canManageAccess:true,canSendAccessEmail:true}),/ADMIN_ACCESS_CONTROLS/)
})

