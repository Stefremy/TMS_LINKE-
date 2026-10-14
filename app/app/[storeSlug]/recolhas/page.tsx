import { redirect } from "next/navigation"
import { requirePortalStore } from "@/lib/client-portal/access"

export default async function RecolhasPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { basePath } = await requirePortalStore((await params).storeSlug)
  redirect(basePath)
}
