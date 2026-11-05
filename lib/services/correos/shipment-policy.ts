import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { CorreosShipmentOutput } from "./types"

export const CORREOS_PARTNER_PORTAL_URL = "https://my.correosexpress.pt/account"

export function isCorreosSingleParcelService(service: Partial<ServicoLinke>): boolean {
  if (service.carrier_group === "ctt") return false
  if (service.webservice_service_code) return service.webservice_service_code.trim() === "90"
  return service.single_parcel_only === true
}

/**
 * Correos products booked by Linke through its partner account (quotation flow).
 * "91" (Internacional Express) is planned for later: add it here and expose it in
 * the client service DTO once its partner tariffs are validated.
 */
export const CORREOS_QUOTATION_PRODUCTS: readonly string[] = ["90"]

/** Correos Internacional Standard (product 90), the only table booked by Linke through its partner account. */
export function isCorreosQuotationService(service?: Partial<ServicoLinke> | null): boolean {
  if (!service || service.carrier_group === "ctt") return false
  const product = service.webservice_service_code?.trim()
  if (product) return CORREOS_QUOTATION_PRODUCTS.includes(product)
  return service.single_parcel_only === true || service.id === "srv_linke_cor_intl"
}

/** Only Correos 90 to destinations outside Portugal and Spain is handled as a quotation request. */
export function requiresCorreosQuotation(carrier: string, country: string, service?: Partial<ServicoLinke> | null): boolean {
  const iso = country.trim().toUpperCase()
  return carrier === "correos" && isCorreosQuotationService(service) && /^[A-Z]{2}$/.test(iso) && iso !== "PT" && iso !== "ES"
}

export function correosShipmentError(result: CorreosShipmentOutput, product: string, country: string): string {
  const detail = result.mensajeRetorno || "Erro desconhecido"
  if (/TASAR/i.test(detail)) {
    return `Não foi possível obter a tarifa Correos para o produto ${product} e destino ${country}. Confirme a cobertura e a ativação deste produto no contrato Correos. ${detail} (Código ${result.codigoRetorno})`
  }
  return `Correos Express: ${detail} (Código ${result.codigoRetorno})`
}
