import { CarrierProvider, ShipmentInput, ShipmentResult, PickupInput, PickupResult, TrackingResult } from './types'
import { CTTShipmentService, CTTPickupService, CTTTrackingService, CTTConnectionCredentials, CTTAddressData, CTTShipmentData } from '../ctt'

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

  async createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    try {
      const senderZip = this.parseZip(input.sender.zip)
      const recipientZip = this.parseZip(input.recipient.zip)

      const senderData: CTTAddressData = {
        Type: 1, // 1=Remetente
        Name: input.sender.name || "Remetente Desconhecido",
        Address: input.sender.address || "",
        PTZipCode4: senderZip.cp4,
        PTZipCode3: senderZip.cp3,
        City: input.sender.city || "",
        Country: input.sender.country || "PT",
        ContactName: input.sender.name,
        Phone: input.sender.phone,
        Email: input.sender.email,
      }

      const recipientData: CTTAddressData = {
        Type: 2, // 2=Destinatário
        Name: input.recipient.name || "Destinatário Desconhecido",
        Address: input.recipient.address || "",
        PTZipCode4: recipientZip.cp4,
        PTZipCode3: recipientZip.cp3,
        City: input.recipient.city || "",
        Country: input.recipient.country || "PT",
        ContactName: input.recipient.name,
        Phone: input.recipient.phone,
        Email: input.recipient.email,
      }

      const shipmentData: any = {
        ClientReference: input.reference || "LNK_GEN",
        Weight: Math.round((input.weightKg || 1) * 1000), // CTT expects grams
        Quantity: input.volumes || 1,
        Observations: input.observations,
        IsDevolution: input.isReturn
      }

      if (input.codValue && input.codValue > 0) {
        shipmentData.DeclaredValue = input.codValue
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

      let specialServices: any[] | undefined = undefined
      if (input.specialServices && input.specialServices.length > 0) {
        specialServices = []
        for (const code of input.specialServices) {
          const mappedType = CTT_SPECIAL_SERVICES_MAP[code]
          if (mappedType) {
            if (code === "cod" && input.codValue) {
              specialServices.push({ SpecialServiceType: mappedType, Value: input.codValue })
            } else {
              specialServices.push({ SpecialServiceType: mappedType })
            }
          }
        }
      }

      const payload = {
        clientReference: input.reference || "LNK_GEN",
        subProduct: input.subProduct || this.creds.default_subproduct || "EMSF056.01",
        sender: senderData,
        receiver: recipientData,
        shipment: shipmentData,
        specialServices
      }

      const result = input.autoClose === false
        ? await this.shipmentService.createShipment(this.creds, payload)
        : await this.shipmentService.completeShipment(this.creds, payload)
      
      if (result.Status === 1) {
        const shipmentOutput = result.ShipmentData?.[0]
        return {
          success: true,
          trackingNumber: shipmentOutput?.FirstObject,
          carrierShipmentId: result.DeliveryNoteId,
          labelBase64: shipmentOutput?.LabelList?.[0]?.Label,
          labelFormat: 'zpl', // CTT typically returns ZPL
          rawResponse: result
        }
      }

      return {
        success: false,
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
        DataRecolha: input.date,
        HoraInicio: input.startHour,
        HoraFim: input.endHour,
        QuantidadeVolumes: input.volumes,
        PesoKg: input.weightKg,
        Expedidor: {
          Nome: input.sender.name,
          Contacto: input.sender.name,
          Morada: input.sender.address,
          CP4: senderZip.cp4,
          CP3: senderZip.cp3,
          Localidade: input.sender.city,
          Telefone: input.sender.phone,
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
