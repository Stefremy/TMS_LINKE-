import { CTT_PICKUP_CUTOFFS } from "./data/ctt-pickup-cutoffs"

export type PickupCutoffNotice = {
  state: "unknown" | "within" | "soon" | "passed" | "future" | "past"
  title: string
  message: string
  cutoff?: string
  postalPrefix?: string
  locality?: string
  timeZone?: string
  ruleSource?: "postal" | "channel"
}

// docs/HORAS+DE+CORTE+Pedido+de+Recolha+por+Canal+27mar.pdf,
// row: Aplicações Cliente e Webservices / Recolha até às 19h00 / PT-ES/INT.
const OUTBOUND_CHANNEL_RULES = {
  ES: { cutoff: "12:00", route: "Portugal → Espanha" },
  RM: { cutoff: "12:00", route: "Portugal → Internacional" },
} as const

/** Advisory only: the table does not guarantee acceptance or working-day availability. */
export function getCttPickupCutoff(input: {
  postalCode: string; country: string; destination: string; date: string; period: string
}, now: Date): PickupCutoffNotice {
  const unknown = (message: string): PickupCutoffNotice => ({ state: "unknown", title: "Hora-limite por confirmar", message })
  if (input.country.toUpperCase() !== "PT") {
    if (input.destination === "PT" && input.period === "09:00-19:00") {
      if (input.country.toUpperCase() === "ES") return unknown("Espanha → Portugal: a tabela de Webservices indica pedido até às 10:00 no dia da recolha. Confirme com os CTT o fuso horário e a disponibilidade; o aviso automático por CP português não se aplica a esta origem.")
      return unknown("Internacional → Portugal (EMS Internacional Inbound): a tabela exige pedido no dia anterior à recolha (D-1), sem indicar uma hora exata nesta coluna. Confirme o horário da origem com os CTT.")
    }
    return unknown("A tabela não define esta combinação de origem, destino e janela. Confirme o horário com os CTT.")
  }
  const postal = input.postalCode.replace(/\s/g, "")
  if (!/^\d{4}(?:-?\d{3})?$/.test(postal)) return unknown("Preencha o código postal da morada de recolha para consultar a hora-limite.")
  const prefix = postal.slice(0, 4)
  const entry = CTT_PICKUP_CUTOFFS[prefix]
  if (input.period !== "09:00-19:00") return unknown("A regra importada corresponde a recolhas até às 19h. Confirme a hora-limite da janela selecionada.")
  if (!["PT", "ES", "RM"].includes(input.destination)) return unknown("Selecione o destino para consultar a hora-limite.")
  if (input.destination === "PT" && !entry) return unknown(`O CP ${prefix} não consta da tabela importada. Isto não significa que não exista recolha; confirme o horário com os CTT.`)
  const outbound = input.destination === "PT" ? undefined : OUTBOUND_CHANNEL_RULES[input.destination as keyof typeof OUTBOUND_CHANNEL_RULES]
  const locality = entry?.[0]
  const cutoff = outbound ? outbound.cutoff : entry[1]
  const timeZone = Number(prefix) >= 9500 ? "Atlantic/Azores" : "Europe/Lisbon"
  const date = new Date(`${input.date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date || !Number.isFinite(now.getTime())) return unknown("Selecione uma data de recolha válida.")
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const part = (name: string) => parts.find(p => p.type === name)!.value
  const today = `${part("year")}-${part("month")}-${part("day")}`
  const meta = { cutoff, postalPrefix: prefix, locality, timeZone, ruleSource: outbound ? "channel" as const : "postal" as const }
  const scope = outbound ? `${outbound.route} · canal Webservices · CP de recolha ${prefix}` : `Portugal → Portugal · CP ${prefix} · ${locality}`
  const timing = `Hora-limite de referência: ${cutoff}, hora local da recolha. ${scope}.`
  if (input.date < today) return { ...meta, state: "past", title: "A data de recolha já passou", message: "Selecione hoje ou uma data futura." }
  if (input.date > today) return { ...meta, state: "future", title: `Pedido até às ${cutoff} no dia da recolha`, message: timing }
  const [hour, minute] = cutoff.split(":").map(Number)
  const remaining = hour * 60 + minute - (Number(part("hour")) * 60 + Number(part("minute")))
  if (remaining <= 0) return { ...meta, state: "passed", title: `Hora-limite de hoje atingida (${cutoff})`, message: `${timing} A recolha para hoje pode ser recusada. Escolha outra data ou confirme a disponibilidade com os CTT.` }
  if (remaining <= 30) return { ...meta, state: "soon", title: `Faltam ${remaining} min para a hora-limite`, message: timing }
  return { ...meta, state: "within", title: `Pedido para hoje: hora-limite ${cutoff}`, message: timing }
}
