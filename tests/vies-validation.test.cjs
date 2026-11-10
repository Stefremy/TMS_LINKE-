const test = require("node:test")
const assert = require("node:assert/strict")
const { createLoader } = require("./helpers/load-typescript.cjs")

const load = createLoader({})
const vies = load("lib/tax/vies.ts")
const viesServer = load("lib/tax/vies-server.ts")

test("validatePortugueseNif verifies Modulo 11 checksum and prefix rules", () => {
  assert.equal(vies.validatePortugueseNif("500077568"), true)
  assert.equal(vies.validatePortugueseNif("PT500 077 568"), true)
  assert.equal(vies.validatePortugueseNif("500077569"), false)
  assert.equal(vies.validatePortugueseNif("000000000"), false)
  assert.equal(vies.validatePortugueseNif("50007756"), false)
})

test("parseVatInput normalizes EU prefixes, handles GR->EL, and flags GB Brexit departure", () => {
  const pt = vies.parseVatInput("500 077 568", "PT")
  assert.equal(pt.ok, true)
  assert.equal(pt.countryCode, "PT")
  assert.equal(pt.vatNumber, "500077568")
  assert.equal(pt.formattedVat, "PT500077568")
  assert.equal(pt.localNifValid, true)

  const es = vies.parseVatInput("ES-B12345678", "PT")
  assert.equal(es.ok, true)
  assert.equal(es.countryCode, "ES")
  assert.equal(es.vatNumber, "B12345678")

  const gr = vies.parseVatInput("GR094014201", "PT")
  assert.equal(gr.ok, true)
  assert.equal(gr.countryCode, "EL")
  assert.equal(gr.vatNumber, "094014201")

  const uk = vies.parseVatInput("GB123456789", "GB")
  assert.equal(uk.ok, false)
  assert.match(uk.error, /Brexit/i)
})

test("parseViesAddress splits Portuguese and European VIES multi-line addresses cleanly", () => {
  const ptParsed = vies.parseViesAddress(
    "AVENIDA DOS COMBATENTES N 43 14 PISO 43 14\nLISBOA\n1600-042 LISBOA",
    "PT"
  )
  assert.deepEqual(ptParsed, {
    street: "AVENIDA DOS COMBATENTES N 43 14 PISO 43 14",
    postalCode: "1600-042",
    city: "LISBOA",
    countryCode: "PT",
  })

  const esParsed = vies.parseViesAddress("CALLE MAYOR 10\n28001 MADRID", "ES")
  assert.deepEqual(esParsed, {
    street: "CALLE MAYOR 10",
    postalCode: "28001",
    city: "MADRID",
    countryCode: "ES",
  })

  assert.equal(vies.parseViesAddress("---", "PT"), null)
})

test("checkEuViesVat parses active EU VIES company data, non-VIES domestic NIFs, and VIES service errors", async () => {
  let fetchCalls = 0
  const validMockFetch = async () => {
    fetchCalls++
    return new Response(
      JSON.stringify({
        countryCode: "PT",
        vatNumber: "500077568",
        requestDate: "2026-11-10T11:28:58.446Z",
        valid: true,
        name: "CTT - CORREIOS DE PORTUGAL S A",
        address: "AVENIDA DOS COMBATENTES N 43 14 PISO 43 14\nLISBOA\n1600-042 LISBOA",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  const validRes = await viesServer.checkEuViesVat("500077568", {
    countryCodeHint: "PT",
    force: true,
    fetchImpl: validMockFetch,
  })
  assert.equal(validRes.ok, true)
  assert.equal(validRes.valid, true)
  assert.equal(validRes.name, "CTT - CORREIOS DE PORTUGAL S A")
  assert.equal(validRes.parsedAddress.postalCode, "1600-042")
  assert.equal(validRes.parsedAddress.city, "LISBOA")
  assert.equal(fetchCalls, 1)

  // Immediate repeat uses cache
  const cachedRes = await viesServer.checkEuViesVat("PT500077568", {
    fetchImpl: validMockFetch,
  })
  assert.equal(cachedRes.cached, true)
  assert.equal(fetchCalls, 1)

  // Domestic valid PT checksum but inactive in VIES
  const nonViesRes = await viesServer.checkEuViesVat("123456789", {
    countryCodeHint: "PT",
    force: true,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          countryCode: "PT",
          vatNumber: "123456789",
          valid: false,
          name: "",
          address: "",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
  })
  assert.equal(nonViesRes.ok, true)
  assert.equal(nonViesRes.valid, false)
  assert.equal(nonViesRes.localNifValid, true)
  assert.match(nonViesRes.message, /NIF PT.*válido.*sem registo VIES/i)

  // Member State temporarily unavailable
  const errorRes = await viesServer.checkEuViesVat("FR40303265045", {
    force: true,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          actionSucceed: false,
          errorWrappers: [{ error: "MS_UNAVAILABLE" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
  })
  assert.equal(errorRes.ok, false)
  assert.equal(errorRes.valid, false)
  assert.equal(errorRes.errorCode, "MS_UNAVAILABLE")
  assert.match(errorRes.message, /indisponível/i)
})

