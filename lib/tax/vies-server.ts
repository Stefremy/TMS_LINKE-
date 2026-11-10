import {
  EU_VIES_PORTAL_URL,
  EU_VIES_REST_ENDPOINT,
  cleanViesText,
  parseVatInput,
  parseViesAddress,
  translateViesError,
  type ViesValidationResult,
} from "./vies"

interface ViesApiErrorWrapper {
  error?: string
}

interface ViesApiRestResponse {
  countryCode?: string
  vatNumber?: string
  requestDate?: string
  valid?: boolean
  requestIdentifier?: string
  name?: string
  address?: string
  actionSucceed?: boolean
  errorWrappers?: ViesApiErrorWrapper[]
  userError?: string
}

interface CacheEntry {
  result: ViesValidationResult
  expiresAtMs: number
}

const VIES_CACHE_TTL_MS = 60_000
const VIES_CACHE_MAX_ENTRIES = 200
const viesCache = new Map<string, CacheEntry>()

function setViesCache(key: string, result: ViesValidationResult) {
  if (viesCache.size >= VIES_CACHE_MAX_ENTRIES) {
    const oldest = viesCache.keys().next().value
    if (oldest) viesCache.delete(oldest)
  }
  viesCache.set(key, {
    result,
    expiresAtMs: Date.now() + VIES_CACHE_TTL_MS,
  })
}

export async function checkEuViesVat(
  rawVat: string,
  options?: {
    countryCodeHint?: string | null
    force?: boolean
    fetchImpl?: typeof fetch
  }
): Promise<ViesValidationResult> {
  const parsed = parseVatInput(rawVat, options?.countryCodeHint)
  if (!parsed.ok) {
    return {
      ok: false,
      valid: false,
      countryCode: parsed.countryCode,
      vatNumber: parsed.vatNumber,
      formattedVat: parsed.formattedVat,
      localNifValid: parsed.localNifValid,
      name: "",
      address: "",
      parsedAddress: null,
      errorCode: "INVALID_INPUT",
      message: parsed.error || "NIF/VAT inválido.",
      portalUrl: EU_VIES_PORTAL_URL,
    }
  }

  const cacheKey = `${parsed.countryCode}|${parsed.vatNumber}`
  if (!options?.force) {
    const cached = viesCache.get(cacheKey)
    if (cached && cached.expiresAtMs > Date.now()) {
      return {
        ...cached.result,
        cached: true,
      }
    }
    viesCache.delete(cacheKey)
  }

  const fetchFn = options?.fetchImpl ?? fetch

  try {
    const response = await fetchFn(EU_VIES_REST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        countryCode: parsed.countryCode,
        vatNumber: parsed.vatNumber,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })

    const payload = (await response.json().catch(() => null)) as ViesApiRestResponse | null

    if (!response.ok || !payload || typeof payload !== "object") {
      return {
        ok: false,
        valid: false,
        countryCode: parsed.countryCode,
        vatNumber: parsed.vatNumber,
        formattedVat: parsed.formattedVat,
        localNifValid: parsed.localNifValid,
        name: "",
        address: "",
        parsedAddress: null,
        errorCode: `HTTP_${response.status}`,
        message: "O serviço europeu VIES respondeu com erro temporário. Tente novamente em instantes.",
        portalUrl: EU_VIES_PORTAL_URL,
      }
    }

    if (payload.actionSucceed === false || (Array.isArray(payload.errorWrappers) && payload.errorWrappers.length > 0)) {
      const code = payload.errorWrappers?.[0]?.error || payload.userError || "SERVICE_UNAVAILABLE"
      return {
        ok: false,
        valid: false,
        countryCode: parsed.countryCode,
        vatNumber: parsed.vatNumber,
        formattedVat: parsed.formattedVat,
        localNifValid: parsed.localNifValid,
        name: "",
        address: "",
        parsedAddress: null,
        errorCode: code,
        message: translateViesError(code),
        portalUrl: EU_VIES_PORTAL_URL,
      }
    }

    const isValid = payload.valid === true
    const name = cleanViesText(payload.name)
    const address = cleanViesText(payload.address)
    const resolvedCountry = (payload.countryCode || parsed.countryCode).toUpperCase()
    const resolvedVat = payload.vatNumber || parsed.vatNumber
    const parsedAddress = parseViesAddress(address, resolvedCountry)

    let message = ""
    if (isValid) {
      message = `VIES válido (${resolvedCountry}${resolvedVat}).`
    } else if (resolvedCountry === "PT" && parsed.localNifValid === false) {
      message = `NIF ${resolvedVat} inválido (dígito de controlo incorreto e inativo no VIES).`
    } else if (resolvedCountry === "PT" && parsed.localNifValid === true) {
      message = `NIF PT ${resolvedVat} válido, mas sem registo VIES intracomunitário.`
    } else {
      message = `NIF/VAT ${resolvedCountry}${resolvedVat} inválido ou não registado no VIES.`
    }

    const result: ViesValidationResult = {
      ok: true,
      valid: isValid,
      countryCode: resolvedCountry,
      vatNumber: resolvedVat,
      formattedVat: `${resolvedCountry}${resolvedVat}`,
      localNifValid: parsed.localNifValid,
      requestDate: typeof payload.requestDate === "string" ? payload.requestDate : undefined,
      requestIdentifier: cleanViesText(payload.requestIdentifier) || undefined,
      name,
      address,
      parsedAddress,
      message,
      portalUrl: EU_VIES_PORTAL_URL,
    }

    setViesCache(cacheKey, result)
    return result
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
    return {
      ok: false,
      valid: false,
      countryCode: parsed.countryCode,
      vatNumber: parsed.vatNumber,
      formattedVat: parsed.formattedVat,
      localNifValid: parsed.localNifValid,
      name: "",
      address: "",
      parsedAddress: null,
      errorCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      message: isTimeout
        ? "A consulta ao portal europeu VIES excedeu o tempo limite. Tente novamente."
        : "Não foi possível estabelecer ligação ao portal europeu VIES.",
      portalUrl: EU_VIES_PORTAL_URL,
    }
  }
}

