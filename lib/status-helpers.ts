export interface StatusConfig {
  label: string
  color: string
  dotColor: string
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple'
}

export function getShipmentStatusConfig(status: string | null | undefined): StatusConfig {
  const norm = (status || "").toLowerCase().replace(/[\s-]+/g, "_")
  
  switch (norm) {
    case "pendente":
      return {
        label: "Pendente",
        color: "bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold",
        dotColor: "bg-amber-500",
        badgeVariant: "warning",
      }
    case "em_transito":
    case "em_transito_hub":
    case "recolhido":
      return {
        label: "Em Trânsito",
        color: "bg-blue-50 text-blue-800 border border-blue-200/80 font-semibold",
        dotColor: "bg-blue-500",
        badgeVariant: "info",
      }
    case "em_distribuicao":
      return {
        label: "Em Distribuição",
        color: "bg-purple-50 text-purple-800 border border-purple-200/80 font-semibold",
        dotColor: "bg-purple-500",
        badgeVariant: "purple",
      }
    case "entregue":
      return {
        label: "Entregue",
        color: "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold",
        dotColor: "bg-emerald-500",
        badgeVariant: "success",
      }
    case "incidencia":
    case "com_incidencia":
      return {
        label: "Incidência",
        color: "bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold",
        dotColor: "bg-rose-500",
        badgeVariant: "danger",
      }
    case "devolvido":
      return {
        label: "Devolvido",
        color: "bg-slate-100 text-slate-800 border border-slate-300 font-semibold",
        dotColor: "bg-slate-500",
        badgeVariant: "neutral",
      }
    case "cancelado":
      return {
        label: "Cancelado",
        color: "bg-red-50 text-red-700 border border-red-200 font-semibold",
        dotColor: "bg-red-500",
        badgeVariant: "danger",
      }
    default:
      const formatted = status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "Pendente"
      return {
        label: formatted,
        color: "bg-slate-50 text-slate-700 border border-slate-200 font-medium",
        dotColor: "bg-slate-400",
        badgeVariant: "default",
      }
  }
}
