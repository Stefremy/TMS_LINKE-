import { CarrierProvider, ShipmentInput, ShipmentResult, PickupInput, PickupResult, TrackingResult, type Address } from './types'
import { CTTShipmentService, CTTPickupService, CTTTrackingService, CTTConnectionCredentials, CTTAddressData, CTTShipmentData } from '../ctt'
import { validateCttExportDetails } from '../ctt/export-details'
import { getCttShipmentLabel } from '../ctt/shipment-label'
import { getCttRecipientContactError } from '../ctt/recipient-contact'
import { cttParcelObservations, validateParcelDimensions } from '../shipments/parcel-dimensions'

export class CttProvider implements CarrierProvider {
  private creds!: CTTConnectionCredentials
  private shipmentService: CTTShipmentService
  private pickupService: CTTPickupService
  private trackingService: CTTTrackingService

  constructor() {
    this.shipmentService = new CTTShipmentService()
    this.pickupService = new CTTPickupService()
    this.trackingService = new CTTTrackingService()
  }

  async initialize(config: CTTConnectionCredentials): Promise<void> {
    this.creds = config
  }

  private parseZip(zip: string) {
    const clean = (zip || "").replace(/\D/g, "")
    return {
      cp4: clean.slice(0, 4) || "1000",
      cp3: clean.slice(4, 7) || "001",
    }
  }

  private shipmentAddress(address: Address, type: 1 | 2): CTTAddressData {
    const country = (address.country || "PT").trim().toUpperCase()
    const zip = country === "PT" ? this.parseZip(address.zip) : null
    return {
      Type: type,
      Name: address.name || (type === 1 ? "Remetente Desconhecido" : "Destinatário Desconhecido"),
      Address: address.address || "",
      ...(zip ? { PTZipCode4: zip.cp4, PTZipCode3: zip.cp3 } : {
        NonPTZipCode: (address.zip || "").trim(),
        NonPTZipCodeLocation: address.city || "",
      }),
      City: address.city || "",
      Country: country,
      ContactName: address.contact || address.name,
      Phone: address.phone,
      MobilePhone: address.mobilePhone,
      Email: address.email?.trim() || undefined,
    }
  }

  async createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    try {
      const senderData = this.shipmentAddress(input.sender, 1)
      const recipientData = this.shipmentAddress(input.recipient, 2)
      if (input.dimensionsCm) {
        try { validateParcelDimensions(input.dimensionsCm) }
        catch (error) { return { success: false, confirmedRejection: true, error: error instanceof Error ? error.message : "Dimensões inválidas." } }
      }

      const shipmentData: CTTShipmentData = {
        ClientReference: input.reference || "LNK_GEN",
        Weight: Math.round((input.weightKg || 1) * 1000), // CTT expects grams
        Quantity: input.volumes || 1,
        Observations: input.observations,
        IsDevolution: input.isReturn
      }

      if (recipientData.Country !== "PT") {
        try {
          const details = validateCttExportDetails(input.cttExportDetails)
          shipmentData.ExportType = details.exportType
          shipmentData.UPUCode = details.contentType
          shipmentData.DeclaredValue = details.declaredValue
          const contactError = getCttRecipientContactError(input.recipient)
          if (contactError) return { success: false, confirmedRejection: true, error: contactError }
        } catch (error) {
          // This is a local rejection before any carrier call, so a wallet
          // reservation can be released without an ambiguous remote outcome.
          return { success: false, confirmedRejection: true, error: error instanceof Error ? error.message : "Dados de exportação inválidos." }
        }
      } else if (input.codValue && input.codValue > 0) {
        shipmentData.DeclaredValue = input.codValue
      }

      if (input.dimensionsCm) {
        // CustomsData is a customs declaration, not a general measurement field.
        // Some destinations (including BE) explicitly prohibit that block.
        try { shipmentData.Observations = cttParcelObservations(input.dimensionsCm, input.observations) }
        catch (error) { return { success: false, confirmedRejection: true, error: error instanceof Error ? error.message : "Dimensões inválidas." } }
      }

      const CTT_SPECIAL_SERVICES_MAP: Record<string, string> = {
        "cod": "AgainstReimbursement",
        "saturday": "Saturday",
        "return_signed": "ReturnDocumentSigned",
        "insurance": "SpecialInsurance",
        "fragil": "Fragil",
        "delivery_point": "DeliveryPoint",
        "auth_return": "AuthorizeReturn",
        "sms_tracking": "SMS",
        "time_window": "TimeWindow",
        "second_delivery": "SecondScheduledDelivery",
        "postal_object": "PostalObject",
        "nominative_check": "NominativeCheck",
        "back": "Back",
        "multiple_home_delivery": "MultipleHomeDelivery",
        "certain_day": "CertainDay",
        "phone_contact": "PhoneContact",
        "live_tracking": "LiveTracking",
        "contacto_agendamento": "ContactoAgendamento",
        "delivery_aggregation": "DeliveryAggregation"
      }

      // CTT SOAP usually accepts SpecialServices like AgainstReimbursement, Fragil, etc.
      // But some subproducts might reject them. We'll map the critical ones like COD.
      const specialServices: any[] = []
      
      // If COD / AgainstReimbursement is requested
      if (input.codValue && input.codValue > 0) {
        specialServices.push({
          SpecialServiceType: "AgainstReimbursement", // Tipo 2
          Value: input.codValue.toString()
        })
      }
      
      const finalSpecialServices = specialServices.length > 0 ? specialServices : undefined

      const payload = {
        clientReference: input.reference || "LNK_GEN",
        subProduct: input.subProduct || this.creds.default_subproduct || "EMSF056.01",
        sender: senderData,
        receiver: recipientData,
        shipment: shipmentData,
        specialServices: finalSpecialServices
      }

      const result = input.autoClose === false
        ? await this.shipmentService.createShipment(this.creds, payload)
        : await this.shipmentService.completeShipment(this.creds, payload)
      
      if (result.Status === 1) {
        const shipmentOutput = result.ShipmentData?.[0]
        const label = getCttShipmentLabel(shipmentOutput)
        return {
          success: true,
          trackingNumber: shipmentOutput?.FirstObject,
          carrierShipmentId: result.DeliveryNoteId,
          labelBase64: label?.data,
          labelFormat: label?.format,
          rawResponse: result
        }
      }

      return {
        success: false,
        confirmedRejection: Boolean(result.ErrorsList?.length),
        error: result.ErrorsList?.map(e => e.Message).join(', ') || "Failed to create shipment"
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async cancelShipment(trackingNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      // CTT cancelamento expects the ReferenceData object
      // which requires internal identifiers like ShipmentId/ProcessId that we might not have natively here.
      // But we can try querying it if needed or use the tracking number directly if the API supports it.
      // Assuming we need a way to build the CTTReferenceData, we'll need to fetch it from the TMS DB or pass it.
      // For now, returning not implemented or failing gracefully.
      return { success: false, error: "CancelShipment requires carrier internal shipment ID for CTT." }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async createPickup(input: PickupInput): Promise<PickupResult> {
    try {
      const senderZip = this.parseZip(input.sender.zip)
      const result = await this.pickupService.newOfferPickUp(this.creds, {
        AuthenticationID: this.creds.auth_id,
        ClientId: this.creds.client_number,
        ContractId: this.creds.contract_number,
        Solicitante: input.requester,
        DataRecolha: input.date,
        HoraInicio: input.startHour,
        HoraFim: input.endHour,
        Destination: input.pickupDestination || "PT",
        BiggestObjectDimensionsCm: {
          Length: input.biggestParcelDimensionsCm?.length || 0,
          Width: input.biggestParcelDimensionsCm?.width || 0,
          Height: input.biggestParcelDimensionsCm?.height || 0,
        },
        QuantidadeVolumes: input.volumes,
        PesoKg: input.weightKg,
        PesoObjetoMaisPesadoKg: input.heaviestWeightKg,
        Expedidor: {
          Nome: input.sender.name,
          Contacto: input.sender.contact || input.sender.name,
          Pais: input.sender.country || "PT",
          Morada: input.sender.address,
          CP4: senderZip.cp4,
          CP3: senderZip.cp3,
          Localidade: input.sender.city,
          Telefone: input.sender.phone?.trim() || input.sender.mobilePhone?.trim() || "",
          Telemovel: input.sender.mobilePhone,
          Email: input.sender.email
        },
        Observacoes: input.observations || "",
      })

      if (result.Success && result.PickUpID) {
        return { success: true, pickupNumber: result.PickUpID }
      }
      return { success: false, error: result.Errors?.join(', ') || "Failed to schedule pickup" }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    try {
      const events = await CTTTrackingService.fetchRealTrackingEvents(trackingNumber, this.creds)
      return {
        success: true,
        events: events.map((e: any) => ({
          status: e.tmsStatus || "pendente",
          description: e.eventName || "Evento CTT",
          date: e.timestamp,
          location: e.location,
          isFinal: e.isTerminal,
          code: e.eventCode,
          rawEvent: e
        }))
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async getLabel(trackingNumber: string): Promise<{ success: boolean; base64?: string; format?: string; error?: string }> {
    return { success: false, error: "getLabel is not directly supported by CTT without Shipment ID / Process ID" }
  }

  async validateShipment(input: ShipmentInput): Promise<{ isValid: boolean; error?: string }> {
    const cp4Origem = this.parseZip(input.sender.zip).cp4
    const cp4Destino = this.parseZip(input.recipient.zip).cp4
    
    try {
      const result = await this.pickupService.getAreaInfluencia(this.creds, {
        cp4Origem,
        cp4Destino,
        subproduto: input.subProduct || "EMSF056.01"
      })

      if ((result as any).success && (result as any).valido) {
        return { isValid: true }
      }
      return { isValid: false, error: (result as any).error || "Route not covered by CTT for this product" }
    } catch (err: any) {
      return { isValid: false, error: err.message }
    }
  }
}
