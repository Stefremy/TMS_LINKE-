import type { Cliente } from "@/app/ops/entidades/clientes/types"

type AddressClient = Pick<Partial<Cliente>, "address" | "postal_code" | "city" | "country_code" | "billing_same_as_pickup" | "billing_address" | "billing_postal_code" | "billing_city" | "billing_country_code">
const clean = (value: unknown): string => typeof value === "string" ? value.trim() : ""
const country = (value: unknown): string => clean(value).toUpperCase() === "UK" ? "GB" : clean(value).toUpperCase()

/** Legacy profiles use the principal address until a separate fiscal address is set. */
export function usesPrincipalBillingAddress(client: AddressClient): boolean {
  if (typeof client.billing_same_as_pickup === "boolean") return client.billing_same_as_pickup
  return ![client.billing_address, client.billing_postal_code, client.billing_city, client.billing_country_code].some(value => clean(value))
}

export function normalizeClientBillingFields(client: AddressClient) {
  if (client.billing_same_as_pickup !== undefined && typeof client.billing_same_as_pickup !== "boolean") {
    throw new Error("Indique se a morada de faturação é igual à morada principal.")
  }
  return {
    billing_same_as_pickup: usesPrincipalBillingAddress(client),
    billing_address: clean(client.billing_address), billing_postal_code: clean(client.billing_postal_code),
    billing_city: clean(client.billing_city), billing_country_code: country(client.billing_country_code),
  }
}

export function getClientBillingAddress(client: AddressClient) {
  const same = usesPrincipalBillingAddress(client)
  return same
    ? { address: clean(client.address), postal_code: clean(client.postal_code), city: clean(client.city), country_code: country(client.country_code || "PT") }
    : { address: clean(client.billing_address), postal_code: clean(client.billing_postal_code), city: clean(client.billing_city), country_code: country(client.billing_country_code) }
}

/** Never mix an incomplete separate fiscal address with the pickup address. */
export function invoiceBillingAddress(client: AddressClient) {
  const address = getClientBillingAddress(client)
  if (!usesPrincipalBillingAddress(client) && (!address.address || !address.postal_code || !address.city || !/^[A-Z]{2}$/.test(address.country_code))) {
    throw new Error("Complete a morada de faturação: rua, código postal, localidade e país.")
  }
  return address
}

/** Preserve both source addresses when importing an old platform export. */
export function billingFieldsFromLegacyRow(row: Record<string, unknown>) {
  const fiscal = {
    billing_address: clean(row["Morada Faturação"]), billing_postal_code: clean(row["Código Postal Faturação"]),
    billing_city: clean(row["Localidade Faturação"]), billing_country_code: country(row["País Faturação"]),
  }
  const comparable = (value: unknown) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase()
  const complete = Object.values(fiscal).every(Boolean)
  const same = complete && comparable(fiscal.billing_address) === comparable(row.Morada)
    && fiscal.billing_postal_code.replace(/\W/g, "") === clean(row["Código Postal"]).replace(/\W/g, "")
    && comparable(fiscal.billing_city) === comparable(row.Localidade)
    && fiscal.billing_country_code === country(row.País)
  return { billing_same_as_pickup: same, ...fiscal }
}
