import { CTTSoapClient } from "./ctt-soap-client"
import { 
  CTTConnectionCredentials, 
  CTTCompleteShipmentInput, 
  CTTCompleteShipmentOutput, 
  CTTCloseShipmentInput,
  CTTCloseShipmentOutput,
  CTTAddressData,
  CTTShipmentData,
  CTTSpecialService
} from "./ctt-types"

const CTT_QA_SHIPMENT_ENDPOINT = "http://cttexpressows.qa.ctt.pt/CTTEWSPool/CTTShipmentProviderWS.svc"
const CTT_PROD_SHIPMENT_ENDPOINT = "http://cttexpressows.ctt.pt/CTTEWSPool/CTTShipmentProviderWS.svc"

export class CTTShipmentService {
  private client: CTTSoapClient

  constructor() {
    this.client = new CTTSoapClient()
  }

  private getEndpoint(creds: CTTConnectionCredentials): string {
    return creds.environment === "production" ? CTT_PROD_SHIPMENT_ENDPOINT : CTT_QA_SHIPMENT_ENDPOINT
  }

  /**
   * Serializa morada para XML de acordo com schema AddressData CTT (ordenação estrita WCF)
   */
  private buildAddressXml(addr: CTTAddressData, tagName: string, defaultType: "Sender" | "Receiver"): string {
    const esc = CTTSoapClient.escapeXml
    const typeEnum = addr.Type === "Sender" || addr.Type === 1 
      ? "Sender" 
      : addr.Type === "Receiver" || addr.Type === 2 
        ? "Receiver" 
        : defaultType

    return `
      <mod:${tagName}>
        <mod:Address>${esc(addr.Address)}</mod:Address>
        <mod:City>${esc(addr.City)}</mod:City>
        ${addr.ContactName ? `<mod:ContactName>${esc(addr.ContactName)}</mod:ContactName>` : ""}
        <mod:Country>${esc(addr.Country || "PT")}</mod:Country>
        ${addr.Door ? `<mod:Door>${esc(addr.Door)}</mod:Door>` : ""}
        ${addr.Email ? `<mod:Email>${esc(addr.Email)}</mod:Email>` : ""}
        ${addr.Floor ? `<mod:Floor>${esc(addr.Floor)}</mod:Floor>` : ""}
        ${addr.MobilePhone ? `<mod:MobilePhone>${esc(addr.MobilePhone)}</mod:MobilePhone>` : ""}
        <mod:Name>${esc(addr.Name)}</mod:Name>
        ${addr.NonPTZipCode ? `<mod:NonPTZipCode>${esc(addr.NonPTZipCode)}</mod:NonPTZipCode>` : ""}
        ${addr.NonPTZipCodeLocation ? `<mod:NonPTZipCodeLocation>${esc(addr.NonPTZipCodeLocation)}</mod:NonPTZipCodeLocation>` : ""}
        ${addr.PTZipCode3 ? `<mod:PTZipCode3>${esc(addr.PTZipCode3)}</mod:PTZipCode3>` : ""}
        ${addr.PTZipCode4 ? `<mod:PTZipCode4>${esc(addr.PTZipCode4)}</mod:PTZipCode4>` : ""}
        ${addr.Phone ? `<mod:Phone>${esc(addr.Phone)}</mod:Phone>` : ""}
        <mod:Type>${typeEnum}</mod:Type>
      </mod:${tagName}>
    `
  }

  /**
   * Serializa dados do envio para XML de acordo com schema ShipmentData CTT (ordenação estrita WCF)
   */
  private buildShipmentDataXml(shipment: CTTShipmentData): string {
    const esc = CTTSoapClient.escapeXml
    return `
      <mod:ShipmentData>
        ${shipment.ATCode ? `<mod:ATCode>${esc(shipment.ATCode)}</mod:ATCode>` : ""}
        <mod:ClientReference>${esc(shipment.ClientReference)}</mod:ClientReference>
        ${shipment.DeclaredValue ? `<mod:DeclaredValue>${shipment.DeclaredValue}</mod:DeclaredValue>` : ""}
        <mod:IsDevolution>${shipment.IsDevolution ? "true" : "false"}</mod:IsDevolution>
        ${shipment.Observations ? `<mod:Observations>${esc(shipment.Observations)}</mod:Observations>` : ""}
        ${shipment.OriginalObject ? `<mod:OriginalObject>${esc(shipment.OriginalObject)}</mod:OriginalObject>` : ""}
        <mod:Quantity>${shipment.Quantity || 1}</mod:Quantity>
        ${shipment.ValidationDate ? `<mod:ValidationDate>${esc(shipment.ValidationDate)}</mod:ValidationDate>` : ""}
        <mod:Weight>${Math.round(shipment.Weight || 1)}</mod:Weight>
      </mod:ShipmentData>
    `
  }

  /**
   * Serializa serviços especiais (Cobrança/COD, Janela Horária, Ponto de Entrega, etc.)
   */
  private buildSpecialServicesXml(services?: CTTSpecialService[]): string {
    if (!services || services.length === 0) return ""
    return `
      <mod:SpecialServices>
        ${services.map(s => `
          <mod:SpecialService>
            <mod:SpecialServiceType>${s.SpecialServiceType}</mod:SpecialServiceType>
            ${s.Value !== undefined ? `<mod:Value>${s.Value}</mod:Value>` : ""}
            ${s.DeliveryPoint ? `
              <mod:DeliveryPoint>
                <mod:Code>${CTTSoapClient.escapeXml(s.DeliveryPoint.Code)}</mod:Code>
                <mod:Name>${CTTSoapClient.escapeXml(s.DeliveryPoint.Name)}</mod:Name>
                <mod:Type>${s.DeliveryPoint.Type}</mod:Type>
              </mod:DeliveryPoint>
            ` : ""}
            ${s.TimeWindow ? `
              <mod:TimeWindow>
                <mod:TimeWindow>${s.TimeWindow.TimeWindow}</mod:TimeWindow>
                ${s.TimeWindow.DeliveryDate ? `<mod:DeliveryDate>${s.TimeWindow.DeliveryDate}</mod:DeliveryDate>` : ""}
              </mod:TimeWindow>
            ` : ""}
          </mod:SpecialService>
        `).join("")}
      </mod:SpecialServices>
    `
  }

  /**
   * Cria e fecha uma expedição completa via CompleteShipment
   * Devolve tracking number (FirstObject) e etiquetas oficiais da CTT (LabelList)
   */
  async completeShipment(
    creds: CTTConnectionCredentials,
    input: {
      clientReference: string
      subProduct?: string
      sender: CTTAddressData
      receiver: CTTAddressData
      shipment: CTTShipmentData
      specialServices?: CTTSpecialService[]
    }
  ): Promise<CTTCompleteShipmentOutput> {
    const esc = CTTSoapClient.escapeXml
    const subProduct = input.subProduct || creds.default_subproduct || "ERS 24"
    const distChannel = creds.distribution_channel || 99
    const requestId = crypto.randomUUID()

    const bodyXml = `
      <tem:CompleteShipment>
        <tem:Input>
          <ws:AuthenticationID>${esc(creds.auth_id)}</ws:AuthenticationID>
          <ws:DeliveryNote>
            <mod:ClientId>${esc(creds.client_number)}</mod:ClientId>
            <mod:ContractId>${esc(creds.contract_number)}</mod:ContractId>
            <mod:DistributionChannelId>${distChannel}</mod:DistributionChannelId>
            <mod:ShipmentCTT>
              <mod:ShipmentCTT>
                <mod:HasSenderInformation>true</mod:HasSenderInformation>
                ${this.buildAddressXml(input.receiver, "ReceiverData", "Receiver")}
                ${this.buildAddressXml(input.sender, "SenderData", "Sender")}
                ${this.buildShipmentDataXml(input.shipment)}
                ${this.buildSpecialServicesXml(input.specialServices)}
              </mod:ShipmentCTT>
            </mod:ShipmentCTT>
            <mod:SubProductId>${esc(subProduct)}</mod:SubProductId>
          </ws:DeliveryNote>
          <ws:RequestID>${requestId}</ws:RequestID>
          ${creds.user_id ? `<ws:UserID>${esc(creds.user_id)}</ws:UserID>` : ""}
        </tem:Input>
      </tem:CompleteShipment>
    `

    const response = await this.client.callSoap({
      endpoint: this.getEndpoint(creds),
      action: "http://tempuri.org/ICTTShipmentProviderWS/CompleteShipment",
      soapBodyXml: bodyXml,
    })

    const completeResult = response?.CompleteShipmentResponse?.CompleteShipmentResult
    if (completeResult) {
      return this.parseCompleteShipmentResult(completeResult)
    }
    return this.parseCompleteShipmentResult(response)
  }

  /**
   * Cria uma expedição via CreateShipment (gera rótulos oficiais da CTT)
   * Devolve tracking number (FirstObject) e etiquetas oficiais (LabelList)
   */
  async createShipment(
    creds: CTTConnectionCredentials,
    input: {
      clientReference: string
      subProduct?: string
      sender: CTTAddressData
      receiver: CTTAddressData
      shipment: CTTShipmentData
      specialServices?: CTTSpecialService[]
    }
  ): Promise<CTTCompleteShipmentOutput> {
    const esc = CTTSoapClient.escapeXml
    const subProduct = input.subProduct || creds.default_subproduct || "ERS 24"
    const distChannel = creds.distribution_channel || 99
    const requestId = crypto.randomUUID()

    const bodyXml = `
      <tem:CreateShipment>
        <tem:Input>
          <ws:AuthenticationID>${esc(creds.auth_id)}</ws:AuthenticationID>
          <ws:DeliveryNote>
            <mod:ClientId>${esc(creds.client_number)}</mod:ClientId>
            <mod:ContractId>${esc(creds.contract_number)}</mod:ContractId>
            <mod:DistributionChannelId>${distChannel}</mod:DistributionChannelId>
            <mod:ShipmentCTT>
              <mod:ShipmentCTT>
                <mod:HasSenderInformation>true</mod:HasSenderInformation>
                ${this.buildAddressXml(input.receiver, "ReceiverData", "Receiver")}
                ${this.buildAddressXml(input.sender, "SenderData", "Sender")}
                ${this.buildShipmentDataXml(input.shipment)}
                ${this.buildSpecialServicesXml(input.specialServices)}
              </mod:ShipmentCTT>
            </mod:ShipmentCTT>
            <mod:SubProductId>${esc(subProduct)}</mod:SubProductId>
          </ws:DeliveryNote>
          <ws:RequestID>${requestId}</ws:RequestID>
          ${creds.user_id ? `<ws:UserID>${esc(creds.user_id)}</ws:UserID>` : ""}
        </tem:Input>
      </tem:CreateShipment>
    `

    const response = await this.client.callSoap({
      endpoint: this.getEndpoint(creds),
      action: "http://tempuri.org/ICTTShipmentProviderWS/CreateShipment",
      soapBodyXml: bodyXml,
    })

    const createResult = response?.CreateShipmentResponse?.CreateShipmentResult
    if (createResult) {
      return this.parseCompleteShipmentResult(createResult)
    }
    return this.parseCompleteShipmentResult(response)
  }

  /**
   * Fecha os envios emitidos e gera o Certificado de Aceitação (Guia oficial CTT)
   */
  async closeShipment(
    creds: CTTConnectionCredentials,
    input: { deliveryNoteId?: string; shipmentIds?: string[] }
  ): Promise<CTTCloseShipmentOutput> {
    const esc = CTTSoapClient.escapeXml
    const requestId = crypto.randomUUID()

    const bodyXml = `
      <tem:CloseShipment>
        <tem:Input>
          <ws:AuthenticationID>${esc(creds.auth_id)}</ws:AuthenticationID>
          ${input.deliveryNoteId ? `<ws:DeliveryNoteId>${esc(input.deliveryNoteId)}</ws:DeliveryNoteId>` : ""}
          <ws:RequestID>${requestId}</ws:RequestID>
          ${input.shipmentIds && input.shipmentIds.length > 0 ? `
            <ws:ShipmentIdList>
              ${input.shipmentIds.map(id => `<mod:string>${esc(id)}</mod:string>`).join("")}
            </ws:ShipmentIdList>
          ` : ""}
          ${creds.user_id ? `<ws:UserID>${esc(creds.user_id)}</ws:UserID>` : ""}
        </tem:Input>
      </tem:CloseShipment>
    `

    const response = await this.client.callSoap({
      endpoint: this.getEndpoint(creds),
      action: "http://tempuri.org/ICTTShipmentProviderWS/CloseShipment",
      soapBodyXml: bodyXml,
    })

    const closeResult = response?.CloseShipmentResponse?.CloseShipmentResult
    return this.parseCloseShipmentResult(closeResult || response)
  }

  private parseCloseShipmentResult(res: any): CTTCloseShipmentOutput {
    const status = res?.Status === "Success" || res?.Status === 1 || res?.Status === "1" ? 1 : 0
    const errorsList: any[] = []
    if (res?.ErrorsList?.ErrorData) {
      const errors = Array.isArray(res.ErrorsList.ErrorData) ? res.ErrorsList.ErrorData : [res.ErrorsList.ErrorData]
      for (const e of errors) {
        errorsList.push({ Code: e.Code || 0, Message: e.Message || "" })
      }
    }

    return {
      Status: status,
      DeliveryNoteId: typeof res?.DeliveryNoteId === "string" ? res.DeliveryNoteId : "",
      ErrorsList: errorsList,
      DocumentsList: this.extractDocuments(res?.DocumentsList),
    }
  }

  private parseCompleteShipmentResult(res: any): CTTCompleteShipmentOutput {
    const isSuccess = res?.Status === "Success" || res?.Status === 1 || res?.Status === "1"
    const status = isSuccess ? 1 : 0
    const deliveryNoteId = typeof res?.DeliveryNoteId === "string" ? res.DeliveryNoteId : ""
    
    // Processar erros se houver
    const errorsList: any[] = []
    if (res?.ErrorsList?.ErrorData) {
      const errors = Array.isArray(res.ErrorsList.ErrorData) ? res.ErrorsList.ErrorData : [res.ErrorsList.ErrorData]
      for (const e of errors) {
        errorsList.push({ 
          Code: e.Code || 0, 
          ErrorCode: e.ErrorCode || "", 
          Message: e.Message || "" 
        })
      }
    }

    // Processar outputs de envios
    const shipmentData: any[] = []
    if (res?.ShipmentData?.ShipmentDataOutput) {
      const shipments = Array.isArray(res.ShipmentData.ShipmentDataOutput) 
        ? res.ShipmentData.ShipmentDataOutput 
        : [res.ShipmentData.ShipmentDataOutput]
      
      for (const s of shipments) {
        shipmentData.push({
          ClientReference: s.ClientReference,
          FirstObject: s.FirstObject,
          LastObject: s.LastObject || s.FirstObject,
          OriginalObjectID: s.OriginalObjectID,
          LabelList: this.extractLabels(s.LabelList),
          DocumentsList: this.extractDocuments(s.DocumentsList),
        })
      }
    }

    return {
      Status: status,
      DeliveryNoteId: deliveryNoteId,
      ErrorsList: errorsList,
      ShipmentData: shipmentData,
    }
  }

  private extractLabels(labelNode: any) {
    if (!labelNode?.LabelData) return []
    const list = Array.isArray(labelNode.LabelData) ? labelNode.LabelData : [labelNode.LabelData]
    return list.map((l: any) => ({
      FileName: l.FileName,
      Label: l.Label,
      BestEncoding: l.BestEncoding,
    }))
  }

  private extractDocuments(docNode: any) {
    if (!docNode?.DocumentData) return []
    const list = Array.isArray(docNode.DocumentData) ? docNode.DocumentData : [docNode.DocumentData]
    return list.map((d: any) => ({
      FileName: d.FileName,
      File: d.File,
    }))
  }
}
