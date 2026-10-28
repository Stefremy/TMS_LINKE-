const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {ShipmentVolumetricSummary}=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime')})('components/shipments/ShipmentVolumetricSummary.tsx')
const service=code=>({id:'fixture',webservice_service_code:code,preferred_carrier_name:'CTT Expresso',zones:[{zone_code:'PT-ILHAS',tiers:[]}],allowed_zones:['PT-ILHAS']})
const render=props=>renderToStaticMarkup(React.createElement(ShipmentVolumetricSummary,{country:'PT',postal:'9000-001',weightKg:10,lengthCm:50,widthCm:40,heightCm:40,volumesCount:1,...props}))

for(const [code,expected,divisor] of [['EMSF056.01','13,333',6000],['EMSF057.01','26,667',3000],['EMSF001.02','16',5000],['ENCF008.02','16',5000]]){
  test(`${code}: the visible parcel summary uses its own divisor even without a configured tariff`,()=>{
    const markup=render({service:service(code)})
    assert.match(markup,new RegExp(`Peso volumétrico: <strong>${expected} kg`))
    assert.match(markup,new RegExp(`Divisor do serviço: ${divisor}`))
    assert.match(markup,/aria-live="polite"/)
  })
}
test('incomplete data requests the missing inputs instead of displaying fictitious weights',()=>{
  assert.match(render({service:service('EMSF056.01'),heightCm:0}),/Preencha o país/)
  assert.match(render({service:service('EMSF057.01'),postal:''}),/código postal/)
  assert.doesNotMatch(render({service:service('EMSF056.01'),heightCm:0}),/NaN|Infinity|Peso volumétrico: <strong>/)
})
test('multi-volume results show the total and preserve the higher real weight',()=>{
  assert.match(render({service:service('EMSF057.01'),volumesCount:2}),/53,333 kg/)
  assert.match(render({service:service('EMSF057.01'),volumesCount:2}),/Total dos 2 volumes/)
  assert.match(render({service:service('EMSF056.01'),weightKg:20}),/Peso usado na tarifa: 20 kg/)
})
