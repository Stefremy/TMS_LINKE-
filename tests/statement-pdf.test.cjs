const test = require('node:test')
const assert = require('node:assert/strict')
const pdf = require('pdf-lib')
const { createLoader } = require('./helpers/load-typescript.cjs')

const shipment = (specials) => ({
  id: 'preview', tracking_number: 'TESTE-001', recipient_name: 'Cliente de teste',
  created_at: '2026-10-22T12:00:00Z', service_type: 'Transporte de teste',
  base_price: 3.69, fuel_tax_amount: 0.46, special_fees_amount: 3.3,
  special_fees_description: JSON.stringify(specials), sell_price: 7.45,
})
function harness() {
  const draws = []
  const load = createLoader({
    'pdf-lib': { ...pdf, PDFDocument: { create: async () => {
      const doc = await pdf.PDFDocument.create()
      const add = doc.addPage.bind(doc)
      doc.addPage = (...args) => {
        const page = add(...args), index = doc.getPageCount()
        const draw = page.drawText.bind(page)
        page.drawText = (text, opts) => { draws.push({ text, ...opts, page: index }); return draw(text, opts) }
        return page
      }
      return doc
    } } },
    fs: require('node:fs'), path: require('node:path'),
  })
  return { draws, generate: (shipments) => load('lib/services/billing/statement-pdf.ts').generateStatementPdfBuffer({
    statementNumber: 'DEMO-2026/001', clientName: 'Loja demonstracao', dateStr: '22/10/2026',
    totalValue: shipments.reduce((sum, s) => sum + s.sell_price, 0), shipments,
  }) }
}

test('each supplement has its full name and own price below the shipment; recorded totals stay unchanged', async () => {
  const h = harness()
  await h.generate([shipment([{name:'Tratamento diferenciado de objetos frageis',amount:1.5},{name:'Cobranca e reembolso ao destinatario',amount:1.8}])])
  for (const name of ['Tratamento diferenciado de objetos frageis','Cobranca e reembolso ao destinatario']) {
    const draw = h.draws.find(d => d.text === name)
    assert.ok(draw)
    assert.equal(draw.size, 8)
    assert.ok(draw.y < h.draws.find(d => d.text === 'TESTE-001').y)
  }
  for (const amount of ['1,50 EUR','1,80 EUR','3,30 EUR','7,45 EUR','9,16 EUR']) assert.ok(h.draws.some(d => d.text === amount))
})

test('long supplement descriptions and large lists continue across pages without truncation or entering the footer', async () => {
  const h = harness()
  const name = 'Servico especial com uma descricao muito longa que deve continuar integralmente na linha seguinte ' + 'REFERENCIA'.repeat(25)
  const specials = Array.from({length:70},(_,i)=>({name:`${name} item ${i+1}`,amount:0.01}))
  const s = {...shipment(specials),special_fees_amount:0.7,sell_price:4.85}
  const buffer = await h.generate([s])
  const doc = await pdf.PDFDocument.load(buffer)
  assert.ok(doc.getPageCount() > 2)
  assert.ok(h.draws.some(d=>d.text.includes('(continuacao)')))
  const details = h.draws.filter(d=>d.x===104)
  const text = details.map(d=>d.text).join(' ').replace(/\s/g,'')
  for (const special of specials) assert.ok(text.includes(special.name.replace(/\s/g,'')))
  for (const draw of details) {
    assert.ok(draw.y >= 55)
    assert.ok(draw.x + draw.font.widthOfTextAtSize(draw.text, draw.size) <= 474.01)
  }
  assert.equal(h.draws.filter(d=>d.text==='0,01 EUR').length,70)
  for (let n=1;n<=doc.getPageCount();n++) assert.ok(h.draws.some(d=>d.page===n && d.text===`Pagina ${n} de ${doc.getPageCount()}`))
})

test('unreconciled legacy supplement data never prints invented item prices', async () => {
  const h = harness()
  await h.generate([shipment([{name:'Seguro extra',amount:999}])])
  assert.ok(h.draws.some(d=>d.text==='Seguro extra'))
  assert.ok(h.draws.some(d=>d.text==='3,30 EUR'))
  assert.equal(h.draws.some(d=>d.text==='999,00 EUR'),false)
})
