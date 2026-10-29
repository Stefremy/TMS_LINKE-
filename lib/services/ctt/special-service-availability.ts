/** Linke contract: return authorization/Back is restricted to mainland Portugal. */
export function isCttSpecialServiceAvailable(code: string, country: string, postal: string): boolean {
  if (!["auth_return", "back", "authorizereturn"].includes(code.trim().toLowerCase())) return true
  return country.trim().toUpperCase() === "PT" && /^[1-8]\d{3}-?\d{3}$/.test(postal.trim())
}
