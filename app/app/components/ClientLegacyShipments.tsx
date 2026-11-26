import { Badge } from "@/components/ui/badge"
import type { LegacyShipment } from "@/app/actions/legacy-shipments"

// Old-platform rows shown inside the main shipments list, read-only and clearly marked.
export type LegacyRow = LegacyShipment & { legacy: true }

const STATUS: Record<string, { label: string; filter: string }> = {
  Delivered: { label: "Entregue", filter: "entregue" },
  Returned: { label: "Devolvido", filter: "devolvido" },
  "Picked Up": { label: "Recolhido", filter: "em transito" },
}
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) : "—"
const statusLabel = (r: LegacyRow) => STATUS[r.status || ""]?.label || r.status || "—"

export const isLegacy = (row: object): row is LegacyRow => "legacy" in row
export const legacyStatusFilter = (r: LegacyRow) => STATUS[r.status || ""]?.filter || ""
export const legacySearchText = (r: LegacyRow) =>
  [r.carrier_tracking_number, r.legacy_trk, r.reference, r.recipient_name, r.recipient_zip, r.recipient_city, r.recipient_phone].join(" ").toLowerCase()

function Tracking({ r }: { r: LegacyRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono font-bold text-xs text-[var(--text-primary)]">{r.carrier_tracking_number || r.legacy_trk}</span>
      <span className="w-fit rounded-sm bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
        title="Envio da plataforma anterior da Linke, só para consulta">Sistema antigo</span>
      <span className="text-[10px] text-[var(--text-tertiary)]">{date(r.shipped_at)}</span>
    </div>
  )
}

const place = (r: LegacyRow) => [r.recipient_zip, r.recipient_city].filter(Boolean).join(" · ") || "—"

export function LegacyTableRow({ r }: { r: LegacyRow }) {
  return (
    <tr className="bg-[var(--surface-muted)]/40">
      <td className="px-2" />
      <td className="py-3"><Tracking r={r} /></td>
      <td className="py-3"><div className="font-semibold text-[var(--text-primary)]">{r.recipient_name || "—"}</div>{r.recipient_phone && <div className="font-mono text-[10px] text-[var(--text-tertiary)]">{r.recipient_phone}</div>}</td>
      <td className="py-3 text-[var(--text-tertiary)] truncate max-w-[200px]">{place(r)}</td>
      <td className="py-3"><span className="text-xs font-semibold text-[var(--text-secondary)]">{r.service || "—"}</span><div className="mt-1.5 text-[var(--text-tertiary)]">{r.volumes ?? "—"} Vol. · {r.weight_kg ?? "—"} kg</div></td>
      <td className="py-3"><Badge variant={r.status === "Delivered" ? "success" : "neutral"}>{statusLabel(r)}</Badge><div className="mt-1 text-[10px] text-[var(--text-tertiary)]">{date(r.status_at)}</div></td>
      <td className="py-3 text-right text-[var(--text-tertiary)]">—</td>
      <td className="py-3" />
    </tr>
  )
}

export function LegacyCard({ r }: { r: LegacyRow }) {
  return (
    <div className="p-3.5 space-y-2 bg-[var(--surface-muted)]/40">
      <div className="flex items-start justify-between gap-2"><Tracking r={r} /><Badge variant={r.status === "Delivered" ? "success" : "neutral"}>{statusLabel(r)}</Badge></div>
      <div className="text-xs"><span className="font-semibold text-[var(--text-primary)]">{r.recipient_name || "—"}</span> <span className="text-[var(--text-tertiary)]">{place(r)}{r.recipient_phone ? ` · ${r.recipient_phone}` : ""}</span></div>
      <div className="text-xs text-[var(--text-secondary)]">{r.service || "—"} · {r.volumes ?? "—"} Vol. · {r.weight_kg ?? "—"} kg</div>
    </div>
  )
}
