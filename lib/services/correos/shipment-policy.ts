import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { CorreosShipmentOutput } from "./types"

export const CORREOS_PARTNER_PORTAL_URL = "https://my.correosexpress.pt/account"

export function requiresCorreosQuotation(carrier: string, country: string): boolean {
  const iso = country.trim().toUpperCase()
  return carrier === "correos" && /^[A-Z]{2}$/.test(iso) && iso !== "PT" && iso !== "ES"
}

export function isCorreosSingleParcelService(service: Partial<ServicoLinke>): boolean {
  if (service.carrier_group === "ctt") return false
  if (service.webservice_service_code) return service.webservice_service_code.trim() === "90"
  return service.single_parcel_only === true
}

export function correosShipmentError(result: CorreosShipmentOutput, product: string, country: string): string {
  const detail = result.mensajeRetorno || "Erro desconhecido"
  if (/TASAR/i.test(detail)) {
    return `Não foi possível obter a tarifa Correos para o produto ${product} e destino ${country}. Confirme a cobertura e a ativação deste produto no contrato Correos. ${detail} (Código ${result.codigoRetorno})`
  }
  return `Correos Express: ${detail} (Código ${result.codigoRetorno})`
}
