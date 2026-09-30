import path from "node:path"
import fs from "node:fs"

export interface PostalCodeLookupResult {
  found: boolean
  country: "PT" | "ES"
  postalCode: string
  street?: string
  streets?: string[]
  city: string
  municipality?: string
  district?: string
}

let dbInstance: any = null

function getDatabase() {
  if (dbInstance) return dbInstance

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = typeof eval === "function" ? eval("require") : require
    const { DatabaseSync } = req("node:sqlite")
    const dbPath = path.join(process.cwd(), "data", "postal-codes.db")

    if (!fs.existsSync(dbPath)) {
      console.warn("[PostalCodeService] Base de dados de códigos postais não encontrada em:", dbPath)
      return null
    }

    dbInstance = new DatabaseSync(dbPath, { readOnly: true })
    return dbInstance
  } catch (err: any) {
    console.error("[PostalCodeService] Erro ao inicializar node:sqlite:", err?.message)
    return null
  }
}

/**
 * Normaliza e pesquisa um código postal em Portugal (PT) ou Espanha (ES)
 */
export function lookupPostalCode(
  rawCode: string,
  country: string = "PT"
): PostalCodeLookupResult | null {
  if (!rawCode) return null

  const clean = rawCode.trim().replace(/\s+/g, "")
  const isES = country.toUpperCase() === "ES" || (/^[0-9]{5}$/.test(clean) && !clean.includes("-"))

  const db = getDatabase()
  if (!db) return null

  if (isES) {
    // ── ESPANHA (5 dígitos) ──────────────────────────────────────────────
    const fiveDigits = clean.replace(/[^0-9]/g, "").padStart(5, "0").substring(0, 5)
    if (fiveDigits.length !== 5) return null

    try {
      const stmt = db.prepare("SELECT cp, municipio, provincia FROM es_postal_codes WHERE cp = ? LIMIT 1")
      const row = stmt.get(fiveDigits) as { cp: string; municipio: string; provincia: string } | undefined

      if (row) {
        return {
          found: true,
          country: "ES",
          postalCode: row.cp,
          city: row.municipio,
          municipality: row.municipio,
          district: row.provincia,
        }
      }
    } catch (e: any) {
      console.warn("[PostalCodeService] Erro na consulta ES:", e?.message)
    }

    return null
  }

  // ── PORTUGAL (7 dígitos: 4 dígitos + 3 dígitos) ────────────────────────
  let cp4 = ""
  let cp3 = ""

  if (clean.includes("-")) {
    const parts = clean.split("-")
    cp4 = parts[0].replace(/[^0-9]/g, "")
    cp3 = parts[1].replace(/[^0-9]/g, "")
  } else {
    const digits = clean.replace(/[^0-9]/g, "")
    if (digits.length >= 7) {
      cp4 = digits.substring(0, 4)
      cp3 = digits.substring(4, 7)
    } else if (digits.length === 4) {
      cp4 = digits
    }
  }

  if (!cp4 || cp4.length !== 4) return null

  try {
    if (cp3 && cp3.length === 3) {
      const fullCp = `${cp4}-${cp3}`
      const stmt = db.prepare(`
        SELECT cp, rua, localidade, concelho, distrito
        FROM pt_postal_codes
        WHERE cp = ?
      `)
      const rows = stmt.all(fullCp) as Array<{
        cp: string
        rua: string
        localidade: string
        concelho: string
        distrito: string
      }>

      if (rows && rows.length > 0) {
        const uniqueStreets = Array.from(new Set(rows.map(r => r.rua).filter(Boolean))) as string[]
        const primaryRow = rows[0]

        return {
          found: true,
          country: "PT",
          postalCode: fullCp,
          street: uniqueStreets.length > 0 ? uniqueStreets[0] : undefined,
          streets: uniqueStreets.length > 1 ? uniqueStreets : undefined,
          city: primaryRow.localidade || primaryRow.concelho || "",
          municipality: primaryRow.concelho || "",
          district: primaryRow.distrito || "",
        }
      }
    }

    // Se só tiver CP4 (ex: "4610") ou CP3 não existir exatamente: pesquisa por CP4
    const stmtCp4 = db.prepare(`
      SELECT localidade, concelho, distrito
      FROM pt_postal_codes
      WHERE cp4 = ?
      LIMIT 1
    `)
    const rowCp4 = stmtCp4.get(cp4) as {
      localidade: string
      concelho: string
      distrito: string
    } | undefined

    if (rowCp4) {
      return {
        found: true,
        country: "PT",
        postalCode: cp4,
        city: rowCp4.localidade || rowCp4.concelho || "",
        municipality: rowCp4.concelho || "",
        district: rowCp4.distrito || "",
      }
    }
  } catch (e: any) {
    console.warn("[PostalCodeService] Erro na consulta PT:", e?.message)
  }

  return null
}
