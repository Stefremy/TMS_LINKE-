/**
 * Códigos de cliente: sempre "CL" seguido de pelo menos 3 dígitos (CL001, CL934, CL1200).
 * O código da plataforma antiga (LK0006, 20260038…) fica em `legacy_code` para importações e pesquisa.
 */
export const CLIENT_CODE_PATTERN = /^CL\d{3,6}$/
/** Conta-mãe da Linke: o código nunca muda. */
export const MOTHER_ACCOUNT_CODE = "CL001"

export const normalizeClientCode = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "")

export function formatClientCode(n: number) {
  return `CL${String(n).padStart(3, "0")}`
}

/** Próximo código livre: o maior número CL em uso + 1 (nunca reutiliza um código). */
export function nextClientCode(existing: Iterable<string | null | undefined>) {
  let max = 1
  for (const code of existing) {
    const c = normalizeClientCode(code)
    if (CLIENT_CODE_PATTERN.test(c)) max = Math.max(max, Number(c.slice(2)))
  }
  return formatClientCode(max + 1)
}
