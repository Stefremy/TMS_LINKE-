import * as React from "react"
import { getReembolsoBatchesAction } from "@/app/actions/reembolsos"
import ReembolsosClient from "./ReembolsosClient"

export const dynamic = "force-dynamic"

export default async function ReembolsosPage() {
  const batches = await getReembolsoBatchesAction()

  return (
    <div className="space-y-6">
      <ReembolsosClient initialBatches={batches} />
    </div>
  )
}
