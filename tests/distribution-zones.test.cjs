const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {getDistributionZoneGroups,filterDistributionZones}=createLoader({})('lib/services/geo/distribution-zones.ts')
const groups=getDistributionZoneGroups()

test('the two CTT road zones contain 25 unique countries with Finland in Zone 3',()=>{
 const road=groups.find(g=>g.id==='ctt_road')
 assert.deepEqual(road.zones.map(z=>[z.code,z.countries.length]),[['Zona 2',17],['Zona 3',8]])
 assert.ok(road.zones[0].countries.some(c=>c.code==='GB'&&c.name==='Reino Unido'))
 assert.ok(road.zones[1].countries.some(c=>c.code==='FI'&&c.name==='Finlândia'))
 const codes=road.zones.flatMap(z=>z.countries.map(c=>c.code))
 assert.equal(new Set(codes).size,25);assert.equal(codes.includes('UK'),false)
 assert.equal(codes.includes('ES'),false);assert.equal(codes.includes('US'),false)
})
test('Correos exposes all eight international groups and resolves country/zone ISO collisions',()=>{
 const zones=groups.find(g=>g.id==='correos_international').zones
 assert.deepEqual(zones.map(z=>z.code),['EU 1','EU 2','EU 3','NA','SA','O1','O2','A'])
 for(const [code,country] of [['EU 3','FI'],['NA','US'],['O2','SA'],['A','NA'],['SA','BA'],['EU 1','GB']]){
  assert.ok(zones.find(z=>z.code===code).countries.some(c=>c.code===country),`${country} belongs to ${code}`)
 }
 const all=zones.flatMap(z=>z.countries)
 assert.equal(all.length,new Set(all.map(c=>c.code)).size)
 assert.ok(all.every(c=>/^[A-Z]{2}$/.test(c.code)&&c.name))
})
test('CTT air follows Cana.pdf numbered zones rather than the Correos international mapping',()=>{
 const air=groups.find(g=>g.id==='ctt_air')
 assert.deepEqual(air.zones.map(z=>[z.code,z.countries.length]),[
  ['Zona 2',12],['Zona 3',12],['Zona 4',2],['Zona 5',74],['Zona 6',105],['Zona 8',1],
 ])
 for(const [zone,countries] of [
  ['Zona 2',['GR','GB']],['Zona 3',['FI','GG','JE','MT','SE']],['Zona 4',['CA','US']],
  ['Zona 5',['AO','BA','IR','GW','XK','TJ','MX']],['Zona 6',['CN','QA','BQ','SH','SX','GF','NA']],['Zona 8',['BR']],
 ]) for(const code of countries) assert.ok(air.zones.find(z=>z.code===zone).countries.some(c=>c.code===code),`${code} belongs to ${zone}`)
 const all=air.zones.flatMap(z=>z.countries.map(c=>c.code))
 assert.equal(all.length,new Set(all).size)
 assert.equal(all.includes('ES'),false)
 assert.deepEqual(air.zones.find(z=>z.code==='Zona 8').countries,[{code:'BR',name:'Brasil'}])
 assert.notEqual(air.zones,groups.find(g=>g.id==='correos_international').zones)
})
test('country, ISO and zone searches are accent-insensitive and do not mutate the mappings',()=>{
 const before=JSON.stringify(groups)
 for(const [id,code] of [['ctt_road','Zona 3'],['ctt_air','Zona 3'],['correos_international','EU 3']]){
  const zones=groups.find(g=>g.id===id).zones
  for(const query of ['finlandia','Finlândia',' fi ']){
   const found=filterDistributionZones(zones,query)
   assert.equal(found.length,1);assert.equal(found[0].code,code)
   assert.deepEqual(found[0].countries.map(c=>c.code),['FI'])
  }
  assert.deepEqual(filterDistributionZones(zones,'unknown-destination'),[])
  assert.equal(filterDistributionZones(zones,''),zones)
 }
 assert.deepEqual(filterDistributionZones(groups.find(g=>g.id==='correos_international').zones,'A').map(z=>z.code),['A'])
 const air=groups.find(g=>g.id==='ctt_air').zones
 for(const [query,iso] of [['bonaire','BQ'],['ascensao','SH'],['sint maarten','SX']]){
  assert.deepEqual(filterDistributionZones(air,query).flatMap(z=>z.countries.map(c=>c.code)),[iso])
 }
 assert.equal(JSON.stringify(groups),before)
})
test('the page switches carriers and filters the country tables without showing development placeholders',()=>{
 let cursor=0;const state=[]
 const jsx=(type,props)=>({type,props:props||{}})
 const load=createLoader({react:{useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=value}]},useMemo:fn=>fn()},
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{__esModule:true,default:'a'},'lucide-react':new Proxy({},{get:(_,key)=>key})})
 const Component=load('app/ops/configuracao/zonas/components/DistributionZonesClient.tsx').DistributionZonesClient
 const flatten=node=>Array.isArray(node)?node.flatMap(flatten):node&&typeof node==='object'?[node,...flatten(node.props.children)]:[]
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props.children):String(node??'')
 const render=()=>{cursor=0;return flatten(Component({groups}))}
 let nodes=render()
 assert.equal(nodes.filter(n=>n.type==='table').length,2)
 assert.doesNotMatch(nodes.map(text).join(' '),/Em Desenvolvimento|Em Breve/)
 nodes.find(n=>n.type==='button'&&text(n).includes('Internacional Aéreo · Guia EE')).props.onClick()
 nodes=render();assert.equal(nodes.filter(n=>n.type==='table').length,6)
 nodes.find(n=>n.type==='input'&&n.props.id==='zone-country-search').props.onChange({target:{value:'Brasil'}})
 nodes=render();assert.equal(nodes.filter(n=>n.type==='table').length,1)
 assert.match(nodes.map(text).join(' '),/Zona 8/)
 nodes.find(n=>n.type==='button'&&n.props['aria-label']==='Limpar pesquisa').props.onClick()
 assert.equal(render().filter(n=>n.type==='table').length,6)
 nodes=render()
 nodes.find(n=>n.type==='button'&&text(n).includes('Correos Express')).props.onClick()
 nodes=render();assert.equal(nodes.filter(n=>n.type==='table').length,8)
 nodes.find(n=>n.type==='input'&&n.props.id==='zone-country-search').props.onChange({target:{value:'finlandia'}})
 nodes=render();assert.equal(nodes.filter(n=>n.type==='table').length,1)
 assert.match(nodes.map(text).join(' '),/EU 3/);assert.match(nodes.map(text).join(' '),/Finlândia/)
 nodes.find(n=>n.type==='button'&&n.props['aria-label']==='Limpar pesquisa').props.onClick()
 assert.equal(render().filter(n=>n.type==='table').length,8)
})
