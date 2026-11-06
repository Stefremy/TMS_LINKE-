const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const http = require('node:http'), https = require('node:https'), { execFileSync } = require('node:child_process')
const { createLoader } = require('./helpers/load-typescript.cjs')
const soap = () => new (createLoader({ http, https, 'fast-xml-parser': require('fast-xml-parser') })('lib/services/ctt/ctt-soap-client.ts').CTTSoapClient)()
async function listen(server, t) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  return `127.0.0.1:${server.address().port}`
}
test('CTT SOAP rejects an untrusted HTTPS server before any shipment request reaches it', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-tls-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' })
  let requests = 0
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (_, response) => { requests++; response.end('fixture') })
  const host = await listen(server, t)
  await assert.rejects(soap().callSoap({ endpoint: `https://${host}/fixture`, action: 'fixture', soapBodyXml: '<Fixture/>', timeoutMs: 3000 }), /certificate|self.signed/i)
  assert.equal(requests, 0)
})
test('CTT SOAP retains the existing HTTP contract, body and response parsing against a local fixture', async t => {
  let received
  const server = http.createServer((request, response) => {
    let body = ''; request.setEncoding('utf8'); request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      received = { body, action: request.headers.soapaction, path: request.url }
      response.end('<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><CompleteShipmentResponse><Status>1</Status></CompleteShipmentResponse></s:Body></s:Envelope>')
    })
  })
  const host = await listen(server, t)
  const result = await soap().callSoap({ endpoint: `http://${host}/CTTShipmentProviderWS.svc`, action: 'http://tempuri.org/fixture', soapBodyXml: '<Fixture>local-only</Fixture>' })
  assert.equal(result.CompleteShipmentResponse.Status, '1')
  assert.match(received.body, /<Fixture>local-only<\/Fixture>/)
  assert.equal(received.action, 'http://tempuri.org/fixture')
  assert.equal(received.path, '/CTTShipmentProviderWS.svc')
})
