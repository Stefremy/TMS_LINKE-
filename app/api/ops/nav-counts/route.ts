import { NextResponse } from "next/server"
import { requireEmployee } from "@/lib/auth/context"
import { getUnreadShipmentQuotationsAction } from "@/app/actions/shipment-quotations"
import { getPendingClientPickupRequestsCountAction } from "@/app/actions/client-pickup-requests"
import { getOpenSupportRequestsCountAction } from "@/app/actions/support-requests"

export const dynamic = "force-dynamic"

/**
 * The three Ops sidebar badges in one GET. A route handler, not Server Actions: Next.js runs a
 * browser's Server Actions one at a time, so background polls would queue in front of user clicks.
 * Each count keeps its own permission check; a count the user may not see comes back as null.
 */
export async function GET(request: Request) {
  await requireEmployee()
  const want = new Set((new URL(request.url).searchParams.get("want") || "").split(","))
  const read = async (key: string, load: () => Promise<number>) => {
    if (!want.has(key)) return null
    try { return await load() } catch { return null }
  }
  const [quotes, pickups, support] = await Promise.all([
    read("quotes", getUnreadShipmentQuotationsAction),
    read("pickups", getPendingClientPickupRequestsCountAction),
    read("support", getOpenSupportRequestsCountAction),
  ])
  return NextResponse.json({ quotes, pickups, support }, { headers: { "Cache-Control": "private, no-store" } })
}
