"use server"

import { lookupPostalCode, type PostalCodeLookupResult } from "@/lib/services/geo/postal-code.service"

export async function lookupPostalCodeAction(
  code: string,
  country: string = "PT"
): Promise<PostalCodeLookupResult | null> {
  if (!code) return null
  return lookupPostalCode(code, country)
}
