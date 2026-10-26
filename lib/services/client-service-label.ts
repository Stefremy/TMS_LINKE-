// Client presentation only. Never use these labels for pricing, routing or storage.
const INTERNAL_PROFILES = ["Standard / Geral", "VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"]
const profileKey = (value: string) => value.replace(/\s*\/\s*/g, "/").trim().toLowerCase()
const TRANSIT_TIME = /\b(?:(?:em|at[eé])\s+)?\d+(?:[.,]\d+)?(?:\s*[-–/]\s*\d+(?:[.,]\d+)?)?\s*(?:h(?:oras)?|dias?)(?:\s+[uú]teis)?\b/gi

export function getClientServiceName(name?: string | null): string {
  const value = typeof name === "string" ? name : ""
  const label = value
    .replace(/\(([^()]*)\)/g, (whole: string, content: string) => {
      const internalProfile = INTERNAL_PROFILES.some(profile => profileKey(profile) === profileKey(content))
      const containsTransit = content.replace(TRANSIT_TIME, "") !== content || /\bD\s*\+\s*\d|\bPaq\s*(?:24|48)\b/i.test(content)
      return internalProfile || containsTransit ? "" : whole
    })
    .replace(/\bGuia\s+(?:EQ|DD|DB)\s*[·:—–-]?\s*/gi, "")
    .replace(/\bEcon[oó]mico\s*(?:\/\s*)?48\b/gi, "")
    .replace(/\bpara\s+amanh[ãa](?=$|[\s),;])/gi, "")
    .replace(TRANSIT_TIME, "")
    .replace(/\bD\s*\+\s*\d+\b/gi, "")
    .replace(/\bPaq\s*(?:24|48)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s·/—–-]+|[\s·/—–-]+$/g, "")
  return label || "Serviço de transporte"
}

export function getClientServiceLabel(service: { name?: string; category?: string }): string {
  const category = service.category?.trim()
  const name = getClientServiceName(service.name)
  const existingCategory = name.match(/^\[([^\]]+)\]\s*/)
  const tableName = category && existingCategory?.[1].toLowerCase() === category.toLowerCase()
    ? name.slice(existingCategory[0].length)
    : name
  return `${category ? `[${category}] ` : ""}${tableName}`
}
