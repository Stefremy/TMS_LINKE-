"use client"

import { useMemo } from "react"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { calculateClientShipmentPreview } from "@/lib/pricing/calculate-client-shipment-preview"
import { isCttMultiVolumeService } from "@/lib/pricing/calculate-shipment-price"
import { getClientSpecialFees, isCorreosLinkeService } from "@/lib/pricing/calculate-shipment-quote"
import { resolveCodFee } from "@/lib/pricing/cod-destination-rates"
import { assertShipmentDestinationAvailable } from "@/lib/services/shipment-destination-policy"
import { getServiceDestinationZone } from "@/lib/services/service-destinations"
import { getAuthorizedDestinationCountries, getDestinationServiceOptions, getServiceIslandTransportMode, isDestinationPostalReady, isPortugueseIslandDestination, type IslandTransportMode } from "@/lib/services/shipment-service-options"
import { isCttSpecialServiceAvailable } from "@/lib/services/ctt/special-service-availability"
import type { ShipmentFormRole, ShipmentFormValues } from "./schema"

type Preview = ReturnType<typeof calculateClientShipmentPreview>
export type ShipmentQuoteOption = { service: ServicoLinke; carrier: "ctt" | "correos"; zone: string; quote: Preview | null; error: string | null }
export type ShipmentQuoteInput = { client: Cliente; services: ServicoLinke[]; values: ShipmentFormValues; role: ShipmentFormRole }

/** Pure composition of the existing coverage, COD, extras and pricing policies. */
export function getShipmentQuote({ client, services, values, role }: ShipmentQuoteInput) {
  const available = services.filter(service => service.is_active !== false && (!Array.isArray(client.assigned_linke_service_ids) || client.assigned_linke_service_ids.includes(service.id)))
  const countries = getAuthorizedDestinationCountries(available)
  const destinationReady = isDestinationPostalReady(values.recipientCountry, values.recipientPostal)
  const isIsland = isPortugueseIslandDestination(values.recipientCountry, values.recipientPostal)
  const destinationServices = getDestinationServiceOptions(available, values.recipientCountry, values.recipientPostal)
  const islandModes = [...new Set(destinationServices.map(getServiceIslandTransportMode))]
  const selectedMode = isIsland ? values.islandTransportMode || (islandModes.length === 1 ? islandModes[0] : undefined) : undefined
  const multiVolumeServiceRequired = values.volumesCount > 1
  const compatible = isIsland && !selectedMode ? [] : getDestinationServiceOptions(available, values.recipientCountry, values.recipientPostal, selectedMode as IslandTransportMode | undefined)
  const fees = getClientSpecialFees(client).map(fee => resolveCodFee(fee, values.recipientCountry, values.recipientPostal))
  const codesFor = (service: ServicoLinke) => values.selectedSpecialServices.filter(code => fees.some(fee => fee.is_enabled && fee.special_service_code === code && code.startsWith("correos_") === isCorreosLinkeService(service) && isCttSpecialServiceAvailable(code, values.recipientCountry, values.recipientPostal)))
  const rawOptions: ShipmentQuoteOption[] = compatible.filter(service => role !== "ops" || !values.carrierOverride || values.carrierOverride === (isCorreosLinkeService(service) ? "correos" : "ctt")).map(service => {
    const carrier: ShipmentQuoteOption["carrier"] = isCorreosLinkeService(service) ? "correos" : "ctt"
    const zone = getServiceDestinationZone(service, values.recipientCountry, values.recipientPostal)
    try {
      if (!service.name.trim()) throw new Error("O serviço não tem um nome configurado.")
      const selectedCodes = codesFor(service)
      const quote = calculateClientShipmentPreview(values.weightKg, client, service, values.recipientCountry, values.recipientPostal,
        selectedCodes, selectedCodes.some(code => code === "cod" || code === "correos_cod") ? values.codValue : 0,
        { lengthCm: values.lengthCm, widthCm: values.widthCm, heightCm: values.heightCm, volumesCount: values.volumesCount,
          parcelWeightsKg: values.parcelWeightsKg.length ? values.parcelWeightsKg : undefined })
      return { service, carrier, zone, quote, error: null }
    } catch (error) { return { service, carrier, zone, quote: null, error: error instanceof Error ? error.message : "Não foi possível calcular o preço." } }
  })
  const hasSingleVolumeCtt = rawOptions.some(option => option.carrier === "ctt" && !isCttMultiVolumeService(option.service))
  const options = rawOptions.filter(option => multiVolumeServiceRequired
    ? option.carrier === "correos" || isCttMultiVolumeService(option.service)
    : option.carrier === "correos" || !hasSingleVolumeCtt || !isCttMultiVolumeService(option.service))
  const selected = options.find(option => option.service.id === values.serviceId)
  let blockedReason: string | null = null
  if (client.is_active === false || client.portal_access_status === "suspended" || client.portal_access_status === "blocked") blockedReason = "Esta conta está suspensa para a criação de novos envios. Contacte o apoio Linke."
  else if (!countries.length) blockedReason = "Este cliente não tem destinos e tarifas autorizados. Contacte o apoio Linke."
  else if (!destinationReady) blockedReason = "Preencha o país e o código postal completo do destinatário."
  else {
    try { assertShipmentDestinationAvailable(values.recipientCountry, values.recipientPostal) }
    catch (error) { blockedReason = error instanceof Error ? error.message : "Destino indisponível." }
    if (!blockedReason && isIsland && !selectedMode) blockedReason = "Escolha o transporte para as ilhas: aéreo ou marítimo."
    if (!blockedReason && multiVolumeServiceRequired && !options.length) blockedReason = "Para envios CTT com mais de um volume, o cliente precisa de uma tabela Linke associada ao serviço CTT Múltiplo (Webservice EMSF010.01). Este produto só está disponível para Portugal Continental."
    if (!blockedReason && !options.length) blockedReason = "Não existem serviços autorizados com cobertura e tarifas para este destino."
    if (!blockedReason && !selected) blockedReason = "Selecione um serviço de transporte."
    if (!blockedReason && selected?.error) blockedReason = selected.error
  }
  const activeSpecialServices = selected ? codesFor(selected.service) : []
  const specialFees = selected ? fees.filter(fee => fee.is_enabled && fee.special_service_code.startsWith("correos_") === (selected.carrier === "correos") && isCttSpecialServiceAvailable(fee.special_service_code, values.recipientCountry, values.recipientPostal)) : []
  const fuelPct = selected?.quote ? client.pricing?.standard_fuel_surcharge_pct ?? selected.service.fuel_surcharge_pct ?? client.pricing?.fuel_surcharge_pct
    ?? (selected.quote.basePrice > 0 ? Math.round(selected.quote.fuelSurchargeAmount / selected.quote.basePrice * 10000) / 100 : 0) : null
  const multiVolumeServiceUnavailable = multiVolumeServiceRequired && destinationReady && (!isIsland || !!selectedMode) && !options.length
  return { countries, options, selected, activeSpecialServices, specialFees, islandModes, selectedMode, isIsland, destinationReady,
    multiVolumeServiceRequired, multiVolumeServiceUnavailable, quote: selected?.quote ?? null,
    fuelPct, isBlocked: blockedReason !== null, blockedReason }
}

export function useShipmentQuote({ client, services, values, role }: ShipmentQuoteInput) {
  return useMemo(() => getShipmentQuote({ client, services, values, role }), [client, services, values, role])
}
export type ShipmentQuote = ReturnType<typeof getShipmentQuote>
