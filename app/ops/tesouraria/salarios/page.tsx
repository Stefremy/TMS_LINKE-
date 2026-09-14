import * as React from "react"
import { getSalariosAction } from "@/app/actions/salarios"
import { SalariosClient } from "./components/SalariosClient"

export const metadata = {
  title: "Salários & Vencimentos | Linke Logistics TMS",
  description: "Gestão e controlo de folha salarial, recibos de vencimento e retenções fiscais da equipa Linke Logistics.",
}

export default async function SalariosPage() {
  const salarios = await getSalariosAction()

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <SalariosClient initialSalarios={salarios || []} />
    </div>
  )
}
