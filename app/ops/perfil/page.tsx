import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getMyProfile } from "@/lib/auth/profile"
import { PerfilClient } from "./PerfilClientView"
export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const profile = await getMyProfile()

  return <PerfilClient user={user} profile={profile} />
}
