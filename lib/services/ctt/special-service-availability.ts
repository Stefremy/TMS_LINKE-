import { isCodFee, isCodDestinationAvailable } from "@/lib/pricing/cod-destination-rates"

/** Linke contract: COD is limited to the configured Portuguese and Spanish regions. */
export function isCttSpecialServiceAvailable(code: string, country: string, postal: string): boolean {
  if (isCodFee(code)) return isCodDestinationAvailable(country, postal, code)
  if (!["auth_return", "back", "authorizereturn"].includes(code.trim().toLowerCase())) return true
  return country.trim().toUpperCase() === "PT" && /^[1-8]\d{3}-?\d{3}$/.test(postal.trim())
}
