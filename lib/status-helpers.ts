export interface StatusConfig {
  label: string
  color: string
  dotColor: string
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple'
}

export function getShipmentStatusConfig(rawStatus: any): StatusConfig {
  const status = typeof rawStatus === 'string' ? rawStatus : String(rawStatus || "")
  const norm = status.toLowerCase().replace(/[\s-]+/g, "_")
  
  switch (norm) {
    case "pendente":
    case "aguarda_entrada":
    case "entrada_rede":
      return {
        label: "Aguarda Entrada",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-amber-500",
        badgeVariant: "warning",
      }
    case "em_transito":
    case "em_transito_hub":
    case "recolhido":
      return {
        label: "Em Trânsito",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-blue-500",
        badgeVariant: "info",
      }
    case "em_distribuicao":
      return {
        label: "Em Distribuição",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-violet-500",
        badgeVariant: "purple",
      }
    case "entregue":
      return {
        label: "Entregue",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-[var(--status-success)]",
        badgeVariant: "success",
      }
    case "entregue_pudo":
    case "entregue_em_pudo":
      return {
        label: "Entregue (PUDO)",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-[var(--status-success)]",
        badgeVariant: "success",
      }
    case "incidencia":
    case "com_incidencia":
      return {
        label: "Incidência",
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-[var(--status-critical)]",
        badgeVariant: "danger",
      }
    case "devolvido":
      return {
        label: "Devolvido",
        color: "bg-slate-50 text-slate-600 border border-slate-200 font-semibold",
        dotColor: "bg-slate-400",
        badgeVariant: "neutral",
      }
    case "cancelado":
      return {
        label: "Cancelado",
        color: "bg-slate-50 text-slate-600 border border-slate-200 font-semibold",
        dotColor: "bg-slate-400",
        badgeVariant: "neutral",
      }
    default:
      const formatted = status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "Pendente"
      return {
        label: formatted,
        color: "bg-white text-slate-700 border border-slate-300 font-semibold shadow-xs",
        dotColor: "bg-slate-400",
        badgeVariant: "default",
      }
  }
}
