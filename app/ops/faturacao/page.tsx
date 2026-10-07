import { redirect } from "next/navigation"

export default function FaturacaoRedirectPage() {
  redirect("/ops/faturacao/contas-corrente")
}
