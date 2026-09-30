import { mapCorreosStatus, parseCorreosDateTime } from "../lib/services/tracking/correos-tracking-sync"
import { isCorreosShipment } from "../lib/services/shipments/shipment-utils"

function testCorreosMapping() {
  console.log("=== Testando Mapeamento de Estados Correos ===")
  
  const testCases = [
    { code: "1", desc: "SIN RECEPCION", expectedStatus: "pendente", expectedDisplay: "pendente" },
    { code: "01", desc: "EN TRAMITACION", expectedStatus: "pendente", expectedDisplay: "pendente" },
    { code: "2", desc: "EN ARRASTRE", expectedStatus: "entrada_rede", expectedDisplay: "em_transito" },
    { code: "02", desc: "RECIBIDO EN PLATAFORMA", expectedStatus: "entrada_rede", expectedDisplay: "em_transito" },
    { code: "3", desc: "EN REPARTO", expectedStatus: "em_distribuicao", expectedDisplay: "em_distribuicao" },
    { code: "4", desc: "ENTREGADO", expectedStatus: "entregue", expectedDisplay: "entregue" },
    { code: "5", desc: "INCIDENCIA", expectedStatus: "incidencia", expectedDisplay: "incidencia" },
    { code: "6", desc: "DEVUELTO", expectedStatus: "devolvido", expectedDisplay: "devolvido" },
    { code: "7", desc: "ESTACIONADO", expectedStatus: "incidencia", expectedDisplay: "incidencia" },
    { code: "8", desc: "DESTRUIDO", expectedStatus: "cancelado", expectedDisplay: "cancelado" },
    { code: "9", desc: "RETENIDO", expectedStatus: "incidencia", expectedDisplay: "incidencia" },
    { code: "10", desc: "REEXPEDIDO", expectedStatus: "entrada_rede", expectedDisplay: "em_transito" },
    { code: "2", desc: "EN ARRASTRE", incCode: "01", incDesc: "Destinatario ausente", expectedStatus: "incidencia", expectedDisplay: "incidencia" },
  ]

  for (const tc of testCases) {
    const res = mapCorreosStatus(tc.code, tc.desc, tc.incCode, tc.incDesc)
    if (res.status !== tc.expectedStatus || res.displayStatus !== tc.expectedDisplay) {
      throw new Error(`Falha no caso: ${JSON.stringify(tc)} -> Obteve ${JSON.stringify(res)}`)
    }
    console.log(`✓ [${tc.code}] ${tc.desc} -> DB: ${res.status} | UI: ${res.displayStatus} | ${res.eventName}`)
  }
}

function testDateTimeParsing() {
  console.log("\n=== Testando Parser de Datas Correos ===")
  const d1 = parseCorreosDateTime("30/09/2026", "14:30:00")
  const d2 = parseCorreosDateTime("30-09-2026", "14:30:00")
  const d3 = parseCorreosDateTime("20260930", "143000")
  
  console.log("30/09/2026 14:30:00 ->", d1)
  console.log("30-09-2026 14:30:00 ->", d2)
  console.log("20260930 143000 ->", d3)

  if (!d1.startsWith("2026-09-30") || !d2.startsWith("2026-09-30") || !d3.startsWith("2026-09-30")) {
    throw new Error("Falha no parsing de datas!")
  }
  console.log("✓ Datas parseadas com sucesso!")
}

function testCarrierDetection() {
  console.log("\n=== Testando Deteção de Transportadora ===")
  const s1 = { carrier_code: "correos" }
  const s2 = { carrier_code: "correos_express" }
  const s3 = { service_type: "Correos Paq 24" }
  const s4 = { carrier_tracking_number: "1234567890123456" }
  const s5 = { carrier_code: "ctt", service_type: "CTT Expresso 24" }

  if (!isCorreosShipment(s1) || !isCorreosShipment(s2) || !isCorreosShipment(s3) || !isCorreosShipment(s4)) {
    throw new Error("Falha na deteção de Correos!")
  }
  if (isCorreosShipment(s5)) {
    throw new Error("CTT incorretamente identificado como Correos!")
  }
  console.log("✓ Deteção de transportadora validada!")
}

testCorreosMapping()
testDateTimeParsing()
testCarrierDetection()
console.log("\nTodos os testes passaram com 100% de sucesso!")
