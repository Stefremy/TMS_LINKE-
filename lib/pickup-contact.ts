export const DEFAULT_CTT_REQUESTER_PHONE = "255000000"

/** Read the submitted controls, including values inserted by browser autofill. */
export function readPickupContact(formData: Pick<FormData, "get">) {
  const phoneValue = formData.get("pickupPhone")
  const mobileValue = formData.get("pickupMobilePhone")
  const primaryPhone = typeof phoneValue === "string" ? phoneValue.trim() : ""
  const mobilePhone = typeof mobileValue === "string" ? mobileValue.trim() : ""
  return {
    phone: primaryPhone || mobilePhone,
    mobilePhone: mobilePhone || undefined,
  }
}

/** Per-pickup requester overrides; never changes the authenticated CTT account. */
export function readPickupRequester(formData: Pick<FormData, "get">) {
  const read = (name: string) => {
    const value = formData.get(name)
    return typeof value === "string" ? value.trim() : ""
  }
  return {
    name: read("requesterName"),
    phone: read("requesterPhone") || DEFAULT_CTT_REQUESTER_PHONE,
    mobilePhone: read("requesterMobile") || undefined,
    email: read("requesterEmail") || undefined,
  }
}
