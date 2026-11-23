import { requirePortalStore } from "@/lib/client-portal/access"
import { ClientWebOrders } from "../../components/ClientWebOrders"

export const dynamic = "force-dynamic"

export default async function EncomendasWebPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { client } = await requirePortalStore((await params).storeSlug)
  return <ClientWebOrders key={client.id} />
}
