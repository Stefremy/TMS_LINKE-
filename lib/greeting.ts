/** Saudação do portal do cliente: datas especiais primeiro, senão a hora do dia (hora de Lisboa). */

// Domingo de Páscoa (calendário gregoriano, algoritmo de Meeus/Butcher).
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  return new Date(Date.UTC(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1))
}

function lisbonParts(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23",
  }).formatToParts(now).map(p => [p.type, p.value]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) }
}

export function clientGreeting(now: Date = new Date()): string {
  const { year, month, day, hour } = lisbonParts(now)
  if (month === 12 && day >= 24 && day <= 26) return "Feliz Natal"
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return "Feliz Ano Novo"

  const today = Date.UTC(year, month - 1, day), DAY = 86_400_000
  const easter = easterSunday(year).getTime()
  if (today >= easter - 2 * DAY && today <= easter) return "Boa Páscoa"   // Sexta-feira Santa a Domingo
  if (today === easter - 47 * DAY) return "Bom Carnaval"

  if (hour >= 6 && hour < 12) return "Bom dia"
  if (hour >= 12 && hour < 20) return "Boa tarde"
  return "Boa noite"
}
