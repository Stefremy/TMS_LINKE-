import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PerfilClient } from "./PerfilClientView"
export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <PerfilClient user={user} />
}
