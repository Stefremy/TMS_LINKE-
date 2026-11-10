export const EU_VIES_PORTAL_URL = "https://ec.europa.eu/taxation_customs/vies/#/vat-validation"
export const EU_VIES_REST_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"

export interface ViesMemberStateOption {
  code: string
  label: string
}

export const VIES_MEMBER_STATES: readonly ViesMemberStateOption[] = [
  { code: "PT", label: "PT · Portugal" },
  { code: "ES", label: "ES · Espanha" },
  { code: "FR", label: "FR · França" },
  { code: "DE", label: "DE · Alemanha" },
  { code: "IT", label: "IT · Itália" },
  { code: "NL", label: "NL · Países Baixos" },
  { code: "BE", label: "BE · Bélgica" },
  { code: "LU", label: "LU · Luxemburgo" },
  { code: "IE", label: "IE · Irlanda" },
  { code: "AT", label: "AT · Áustria" },
  { code: "PL", label: "PL · Polónia" },
  { code: "DK", label: "DK · Dinamarca" },
  { code: "SE", label: "SE · Suécia" },
  { code: "FI", label: "FI · Finlândia" },
  { code: "EL", label: "EL · Grécia" },
  { code: "CZ", label: "CZ · Chéquia" },
  { code: "RO", label: "RO · Roménia" },
  { code: "HU", label: "HU · Hungria" },
  { code: "BG", label: "BG · Bulgária" },
  { code: "HR", label: "HR · Croácia" },
  { code: "SK", label: "SK · Eslováquia" },
  { code: "SI", label: "SI · Eslovénia" },
  { code: "LT", label: "LT · Lituânia" },
  { code: "LV", label: "LV · Letónia" },
  { code: "EE", label: "EE · Estónia" },
  { code: "CY", label: "CY · Chipre" },
  { code: "MT", label: "MT · Malta" },
  { code: "XI", label: "XI · Irlanda do Norte" },
] as const

const VIES_CODE_SET = new Set(VIES_MEMBER_STATES.map(s => s.code))

const VIES_ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "O formato do NIF/VAT é inválido para o país selecionado.",
  INVALID_REQUESTER_INFO: "Dados do requerente VIES inválidos.",
  MS_UNAVAILABLE: "O serviço fiscal deste Estado-Membro está temporariamente indisponível no VIES.",
  MS_MAX_CONCURRENT_REQ: "Demasiados pedidos simultâneos no portal fiscal deste país. Tente dentro de instantes.",
  GLOBAL_MAX_CONCURRENT_REQ: "O portal VIES está sobrecarregado neste momento. Tente novamente em segundos.",
  SERVICE_UNAVAILABLE: "Serviço europeu VIES temporariamente indisponível.",
  TIMEOUT: "O serviço fiscal nacional demorou demasiado tempo a responder (timeout).",
  SERVER_BUSY: "Servidor VIES ocupado. Aguarde alguns segundos e tente novamente.",
  UNKNOWN_MS: "Código de país não suportado pelo sistema VIES.",
}

export interface ViesParsedVat {
  ok: boolean
  countryCode: string
  vatNumber: string
  formattedVat: string
  localNifValid: boolean | null
  error?: string
}

export interface ViesParsedAddress {
  street: string
  postalCode: string
  city: string
  countryCode: string
}

export interface ViesValidationResult {
  ok: boolean
  valid: boolean
  countryCode: string
  vatNumber: string
  formattedVat: string
  localNifValid: boolean | null
  requestDate?: string
  requestIdentifier?: string
  name: string
  address: string
  parsedAddress: ViesParsedAddress | null
  errorCode?: string
  message: string
  portalUrl: string
  cached?: boolean
}

export function cleanViesText(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "---" || trimmed === "***" || trimmed === "-") return ""
  return trimmed
}

export function toViesCountryCode(countryCode?: string | null): string | null {
  const clean = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : ""
  if (!clean) return null
  if (clean === "GR") return "EL"
  if (clean === "UK" || clean === "GB") return null
  return VIES_CODE_SET.has(clean) ? clean : null
}

export function fromViesCountryCode(viesCode?: string | null): string {
  const clean = typeof viesCode === "string" ? viesCode.trim().toUpperCase() : ""
  if (clean === "EL") return "GR"
  if (clean === "XI") return "GB"
  return clean || "PT"
}

/**
 * Validates the 9-digit Portuguese NIF checksum (Modulo 11).
 * Note: An individual or domestic entity can have a valid PT checksum without being VAT-VIES active.
 */
export function validatePortugueseNif(raw: string): boolean {
  const cleaned = raw.replace(/[\s.-]+/g, "").toUpperCase().replace(/^PT/, "")
  if (!/^\d{9}$/.test(cleaned)) return false

  const firstDigit = cleaned[0]
  const firstTwo = cleaned.slice(0, 2)
  const validSingle = ["1", "2", "3", "5", "6", "8"].includes(firstDigit)
  const validDouble = ["45", "70", "71", "72", "74", "75", "77", "78", "79", "90", "91", "98", "99"].includes(firstTwo)
  if (!validSingle && !validDouble) return false

  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += Number(cleaned[i]) * (9 - i)
  }
  const mod = sum % 11
  const expected = mod < 2 ? 0 : 11 - mod
  return Number(cleaned[8]) === expected
}

/**
 * Detects whether a VAT string starts with a 2-letter EU VIES prefix (including GR->EL).
 */
export function detectVatPrefix(raw: string): { prefix: string | null; rest: string } {
  const normalized = raw.replace(/[\s./-]+/g, "").toUpperCase()
  if (normalized.length >= 4 && /^[A-Z]{2}/.test(normalized)) {
    const maybePrefix = normalized.slice(0, 2)
    if (maybePrefix === "GR") return { prefix: "EL", rest: normalized.slice(2) }
    if (VIES_CODE_SET.has(maybePrefix)) return { prefix: maybePrefix, rest: normalized.slice(2) }
  }
  return { prefix: null, rest: normalized }
}

/**
 * Normalizes and validates user NIF/VAT input into a VIES (countryCode, vatNumber) pair.
 */
export function parseVatInput(rawInput: string, countryCodeHint?: string | null): ViesParsedVat {
  const normalized = (rawInput || "").replace(/[\s./-]+/g, "").toUpperCase()
  if (!normalized) {
    return {
      ok: false,
      countryCode: toViesCountryCode(countryCodeHint) || "PT",
      vatNumber: "",
      formattedVat: "",
      localNifValid: null,
      error: "Introduza o NIF ou número de IVA intracomunitário.",
    }
  }

  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return {
      ok: false,
      countryCode: toViesCountryCode(countryCodeHint) || "PT",
      vatNumber: normalized,
      formattedVat: normalized,
      localNifValid: null,
      error: "O NIF/VAT só deve conter letras e algarismos.",
    }
  }

  const rawHint = (countryCodeHint || "").trim().toUpperCase()
  const detected = detectVatPrefix(normalized)
  let countryCode = detected.prefix
  let vatNumber = detected.rest

  if (!countryCode) {
    if (normalized.startsWith("GB") || normalized.startsWith("UK") || (!detected.prefix && (rawHint === "GB" || rawHint === "UK"))) {
      return {
        ok: false,
        countryCode: "GB",
        vatNumber: normalized.replace(/^(GB|UK)/, ""),
        formattedVat: normalized,
        localNifValid: null,
        error: "O Reino Unido (GB/UK) saiu do portal europeu VIES após o Brexit. Para a Irlanda do Norte use o prefixo XI.",
      }
    }

    const mappedHint = toViesCountryCode(rawHint)
    if (!mappedHint && /^[A-Z]{2}/.test(normalized)) {
      return {
        ok: false,
        countryCode: normalized.slice(0, 2),
        vatNumber: normalized.slice(2),
        formattedVat: normalized,
        localNifValid: null,
        error: `O prefixo "${normalized.slice(0, 2)}" não pertence à rede europeia VIES.`,
      }
    }

    countryCode = mappedHint || "PT"
    vatNumber = normalized
  }

  if (vatNumber.length < 4 || vatNumber.length > 15) {
    return {
      ok: false,
      countryCode,
      vatNumber,
      formattedVat: `${countryCode}${vatNumber}`,
      localNifValid: null,
      error: "Número fiscal demasiado curto ou longo para validação VIES.",
    }
  }

  const localNifValid = countryCode === "PT" ? validatePortugueseNif(vatNumber) : null

  return {
    ok: true,
    countryCode,
    vatNumber,
    formattedVat: `${countryCode}${vatNumber}`,
    localNifValid,
  }
}

export function translateViesError(errorCode?: string | null): string {
  const clean = (errorCode || "").trim().toUpperCase()
  if (clean && VIES_ERROR_MESSAGES[clean]) {
    return VIES_ERROR_MESSAGES[clean]
  }
  return clean
    ? `Não foi possível concluir a validação VIES (${clean}).`
    : "Não foi possível contactar o portal europeu VIES neste momento."
}

/**
 * Splits VIES multi-line address text into street, postal code, and city.
 */
export function parseViesAddress(rawAddress: string, viesCountryCode: string): ViesParsedAddress | null {
  const cleaned = cleanViesText(rawAddress)
  if (!cleaned) return null

  const lines = cleaned
    .split(/\r?\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && l !== "---")

  if (lines.length === 0) return null

  let postalCode = ""
  let city = ""
  let postalLineIndex = -1

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const ptMatch = line.match(/^(\d{4}-\d{3})\s+(.+)$/)
    if (ptMatch) {
      postalCode = ptMatch[1]
      city = ptMatch[2].trim()
      postalLineIndex = i
      break
    }

    const nlMatch = line.match(/^(\d{4}\s?[A-Z]{2})\s+(.+)$/i)
    if (nlMatch) {
      postalCode = nlMatch[1].toUpperCase()
      city = nlMatch[2].trim()
      postalLineIndex = i
      break
    }

    const plMatch = line.match(/^(\d{2}-\d{3})\s+(.+)$/)
    if (plMatch) {
      postalCode = plMatch[1]
      city = plMatch[2].trim()
      postalLineIndex = i
      break
    }

    const genericMatch = line.match(/^(?:[A-Z]{1,2}-)?(\d{4,6})\s+(.+)$/)
    if (genericMatch) {
      postalCode = genericMatch[1]
      city = genericMatch[2].trim()
      postalLineIndex = i
      break
    }

    const ptBareCode = line.match(/\b(\d{4}-\d{3})\b/)
    if (ptBareCode && i === lines.length - 1) {
      postalCode = ptBareCode[1]
      city = line.replace(ptBareCode[1], "").trim()
      postalLineIndex = i
      break
    }
  }

  const streetLines = lines.filter((_, idx) => idx !== postalLineIndex)
  // Avoid repeating a standalone city line right above "POSTAL_CODE CITY"
  if (
    city &&
    streetLines.length > 1 &&
    streetLines[streetLines.length - 1].toUpperCase() === city.toUpperCase()
  ) {
    streetLines.pop()
  }

  return {
    street: streetLines.join(", "),
    postalCode,
    city,
    countryCode: fromViesCountryCode(viesCountryCode),
  }
}

