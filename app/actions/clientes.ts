"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export async function getClientes() {
  const supabase = createAdminClient()
  
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", LINKE_TENANT_ID)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clients:", error)
    return []
  }

  return clients
}

export async function createCliente(formData: FormData) {
  const supabase = createAdminClient()
  
  const name = formData.get("name") as string
  const nif = formData.get("nif") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const address = formData.get("address") as string
  const postal_code = formData.get("postal_code") as string
  const city = formData.get("city") as string

  const { error } = await supabase
    .from("clients")
    .insert({
      tenant_id: LINKE_TENANT_ID,
      name,
      nif,
      email,
      phone,
      address,
      postal_code,
      city,
      plan_type: "Starter",
      is_active: true
    })

  if (error) {
    console.error("Error creating client:", error)
    throw new Error("Failed to create client")
  }

  revalidatePath("/ops/clientes")
  redirect("/ops/clientes")
}
