import { redirect } from "next/navigation"

export default async function FaturaPersonalizadaPage() {
  redirect("/ops/faturacao/clientes")
}
