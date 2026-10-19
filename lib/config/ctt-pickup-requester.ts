import type { CTTPickupRequester } from "@/lib/services/ctt/ctt-types"
import { DEFAULT_CTT_REQUESTER_PHONE } from "@/lib/pickup-contact"

/** Server-side identity of the CTT account holder, independent of the pickup shop. */
export function getCttPickupRequester(): CTTPickupRequester | undefined {
  const phone = process.env.CTT_PICKUP_REQUESTER_PHONE?.trim() || DEFAULT_CTT_REQUESTER_PHONE
  const mobilePhone = process.env.CTT_PICKUP_REQUESTER_MOBILE?.trim() || undefined
  return {
    name: process.env.CTT_PICKUP_REQUESTER_NAME?.trim() || "Linke",
    phone,
    mobilePhone,
    email: process.env.CTT_PICKUP_REQUESTER_EMAIL?.trim() || undefined,
  }
}
