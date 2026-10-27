// Classify contact channels without treating landlines as mobile phones.
// Belgium's mobile ranges (+32 45–49): https://www.ituob.org/issues/1142/
const CONTACT_NUMBER_PLANS = [
  { country: "PT", prefix: "351", mobile: /^9\d{8}$/ },
  { country: "ES", prefix: "34", mobile: /^[67]\d{8}$/ },
  { country: "FR", prefix: "33", mobile: /^(?:6\d|7[3-9])\d{7}$/ },
  { country: "GB", prefix: "44", mobile: /^7[1-57-9]\d{8}$/ },
  { country: "BE", prefix: "32", mobile: /^4[5-9]\d{7}$/ },
]

export function normalizeCttContactPhone(value: string | undefined, destinationCountry: string) {
  const country = destinationCountry.trim().toUpperCase()
  let compact = (value || "").replace(/[\s().-]+/g, "").replace(/^00/, "+")
  // Accept a full mobile number entered with its calling code but without +/00.
  // Requiring a complete mobile match avoids stripping digits from local numbers.
  if (!compact.startsWith("+") && CONTACT_NUMBER_PLANS.some(item =>
    compact.startsWith(item.prefix) && item.mobile.test(compact.slice(item.prefix.length)))) {
    compact = `+${compact}`
  }
  const international = compact.startsWith("+")
  // The number's explicit prefix takes precedence over the address country.
  const plan = international
    ? CONTACT_NUMBER_PLANS.find(item => compact.startsWith(`+${item.prefix}`))
    : CONTACT_NUMBER_PLANS.find(item => item.country === country)
  const national = international && plan ? compact.slice(plan.prefix.length + 1) : compact
  const mobileDigits = !international && ["FR", "GB", "BE"].includes(plan?.country || "")
    ? national.replace(/^0/, "") : national
  return {
    value: international && plan?.country === country && ["PT", "ES"].includes(country) ? national : compact,
    mobile: plan?.mobile.test(mobileDigits) ?? false,
  }
}

export function hasCttRecipientMobilePhone(phone: string | undefined, country: string): boolean {
  return normalizeCttContactPhone(phone, country).mobile
}

export function getCttRecipientContactError(contact: {
  country?: string
  phone?: string
  mobilePhone?: string
  email?: string
}): string | null {
  if (contact.email?.trim() || contact.mobilePhone?.trim() ||
      hasCttRecipientMobilePhone(contact.phone, contact.country || "PT")) return null
  return "Para este envio CTT, indique um e-mail ou telemóvel do destinatário. Um telefone fixo, por si só, não é suficiente."
}
