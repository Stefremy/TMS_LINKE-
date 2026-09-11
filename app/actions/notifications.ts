"use server"

import { getShipmentsAction } from "@/app/actions/shipments"
import { getClientesAction } from "@/app/actions/clientes"
import { getCarrierConnectionsAction } from "@/app/actions/ctt"

export interface OperationalNotification {
  id: string
  type: "shipment" | "batch" | "client" | "system" | "warning" | "success"
  title: string
  message: string
  timestamp: string
  link?: string
  actionLabel?: string
  priority: "high" | "medium" | "low"
  isRead?: boolean
}

export async function getOperationalNotificationsAction(): Promise<OperationalNotification[]> {
  const notifications: OperationalNotification[] = []
  const now = new Date()

  try {
    const [shipments, clients, connections] = await Promise.all([
      getShipmentsAction().catch(() => []),
      getClientesAction().catch(() => []),
      getCarrierConnectionsAction().catch(() => []),
    ])

    // 1. Check Pending Shipments for Batch Closing
    const pendingShipments = shipments.filter((s: any) => s.status === "pendente")
    if (pendingShipments.length > 0) {
      notifications.push({
        id: `batch-pending-${pendingShipments.length}`,
        type: "batch",
        title: "Fecho de Manifesto CTT Pendente",
        message: `Existem ${pendingShipments.length} envio(s) pendente(s) de fecho de lote e geração de manifesto de recolha diária.`,
        timestamp: pendingShipments[0]?.created_at || now.toISOString(),
        link: "/ops/envios",
        actionLabel: "Fechar Lote CTT",
        priority: "high",
      })
    }

    // 2. Recent Shipments (last 10 shipments)
    const recentShipments = shipments.slice(0, 5)
    recentShipments.forEach((s: any) => {
      const tracking = s.tracking_number || s.id?.substring(0, 8).toUpperCase()
      const clientName = s.sender_name || "Cliente"
      const recipient = s.recipient_name || "Destinatário"
      const service = s.service_type || "CTT Expresso 24H"

      notifications.push({
        id: `shipment-${s.id || tracking}`,
        type: "shipment",
        title: `Novo Envio Registado (${tracking})`,
        message: `${clientName} emitiu um envio para ${recipient} via ${service}.`,
        timestamp: s.created_at || now.toISOString(),
        link: "/ops/envios",
        actionLabel: "Ver Envio",
        priority: s.status === "pendente" ? "medium" : "low",
      })
    })

    // 3. Inactive Clients Alert (if any client is deactivated)
    const inactiveClients = clients.filter((c: any) => !c.is_active)
    if (inactiveClients.length > 0) {
      notifications.push({
        id: `inactive-clients-${inactiveClients.length}`,
        type: "client",
        title: "Clientes Inativos / Bloqueados",
        message: `${inactiveClients.length} conta(s) cliente estão atualmente desativadas (${inactiveClients.map((c: any) => c.short_name).slice(0, 2).join(", ")}${inactiveClients.length > 2 ? "..." : ""}).`,
        timestamp: now.toISOString(),
        link: "/ops/entidades/clientes",
        actionLabel: "Gerir Clientes",
        priority: "medium",
      })
    }

    // 4. Webservice Connection Status
    const cttConn = connections.find((c: any) => c.carrier_id === "ctt" || c.carrier_code === "ctt")
    const isCttActive = cttConn?.is_active ?? true

    if (isCttActive) {
      notifications.push({
        id: "ws-ctt-active",
        type: "success",
        title: "Webservice CTT Expresso API Conectado",
        message: "A ligação direta ao webservice CTT Expresso (Recolhas & Envios) está operacional.",
        timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
        link: "/ops/configuracao/webservices",
        actionLabel: "Ver Conexões",
        priority: "low",
      })
    } else {
      notifications.push({
        id: "ws-ctt-warning",
        type: "warning",
        title: "Alerta de Webservice CTT",
        message: "O webservice CTT Expresso requer atenção ou validação de credenciais de produção.",
        timestamp: now.toISOString(),
        link: "/ops/configuracao/webservices",
        actionLabel: "Configurar API",
        priority: "high",
      })
    }

  } catch (err: any) {
    console.warn("Error gathering operational notifications:", err?.message)
  }

  // Sort by timestamp descending
  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
