import * as React from "react"
import { Suspense } from "react"
import { ClientShipmentsHistory } from "../components/ClientShipmentsHistory"
import { Loader2 } from "lucide-react"

export default function EnviosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-sm font-medium">A carregar histórico de envios...</span>
        </div>
      }
    >
      <ClientShipmentsHistory />
    </Suspense>
  )
}
