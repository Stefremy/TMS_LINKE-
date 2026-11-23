/**
 * Importação de destinatários ("Moradas Frequentes") exportados da plataforma antiga.
 * Funções puras: correm no browser (pré-visualização) e no servidor (validação final).
 */

export type ImportedRecipient = {
  name: string
  address: string
  postal_code: string
  city: string
  country: string
  phone?: string
  email?: string
  observations?: string
  legacy_code?: string
}

export type RecipientImportPlan = {
  recipients: ImportedRecipient[]
  /** Linhas iguais a outra linha do mesmo ficheiro (mesmo nome, código postal e morada). */
  duplicates: number
  /** Linhas recusadas, com o número da linha do Excel e o motivo. */
  invalid: { row: number; reason: string }[]
  /** Códigos de cliente da plataforma antiga encontrados no ficheiro. */
  fileClientCodes: string[]
}

export const MAX_RECIPIENT_IMPORT_ROWS = 20000
export const RECIPIENT_IMPORT_BATCH = 500

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).replace(/\s+/g, " ").trim()
const pick = (row: Record<string, unknown>, ...names: string[]) => {
  for (const name of names) if (row[name] !== undefined && text(row[name])) return text(row[name])
  return ""
}

/** "Po", "pt", "Portugal" → PT; outros códigos de 2 letras ficam em maiúsculas. */
export function normalizeRecipientCountry(value: unknown): string {
  const raw = text(value).toUpperCase()
  if (!raw || raw === "PO" || raw === "PT" || raw === "PRT" || raw.startsWith("PORTUGAL")) return "PT"
  if (raw === "UK") return "GB"
  if (raw === "ESPANHA" || raw === "SPAIN") return "ES"
  if (raw === "FRANÇA" || raw === "FRANCA" || raw === "FRANCE") return "FR"
  return /^[A-Z]{2}$/.test(raw) ? raw : raw.slice(0, 2)
}

export function normalizeRecipientPostalCode(value: unknown, country: string): string {
  const raw = text(value).toUpperCase()
  if (country !== "PT") return raw
  const digits = raw.replace(/\D/g, "")
  return digits.length === 7 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : raw
}

/** Telefones vêm como número ou texto ("912 345 678", "00351…"); guarda só dígitos, com + se internacional. */
export function normalizeRecipientPhone(value: unknown): string {
  const raw = text(value)
  if (!raw) return ""
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  if (raw.startsWith("+")) return `+${digits}`
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if (digits.length === 12 && digits.startsWith("351")) return `+${digits}`
  return digits
}

export function recipientImportKey(r: Pick<ImportedRecipient, "name" | "postal_code" | "address">): string {
  const clean = (v: string) => v.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return [clean(r.name), r.postal_code.replace(/[^0-9A-Za-z]/g, "").toLowerCase(), clean(r.address)].join("|")
}

/** Converte as linhas do Excel (cabeçalhos da plataforma antiga) em destinatários válidos e sem repetidos. */
export function planRecipientImport(rows: Record<string, unknown>[]): RecipientImportPlan {
  if (rows.length > MAX_RECIPIENT_IMPORT_ROWS) {
    throw new Error(`O ficheiro tem ${rows.length} linhas. O máximo por importação é ${MAX_RECIPIENT_IMPORT_ROWS}.`)
  }
  const seen = new Set<string>()
  const codes = new Set<string>()
  const plan: RecipientImportPlan = { recipients: [], duplicates: 0, invalid: [], fileClientCodes: [] }

  rows.forEach((row, index) => {
    const excelRow = index + 2 // linha 1 é o cabeçalho
    const clientCode = pick(row, "Cód. Cliente", "Cod. Cliente", "Código Cliente")
    if (clientCode) codes.add(clientCode.toUpperCase())
    const country = normalizeRecipientCountry(pick(row, "País", "Pais"))
    const recipient: ImportedRecipient = {
      name: pick(row, "Nome", "Destinatário").slice(0, 120),
      address: pick(row, "Morada").slice(0, 250),
      postal_code: normalizeRecipientPostalCode(pick(row, "Código Postal", "Codigo Postal"), country).slice(0, 20),
      city: pick(row, "Localidade", "Cidade").slice(0, 80),
      country,
    }
    const phone = normalizeRecipientPhone(row["Telefone"] ?? row["Telemóvel"])
    const email = pick(row, "E-mail", "Email").toLowerCase()
    const contact = pick(row, "Pessoa de Contacto")
    const legacyCode = pick(row, "Código")
    if (phone) recipient.phone = phone.slice(0, 20)
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) recipient.email = email.slice(0, 120)
    if (contact) recipient.observations = `Contacto: ${contact}`.slice(0, 250)
    if (legacyCode) recipient.legacy_code = legacyCode.slice(0, 40)

    const missing = [!recipient.name && "nome", !recipient.address && "morada", !recipient.postal_code && "código postal"].filter(Boolean)
    if (missing.length) {
      plan.invalid.push({ row: excelRow, reason: `Falta ${missing.join(", ")}.` })
      return
    }
    const key = recipientImportKey(recipient)
    if (seen.has(key)) { plan.duplicates++; return }
    seen.add(key)
    plan.recipients.push(recipient)
  })

  plan.fileClientCodes = [...codes]
  return plan
}

/** Evita importar o ficheiro de outro cliente: o código da plataforma antiga tem de coincidir com o da ficha. */
export function recipientFileMatchesClient(fileCodes: string[], clientCodes: (string | null | undefined)[]): boolean {
  if (!fileCodes.length) return true
  const own = new Set(clientCodes.map(code => (code || "").trim().toUpperCase()).filter(Boolean))
  if (!own.size) return true // loja sem código registado: nada a comparar
  return fileCodes.every(code => own.has(code))
}
