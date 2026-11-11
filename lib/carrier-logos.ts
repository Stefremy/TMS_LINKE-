/**
 * Mapeamento e resolução de logótipos oficiais das transportadoras parceiras
 * localizados em /public/logo_transportadoras
 */

export const CARRIER_LOGOS: Record<string, string> = {
  // CTT Expresso
  ctt: "/logo_transportadoras/ctt_express_logo.svg",
  "ctt express": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt expresso": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt expresso serviços": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt_expresso": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt 24h": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt 48h": "/logo_transportadoras/ctt_express_logo.svg",
  linke: "/logo_transportadoras/ctt_express_logo.svg",
  forn_2: "/logo_transportadoras/ctt_express_logo.svg",
  "2": "/logo_transportadoras/ctt_express_logo.svg",

  // Correos Express
  correos: "/logo_transportadoras/correos_logo.jpeg",
  "correos express": "/logo_transportadoras/correos_logo.jpeg",
  "correos.express": "/logo_transportadoras/correos_logo.jpeg",
  "correos_express": "/logo_transportadoras/correos_logo.jpeg",
  "cep ii": "/logo_transportadoras/correos_logo.jpeg",
  lk003: "/logo_transportadoras/correos_logo.jpeg",
  forn_lk003: "/logo_transportadoras/correos_logo.jpeg",

  // CTT Correios (Postal)
  correios: "/logo_transportadoras/ctt_correios_logo.png",
  "ctt correios": "/logo_transportadoras/ctt_correios_logo.png",
  "ctt - correios": "/logo_transportadoras/ctt_correios_logo.png",
  forn_lk000_1: "/logo_transportadoras/ctt_correios_logo.png",

  // DPD Portugal
  dpd: "/logo_transportadoras/dpd_logo.svg",
  "dpd portugal": "/logo_transportadoras/dpd_logo.svg",
  "dpd group": "/logo_transportadoras/dpd_logo.svg",
  lk002: "/logo_transportadoras/dpd_logo.svg",
  forn_lk002: "/logo_transportadoras/dpd_logo.svg",

  // MRW
  mrw: "/logo_transportadoras/mrw_logo.jpeg",
  "mrw - guimarães": "/logo_transportadoras/mrw_logo.jpeg",
  "mrw guimaraes": "/logo_transportadoras/mrw_logo.jpeg",
  lk001: "/logo_transportadoras/mrw_logo.jpeg",
  forn_lk001: "/logo_transportadoras/mrw_logo.jpeg",
}

/**
 * Retorna o caminho do logo para uma determinada transportadora, ou null se não houver
 */
export function getCarrierLogo(nameOrCode?: string, customOverrides?: Record<string, string>): string | null {
  if (!nameOrCode) return "/logo_transportadoras/ctt_express_logo.svg"
  const normalized = nameOrCode.toLowerCase().trim()

  // 1. Verificar sobreposições personalizadas configuradas pelo utilizador
  if (customOverrides && Object.keys(customOverrides).length > 0) {
    if (customOverrides[normalized]) return customOverrides[normalized]
    for (const [k, v] of Object.entries(customOverrides)) {
      const normK = k.toLowerCase().trim()
      if (normK && (normalized.includes(normK) || normK.includes(normalized))) {
        return v
      }
    }
  }

  // 2. Match direto nos padrões
  if (CARRIER_LOGOS[normalized]) {
    return CARRIER_LOGOS[normalized]
  }

  // 3. Match parcial nos padrões
  if (normalized.includes("ctt correios") || normalized === "correios") return "/logo_transportadoras/ctt_correios_logo.png"
  if (normalized.includes("correos")) return "/logo_transportadoras/correos_logo.jpeg"
  if (normalized.includes("dpd")) return "/logo_transportadoras/dpd_logo.svg"
  if (normalized.includes("mrw")) return "/logo_transportadoras/mrw_logo.jpeg"
  if (normalized.includes("ctt") || normalized.includes("linke") || normalized.includes("expresso")) {
    return "/logo_transportadoras/ctt_express_logo.svg"
  }

  return "/logo_transportadoras/ctt_express_logo.svg"
}


/**
 * Resolve o logo a partir da transportadora real do envio (carrier_code / carrier_name / formato do tracking),
 * em vez do nome do serviço Linke (ex: "Linke-PaQ24 PT"), que resolveria sempre para CTT.
 */
export function getShipmentCarrierLogo(shipment?: {
  carrier_code?: string | null
  carrier_name?: string | null
  carrier?: string | null
  carrier_tracking_number?: string | null
  service_type?: string | null
} | null): string {
  if (!shipment) return CARRIER_LOGOS.ctt
  // Mesma regra de deteção usada na listagem (page.tsx): Correos tem prioridade se qualquer sinal o indicar,
  // porque carrier_code pode estar gravado como CTT em envios encaminhados para Correos.
  const isCorreos =
    /correos/i.test(shipment.carrier_code || "") && !/correios/i.test(shipment.carrier_code || "") ||
    /correos/i.test(shipment.carrier_name || "") ||
    /correos/i.test(shipment.service_type || "") ||
    /^\d{16}$/.test((shipment.carrier_tracking_number || "").trim())
  if (isCorreos) return CARRIER_LOGOS.correos
  for (const c of [shipment.carrier_code, shipment.carrier_name, shipment.carrier]) {
    if (c && c.trim()) return getCarrierLogo(c) || CARRIER_LOGOS.ctt
  }
  return getCarrierLogo(shipment.service_type || "ctt") || CARRIER_LOGOS.ctt
}
