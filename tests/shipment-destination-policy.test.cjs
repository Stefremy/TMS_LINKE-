const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {isShipmentDestinationAvailable,assertShipmentDestinationAvailable} = createLoader({})('lib/services/shipment-destination-policy.ts')

test('customs countries are temporarily unavailable without changing customs implementation',()=>{
  for(const country of ['NO','GB','UK','CH','IS','US','CA','BR','CN','JP','AX','FO','GL']){
    assert.equal(isShipmentDestinationAvailable(country),false,country)
    assert.throws(()=>assertShipmentDestinationAvailable(country),/temporariamente indisponíveis/)
  }
  for(const country of ['PT','ES','BE','FR','DE','FI','SE','NL','IT','IE'])assert.equal(isShipmentDestinationAvailable(country),true,country)
})

test('customs territories cannot bypass the pause by selecting an EU country',()=>{
  for(const [country,postal] of [['ES','35001'],['ES','38001'],['ES','51001'],['ES','52001'],['DE','78266'],['DE','27498'],['GR','63086'],['IT','23030'],['FI','22100'],['FR','97100'],['FR','98800']]){
    assert.equal(isShipmentDestinationAvailable(country,postal),false,`${country} ${postal}`)
  }
  for(const [country,postal] of [['ES','28013'],['ES','07001'],['PT','9000-001'],['BE','1000'],['FI','00100'],['FR','75001']]){
    assert.equal(isShipmentDestinationAvailable(country,postal),true,`${country} ${postal}`)
  }
})
