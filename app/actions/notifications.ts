"use server";

import { supportsDatabaseFeature } from "@/lib/supabase/schema-capabilities";

import { createAdminClient } from "@/lib/supabase/server";
import { getClientesAction } from "@/app/actions/clientes";
import { getCarrierConnectionsAction } from "@/app/actions/ctt";
import { requireEmployee } from "@/lib/auth/context";
import { fetchCalendarEventRange } from "./calendar";
import { addDays, todayKey } from "@/features/calendar/lib/dates";
import { upcomingPersonalEvents } from "@/features/calendar/lib/reminders";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { QUOTATION_ACTION } from "@/lib/shipments/quotations/types";

export interface OperationalNotification {
  id: string;
  type:
    | "shipment"
    | "batch"
    | "client"
    | "system"
    | "warning"
    | "success"
    | "calendar";
  title: string;
  message: string;
  timestamp: string;
  link?: string;
  actionLabel?: string;
  priority: "high" | "medium" | "low";
  isRead?: boolean;
}

export async function getOperationalNotificationsAction(): Promise<
  OperationalNotification[]
> {
  const ctx = await requireEmployee();
  const notifications: OperationalNotification[] = [];
  const now = new Date();

  try {
    const supabase = createAdminClient();

    let pendingQuery = supabase.from("shipments")
      .select("id, created_at, ops_substatus").eq("tenant_id", ctx.tenant_id)
      .eq("status", "pendente").in("carrier_code", ["ctt", "ctt_expresso"])
    if (await supportsDatabaseFeature(supabase, "shipments.ctt_manifest_pdf"))
      pendingQuery = pendingQuery.is("ctt_manifest_pdf", null)

    // Run highly optimized direct queries instead of downloading all table data to memory
    const [
      { data: pendingRows },
      { data: recentShipments },
      clients,
      connections,
    ] = await Promise.all([
      pendingQuery.order("created_at", { ascending: true }),
      supabase
        .from("shipments")
        .select(
          "id, tracking_number, sender_name, recipient_name, service_type, created_at, status",
        )
        .eq("tenant_id", ctx.tenant_id)
        .order("created_at", { ascending: false })
        .limit(5),
      getClientesAction().catch(() => []),
      getCarrierConnectionsAction().catch(() => []),
    ]);

    const pendingShipments = pendingRows?.filter(
      (s: { ops_substatus?: string }) =>
        !["manifesto_fechado", "expedido"].includes(s.ops_substatus || ""),
    );
    // Manifest closure and physical shipment status are independent.
    if (pendingShipments && pendingShipments.length > 0) {
      notifications.push({
        id: `batch-pending-${pendingShipments.length}`,
        type: "batch",
        title: "Fecho de Manifesto CTT Pendente",
        message: `Existem ${pendingShipments.length} envio(s) pendente(s) de fecho de lote e geração de manifesto de recolha diária.`,
        timestamp: pendingShipments[0]?.created_at || now.toISOString(),
        link: "/ops/envios",
        actionLabel: "Fechar Lote CTT",
        priority: "high",
      });
    }

    // 2. Recent Shipments (last 5 shipments)
    if (recentShipments) {
      recentShipments.forEach(
        (s: {
          id: string;
          tracking_number: string | null;
          sender_name: string | null;
          recipient_name: string | null;
          service_type: string | null;
          created_at: string;
          status: string;
        }) => {
          const tracking =
            s.tracking_number || s.id?.substring(0, 8).toUpperCase();
          const clientName = s.sender_name || "Cliente";
          const recipient = s.recipient_name || "Destinatário";
          const service = s.service_type || "CTT Expresso 24H";

          notifications.push({
            id: `shipment-${s.id || tracking}`,
            type: "shipment",
            title: `Novo Envio Registado (${tracking})`,
            message: `${clientName} emitiu um envio para ${recipient} via ${service}.`,
            timestamp: s.created_at || now.toISOString(),
            link: "/ops/envios",
            actionLabel: "Ver Envio",
            priority: s.status === "pendente" ? "medium" : "low",
          });
        },
      );
    }

    // 3. Inactive Clients Alert (if any client is deactivated)
    const inactiveClients = clients.filter((c) => !c.is_active);
    if (inactiveClients.length > 0) {
      notifications.push({
        id: `inactive-clients-${inactiveClients.length}`,
        type: "client",
        title: "Clientes Inativos / Bloqueados",
        message: `${inactiveClients.length} conta(s) cliente estão atualmente desativadas (${inactiveClients
          .map((c) => c.short_name)
          .slice(0, 2)
          .join(", ")}${inactiveClients.length > 2 ? "..." : ""}).`,
        timestamp: now.toISOString(),
        link: "/ops/entidades/clientes",
        actionLabel: "Gerir Clientes",
        priority: "medium",
      });
    }

    // 4. Webservice Connection Status
    const cttConn = connections.find(
      (c: { carrier_id?: string; carrier_code?: string }) =>
        c.carrier_id === "ctt" || c.carrier_code === "ctt",
    );
    const isCttActive = cttConn?.is_active ?? true;

    if (!isCttActive) {
      notifications.push({
        id: "ws-ctt-warning",
        type: "warning",
        title: "Alerta de Webservice CTT",
        message:
          "O webservice CTT Expresso requer atenção ou validação de credenciais de produção.",
        timestamp: now.toISOString(),
        link: "/ops/configuracao/webservices",
        actionLabel: "Configurar API",
        priority: "high",
      });
    }
  } catch (err) {
    console.warn(
      "Error gathering operational notifications:",
      err instanceof Error ? err.message : "Consulta indisponível",
    );
  }

  if ([PERMISSIONS.shipments, PERMISSIONS.clients, PERMISSIONS.support].some(permission => hasPermission(ctx, permission))) {
    try {
      const { data, error } = await createAdminClient().from("audit_log")
        .select("id,created_at,reference:details->>reference,client_name:details->>client_name,status:details->>status,updated_at:details->>updated_at")
        .eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION)
        .in("details->>status", ["pending", "reviewing", "accepted"])
        .order("created_at", { ascending: false }).limit(5);
      if (!error) for (const row of data || []) notifications.push({ id: `quotation-${row.id}-${row.status}`,
        type: "shipment", title: row.status === "accepted" ? "Cotação aceite pelo cliente" : "Pedido de cotação internacional",
        message: `${row.reference} · ${row.client_name}`, timestamp: row.updated_at || row.created_at,
        link: `/ops/envios/cotacoes?pedido=${row.id}`, actionLabel: "Ver cotação", priority: "medium" });
    } catch { /* Other operational notifications remain available. */ }
  }

  // Personal calendar reminders remain available throughout Ops, not only on the calendar page.
  try {
    const today = todayKey(now);
    const { events } = await fetchCalendarEventRange(today, addDays(today, 1));
    const viewer = {
      id: ctx.user.id,
      email: ctx.user.email || "",
      tenantId: ctx.tenant_id,
      isAdmin: ctx.role === "admin",
      collaboratorId: ctx.colaborador_id,
    };
    for (const { event, day, soon } of upcomingPersonalEvents(
      events,
      viewer,
      now,
    )) {
      const when = day === today ? "hoje" : "amanhã";
      notifications.push({
        id: `calendar-${ctx.user.id}-${event.id}-${day}-${event.updated_at}`,
        type: "calendar",
        title: soon ? "Evento a aproximar-se" : `Evento ${when}`,
        message: `${event.title} · ${when}${event.all_day ? " · todo o dia" : ` às ${event.time}`}`,
        timestamp: now.toISOString(),
        link: `/ops/calendario?view=day&date=${day}&event=${encodeURIComponent(event.id)}`,
        actionLabel: "Ver evento",
        priority: soon ? "high" : "medium",
      });
    }
  } catch {
    /* A calendar outage must not hide shipment or operational alerts. */
  }

  // Sort by timestamp descending
  return notifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
