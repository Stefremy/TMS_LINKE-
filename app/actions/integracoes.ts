"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export async function getIntegrations() {
  const supabase = createAdminClient()
  
  const { data: integrations, error } = await supabase
    .from("tenant_integrations")
    .select("*")
    .eq("tenant_id", LINKE_TENANT_ID)

  if (error) {
    console.error("Error fetching integrations:", error)
    return []
  }

  return integrations || []
}

export async function saveIntegration(formData: FormData) {
  const supabase = createAdminClient()
  
  const provider = formData.get("provider") as string
  const clientId = formData.get("client_id") as string
  const password = formData.get("password") as string
  const contractNumber = formData.get("contract_number") as string
  
  const credentials = {
    client_id: clientId,
    password: password,
    contract_number: contractNumber
  }

  const { error } = await supabase
    .from("tenant_integrations")
    .upsert({
      tenant_id: LINKE_TENANT_ID,
      provider: provider,
      credentials: credentials,
      is_active: true
    }, { onConflict: "tenant_id,provider" })

  if (error) {
    console.error("Error saving integration:", error)
    throw new Error("Failed to save integration")
  }

  revalidatePath("/ops/integracoes")
  redirect("/ops/integracoes")
}
