import { getColaboradoresAction } from "@/app/actions/colaboradores"
import { ColaboradoresClient } from "./components/ColaboradoresClient"

export const dynamic = "force-dynamic"

export default async function ColaboradoresPage() {
  const colaboradores = await getColaboradoresAction()

  return <ColaboradoresClient initialColaboradores={colaboradores || []} />
}
