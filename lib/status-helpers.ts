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
      return {
        label: "Pendente",
        color: "bg-amber-50 text-amber-900 border border-amber-200/80 font-medium",
        dotColor: "bg-amber-600",
        badgeVariant: "warning",
      }
    case "em_transito":
    case "em_transito_hub":
    case "recolhido":
      return {
        label: "Em Trânsito",
        color: "bg-blue-50 text-blue-900 border border-blue-200/80 font-medium",
        dotColor: "bg-blue-600",
        badgeVariant: "info",
      }
    case "em_distribuicao":
      return {
        label: "Em Distribuição",
        color: "bg-violet-50 text-violet-900 border border-violet-200/80 font-medium",
        dotColor: "bg-violet-600",
        badgeVariant: "purple",
      }
    case "entregue":
      return {
        label: "Entregue",
        color: "bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-medium",
        dotColor: "bg-emerald-600",
        badgeVariant: "success",
      }
    case "entregue_pudo":
    case "entregue_em_pudo":
      return {
        label: "Entregue (PUDO)",
        color: "bg-teal-50 text-teal-900 border border-teal-200/80 font-medium",
        dotColor: "bg-teal-600",
        badgeVariant: "success",
      }
    case "incidencia":
    case "com_incidencia":
      return {
        label: "Incidência",
        color: "bg-rose-50 text-rose-900 border border-rose-200/80 font-medium",
        dotColor: "bg-rose-600",
        badgeVariant: "danger",
      }
    case "devolvido":
      return {
        label: "Devolvido",
        color: "bg-slate-100 text-slate-800 border border-slate-200 font-medium",
        dotColor: "bg-slate-500",
        badgeVariant: "neutral",
      }
    case "cancelado":
      return {
        label: "Cancelado",
        color: "bg-slate-100 text-slate-700 border border-slate-200 font-medium",
        dotColor: "bg-slate-400",
        badgeVariant: "neutral",
      }
    default:
      const formatted = status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "Pendente"
      return {
        label: formatted,
        color: "bg-slate-100 text-slate-800 border border-slate-200 font-medium",
        dotColor: "bg-slate-400",
        badgeVariant: "default",
      }
  }
}
