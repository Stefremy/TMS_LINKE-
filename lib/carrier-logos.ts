/**
 * Mapeamento e resolução de logótipos oficiais das transportadoras parceiras
 * localizados em /public/logo_transportadoras
 */

export const CARRIER_LOGOS: Record<string, string> = {
  // Correos Express
  correos: "/logo_transportadoras/correos_logo.jpeg",
  "correos express": "/logo_transportadoras/correos_logo.jpeg",
  "correos.express": "/logo_transportadoras/correos_logo.jpeg",
  "cep ii": "/logo_transportadoras/correos_logo.jpeg",
  lk003: "/logo_transportadoras/correos_logo.jpeg",
  forn_lk003: "/logo_transportadoras/correos_logo.jpeg",

  // CTT Expresso
  ctt: "/logo_transportadoras/ctt_express_logo.svg",
  "ctt express": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt expresso": "/logo_transportadoras/ctt_express_logo.svg",
  "ctt expresso serviços": "/logo_transportadoras/ctt_express_logo.svg",
  forn_2: "/logo_transportadoras/ctt_express_logo.svg",

  // CTT Correios
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
export function getCarrierLogo(nameOrCode?: string): string | null {
  if (!nameOrCode) return null
  const normalized = nameOrCode.toLowerCase().trim()

  // Match direto
  if (CARRIER_LOGOS[normalized]) {
    return CARRIER_LOGOS[normalized]
  }

  // Match parcial
  if (normalized.includes("correos")) return "/logo_transportadoras/correos_logo.jpeg"
  if (normalized.includes("dpd")) return "/logo_transportadoras/dpd_logo.svg"
  if (normalized.includes("mrw")) return "/logo_transportadoras/mrw_logo.jpeg"
  if (normalized.includes("ctt express") || normalized.includes("ctt expresso")) return "/logo_transportadoras/ctt_express_logo.svg"
  if (normalized.includes("ctt") || normalized.includes("correios")) return "/logo_transportadoras/ctt_correios_logo.png"

  return null
}
