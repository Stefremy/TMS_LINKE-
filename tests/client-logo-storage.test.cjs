const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {storeClientLogo}=createLoader({'server-only':{}})('lib/client-logo.ts')

function bucketDb(){
 const uploads=[]
 return{uploads,storage:{from:name=>({
  upload:async(path,bytes,opts)=>{uploads.push({name,path,bytes,opts});return{error:null}},
  getPublicUrl:path=>({data:{publicUrl:`https://cdn.fixture/${path}`}}),
 })}}
}
const jpeg=Buffer.from([255,216,255,224,0,16]).toString('base64')

test('a JPEG labelled as PNG is uploaded as JPEG and replaced by its public URL',async()=>{
 const db=bucketDb()
 const url=await storeClientLogo(db,'t1','c1',`data:image/png;base64,${jpeg}`)
 assert.equal(db.uploads.length,1)
 assert.equal(db.uploads[0].name,'avatars')
 assert.equal(db.uploads[0].opts.contentType,'image/jpeg')
 assert.match(db.uploads[0].path,/^t1\/client-logos\/c1\/[0-9a-f-]+\.jpg$/)
 assert.equal(url,`https://cdn.fixture/${db.uploads[0].path}`)
})

test('URLs, SVG and empty values are left unchanged and nothing is uploaded',async()=>{
 const db=bucketDb()
 const svg=`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`
 for(const value of ['https://x/logo.png',svg,'']) assert.equal(await storeClientLogo(db,'t1','c1',value),value)
 assert.equal(db.uploads.length,0)
})

test('logos over 2 MB are refused',async()=>{
 const big=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(2*1024*1024)]).toString('base64')
 await assert.rejects(storeClientLogo(bucketDb(),'t1','c1',`data:image/jpeg;base64,${big}`),/2 MB/)
})
