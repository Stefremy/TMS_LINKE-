import { useState, useCallback, useRef } from "react"

export interface PostalLookupInfo {
  found: boolean
  country: "PT" | "ES"
  postalCode: string
  street?: string
  streets?: string[]
  city: string
  municipality?: string
  district?: string
}

export function usePostalCodeLookup(options?: {
  country?: string
  onFound?: (info: PostalLookupInfo) => void
}) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle")
  const [info, setInfo] = useState<PostalLookupInfo | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const requestVersionRef = useRef(0)
  const countryRef = useRef(options?.country || "PT")
  countryRef.current = options?.country || "PT"
  const onFoundRef = useRef(options?.onFound)
  onFoundRef.current = options?.onFound

  const lookup = useCallback((raw: string, countryOverride?: string) => {
    const requestVersion = ++requestVersionRef.current
    const currentCountry = (countryOverride || countryRef.current || "PT").toUpperCase()
    let val = raw.trim()

    if (currentCountry === "PT") {
      // Portugal: XXXX-YYY
      const digits = val.replace(/[^0-9]/g, "")
      if (digits.length > 4 && !val.includes("-")) {
        val = `${digits.substring(0, 4)}-${digits.substring(4, 7)}`
      } else if (digits.length > 7) {
        val = `${digits.substring(0, 4)}-${digits.substring(4, 7)}`
      }
    } else if (currentCountry === "ES") {
      // Espanha: 5 dígitos numéricos sem hífen
      val = val.replace(/[^0-9]/g, "").substring(0, 5)
    }
    // Outros países: formato livre internacional (sem impor máscara portuguesa)

    if (timerRef.current) clearTimeout(timerRef.current)

    const isPT = currentCountry === "PT"
    const isES = currentCountry === "ES"
    const cleanDigits = val.replace(/[^0-9]/g, "")

    const shouldQuery = (isPT && cleanDigits.length >= 4) || (isES && cleanDigits.length >= 4)

    if (!shouldQuery) {
      setStatus("idle")
      setInfo(null)
      return val
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setStatus("loading")
      try {
        const res = await fetch(`/api/geo/postal-code?code=${encodeURIComponent(val)}&country=${currentCountry}`)
        if (res.ok) {
          const data = await res.json()
          if (requestVersion !== requestVersionRef.current || currentCountry !== countryRef.current) return
          if (data.found) {
            setStatus("valid")
            setInfo(data)
            onFoundRef.current?.(data)
            return
          }
        }
        if (requestVersion !== requestVersionRef.current || currentCountry !== countryRef.current) return
        if ((isPT && cleanDigits.length >= 7) || (isES && cleanDigits.length >= 5)) {
          setStatus("invalid")
        } else {
          setStatus("idle")
        }
      } catch {
        if (requestVersion === requestVersionRef.current) setStatus("idle")
      } finally {
        if (requestVersion === requestVersionRef.current) setLoading(false)
      }
    }, 150)

    return val
  }, [])

  const reset = useCallback(() => {
    requestVersionRef.current++
    if (timerRef.current) clearTimeout(timerRef.current)
    setLoading(false)
    setStatus("idle")
    setInfo(null)
  }, [])

  return {
    lookup,
    loading,
    status,
    info,
    reset,
  }
}
