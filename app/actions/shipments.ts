"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export async function createShipmentAction(formData: FormData) {
  const supabase = createAdminClient()
  
  const client_id = formData.get("client_id") as string
  const service_type = formData.get("service_type") as string
  
  // Sender
  const sender_name = formData.get("sender_name") as string
  const sender_address = formData.get("sender_address") as string
  const sender_zip = formData.get("sender_zip") as string
  const sender_city = formData.get("sender_city") as string
  
  const sender_zip3 = sender_zip?.split("-")[0] || sender_zip
  const sender_zip4 = sender_zip?.split("-")[1] || ""

  // Recipient
  const recipient_name = formData.get("recipient_name") as string
  const recipient_address = formData.get("recipient_address") as string
  const recipient_zip = formData.get("recipient_zip") as string
  const recipient_city = formData.get("recipient_city") as string
  
  const recipient_zip3 = recipient_zip?.split("-")[0] || recipient_zip
  const recipient_zip4 = recipient_zip?.split("-")[1] || ""

  const { data, error } = await supabase
    .from("shipments")
    .insert({
      tenant_id: LINKE_TENANT_ID,
      client_id,
      service_type,
      status: "rascunho",
      sender_name,
      sender_address: `${sender_address}, ${sender_city}`,
      sender_zip3,
      sender_zip4,
      recipient_name,
      recipient_address: `${recipient_address}, ${recipient_city}`,
      recipient_zip3,
      recipient_zip4,
      buy_price: 0,
      sell_price: 5.50
    })
    .select()

  if (error) {
    console.error("Error creating shipment:", error)
    throw new Error(error.message)
  }

  // Create package info
  if (data && data[0]) {
    await supabase.from("packages").insert({
      tenant_id: LINKE_TENANT_ID,
      shipment_id: data[0].id,
      weight_g: 1000 // default 1kg
    })
  }

  revalidatePath("/ops/envios")
  return { success: true, id: data?.[0]?.id }
}

export async function dispatchShipmentAction(shipmentId: string) {
  const supabase = createAdminClient()

  const { data: shipment, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .single()

  if (error || !shipment) {
    throw new Error("Shipment not found")
  }

  // Check if it's a CTT service
  if (shipment.service_type?.includes("ctt")) {
    const { emitCttShipmentAction } = await import("./ctt")
    
    return emitCttShipmentAction({
      id: shipment.id,
      ref: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
      sender: {
        name: shipment.sender_name,
        address: shipment.sender_address,
        zip: `${shipment.sender_zip3}-${shipment.sender_zip4}`,
        city: "Localidade",
        phone: "910000000" // mocked phone for now since it's not in DB
      },
      recipient: {
        name: shipment.recipient_name,
        address: shipment.recipient_address,
        zip: `${shipment.recipient_zip3}-${shipment.recipient_zip4}`,
        city: "Localidade",
        phone: "920000000"
      },
      weightKg: 1, // mocked for now
      volumes: 1,
      subProduct: "ERS 24"
    })
  } else {
    throw new Error("Service not yet integrated: " + shipment.service_type)
  }
}
