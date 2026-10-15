const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

function drawerHarness(t,{desktop=false,overflow='auto',open=true}={}){
  const previous={window:global.window,document:global.document}
  let effect,resize,closed=0,focused=0,restored=0,showCalls=0
  const dialog={open:false,showModal(){this.open=true;showCalls++},close(){this.open=false},querySelector:()=>({focus(){focused++}})}
  const media={matches:desktop,addEventListener(name,handler){assert.equal(name,'change');resize=handler},removeEventListener(name,handler){assert.equal(handler,resize)}}
  global.window={matchMedia:()=>media}
  global.document={body:{style:{overflow}},activeElement:{isConnected:true,focus(){restored++}}}
  t.after(()=>{global.window=previous.window;global.document=previous.document})
  const load=createLoader({react:{useRef:()=>({current:dialog}),useEffect:callback=>{effect=callback}},'react/jsx-runtime':{jsx:(type,props)=>({type,props})}})
  const {MobileDrawer}=load('components/ui/mobile-drawer.tsx')
  const element=MobileDrawer({open,onClose:()=>{closed++},label:'Navigation',id:'fixture-menu',children:'Links'})
  return {dialog,element,start:()=>effect(),resize:()=>resize({matches:true}),get closed(){return closed},get focused(){return focused},get restored(){return restored},get showCalls(){return showCalls}}
}

test('Mobile menu opens as a native modal, focuses close, and restores scroll and focus on cleanup',t=>{
  const h=drawerHarness(t)
  const cleanup=h.start()
  assert.equal(h.element.type,'dialog');assert.equal(h.element.props['aria-label'],'Navigation')
  assert.equal(h.showCalls,1);assert.equal(h.focused,1)
  assert.equal(document.body.style.overflow,'hidden')
  cleanup()
  assert.equal(h.dialog.open,false);assert.equal(document.body.style.overflow,'auto');assert.equal(h.restored,1)
})
test('Closing a menu preserves an existing body scroll lock',t=>{
  const h=drawerHarness(t,{overflow:'hidden'});const cleanup=h.start();cleanup()
  assert.equal(document.body.style.overflow,'hidden')
})
test('Switching to desktop closes the mobile menu instead of leaving the page inert',t=>{
  const h=drawerHarness(t);const cleanup=h.start();h.resize()
  assert.equal(h.closed,1);cleanup()
})
test('A desktop menu never opens a modal or locks scrolling',t=>{
  const h=drawerHarness(t,{desktop:true});assert.equal(h.start(),undefined)
  assert.equal(h.showCalls,0);assert.equal(h.closed,1);assert.equal(document.body.style.overflow,'auto')
})
test('Escape, backdrop and navigation links request closure; content clicks keep it open',t=>{
  const h=drawerHarness(t);let prevented=false
  h.element.props.onCancel({preventDefault(){prevented=true}})
  assert.equal(prevented,true);assert.equal(h.closed,1)
  h.element.props.onClick({target:h.dialog,currentTarget:h.dialog})
  assert.equal(h.closed,2)
  h.element.props.onClick({target:{closest:()=>({href:'/same-page'})},currentTarget:h.dialog})
  assert.equal(h.closed,3)
  h.element.props.onClick({target:{closest:()=>null},currentTarget:h.dialog})
  assert.equal(h.closed,3)
})
test('Client mobile navigation preserves scoped store links and keeps OPS access for staff only',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  function render(isEmployee){
    const scope={client:{id:'store-a',short_name:'A very long store name'},basePath:'/app/store-a',isEmployee}
    const load=createLoader({
      react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
      'next/navigation':{usePathname:()=>'/app/store-a/envios'},
      'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
      'next/image':{__esModule:true,default:({src,alt,width,height})=>React.createElement('img',{src,alt,width,height})},
      './ClientScope':{useClientScope:()=>scope},
      './ClientImpersonationBanner':{ClientProfileSidebar:()=>null},
      './ClientAccountDetailsModal':{ClientAccountDetailsModal:()=>null},
      '@/app/login/actions':{signout:async()=>{}},
    })
    return renderToStaticMarkup(React.createElement(load('app/app/components/ClientMobileNav.tsx').ClientMobileNav))
  }
  const client=render(false)
  assert.match(client,/aria-controls="client-mobile-menu"/)
  assert.match(client,/<dialog[^>]+id="client-mobile-menu"/)
  assert.match(client,/href="\/app\/store-a\/criar-guia"/)
  assert.match(client,/aria-current="page"/)
  assert.ok(!client.includes('href="/ops/'))
  assert.ok(render(true).includes('href="/ops/entidades/clientes"'))
})

test('A closed menu does not lock scrolling or request focus',t=>{
  const h=drawerHarness(t,{open:false});assert.equal(h.start(),undefined)
  assert.equal(h.showCalls,0);assert.equal(h.closed,0);assert.equal(h.focused,0)
  assert.equal(document.body.style.overflow,'auto')
})

test('Opening account details closes the navigation and renders the account modal outside it',()=>{
  const slots=[];let cursor=0
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value}]},
    useEffect(){},useCallback:fn=>fn,
  }
  const jsx=(type,props)=>({type,props:props||{}})
  const load=createLoader({
    react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next/link':{default:'link'},'next/image':{default:'image'},
    'next/navigation':{usePathname:()=>'/app/store-a'},
    'lucide-react':new Proxy({},{get:(_,name)=>String(name)}),
    './ClientScope':{useClientScope:()=>({client:{short_name:'Store A'},basePath:'/app/store-a',isEmployee:false})},
    './ClientImpersonationBanner':{ClientProfileSidebar:'profile'},
    './ClientAccountDetailsModal':{ClientAccountDetailsModal:'account'},
    './ClientSidebarNav':{ClientSidebarNav:'navigation'},
    '@/components/ui/mobile-drawer':{MobileDrawer:'drawer'},
    '@/app/login/actions':{signout:async()=>{}},
  })
  const Component=load('app/app/components/ClientMobileNav.tsx').ClientMobileNav
  const flatten=node=>Array.isArray(node)?node.flatMap(flatten):node&&typeof node==='object'?[node,...flatten(node.props?.children)]:[]
  const render=()=>{cursor=0;return flatten(Component())}
  render().find(n=>n.props['aria-label']==='Abrir menu do cliente').props.onClick()
  assert.equal(render().find(n=>n.type==='drawer').props.open,true)
  render().find(n=>n.type==='profile').props.onOpenDetails()
  const nodes=render(),drawer=nodes.find(n=>n.type==='drawer')
  assert.equal(drawer.props.open,false)
  assert.equal(nodes.find(n=>n.type==='account').props.isOpen,true)
  assert.ok(!flatten(drawer.props.children).some(n=>n.type==='account'))
})
