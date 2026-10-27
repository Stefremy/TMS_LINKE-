import { CTTSoapClient } from "./ctt-soap-client"
import { normalizeCttContactPhone } from "./recipient-contact"
import { 
  CTTConnectionCredentials, 
  CTTCompleteShipmentInput, 
  CTTCompleteShipmentOutput, 
  CTTShipment2Close,
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
  private buildAddressXml(
    addr: CTTAddressData,
    tagName: string,
    defaultType: "Sender" | "Receiver",
    isInternationalDestination: boolean = false
  ): string {
    const esc = CTTSoapClient.escapeXml
    const typeEnum = addr.Type === "Sender" || addr.Type === 1 
      ? "Sender" 
      : addr.Type === "Receiver" || addr.Type === 2 
        ? "Receiver" 
        : defaultType

    const country = (addr.Country || "PT").trim().toUpperCase()
    const normalizeContact = (value?: string) => {
      const contact = normalizeCttContactPhone(value, country)
      let contactVal = contact.value
      if (tagName === "SenderData" && isInternationalDestination && country === "PT" && contactVal) {
        contactVal = contactVal.startsWith("+") ? contactVal : `+351${contactVal.replace(/^0+/, "")}`
      }
      return {
        value: contactVal,
        mobile: contact.mobile,
      }
    }
    const phone = normalizeContact(addr.Phone)
    const rawPhone = phone.value
    const rawMobile = normalizeContact(addr.MobilePhone).value
    // An explicit international prefix takes precedence over the address country.
    const isPhoneMobile = !rawMobile && phone.mobile
    const mobileValue = rawMobile || (isPhoneMobile ? rawPhone : "")
    const phoneValue = rawMobile ? rawPhone : (isPhoneMobile ? "" : rawPhone)

    return `
      <mod:${tagName}>
        <mod:Address>${esc(addr.Address)}</mod:Address>
        <mod:City>${esc(addr.City)}</mod:City>
        ${addr.ContactName ? `<mod:ContactName>${esc(addr.ContactName)}</mod:ContactName>` : ""}
        <mod:Country>${esc(country)}</mod:Country>
        ${addr.Door ? `<mod:Door>${esc(addr.Door)}</mod:Door>` : ""}
        ${addr.Email ? `<mod:Email>${esc(addr.Email)}</mod:Email>` : ""}
        ${addr.Floor ? `<mod:Floor>${esc(addr.Floor)}</mod:Floor>` : ""}
        ${mobileValue ? `<mod:MobilePhone>${esc(mobileValue)}</mod:MobilePhone>` : ""}
        <mod:Name>${esc(addr.Name)}</mod:Name>
        ${addr.NonPTZipCode ? `<mod:NonPTZipCode>${esc(addr.NonPTZipCode)}</mod:NonPTZipCode>` : ""}
        ${addr.NonPTZipCodeLocation ? `<mod:NonPTZipCodeLocation>${esc(addr.NonPTZipCodeLocation)}</mod:NonPTZipCodeLocation>` : ""}
        ${addr.PTZipCode3 ? `<mod:PTZipCode3>${esc(addr.PTZipCode3)}</mod:PTZipCode3>` : ""}
        ${addr.PTZipCode4 ? `<mod:PTZipCode4>${esc(addr.PTZipCode4)}</mod:PTZipCode4>` : ""}
        ${phoneValue ? `<mod:Phone>${esc(phoneValue)}</mod:Phone>` : ""}
        <mod:Type>${typeEnum}</mod:Type>
      </mod:${tagName}>
    `
  }

  /**
   * Serializa dados do envio para XML de acordo com schema ShipmentData CTT (ordenação estrita WCF)
   */
  private buildCustomsXml(data: NonNullable<CTTShipmentData["CustomsData"]>): string {
    const esc = CTTSoapClient.escapeXml
    const optional = (name: string, value?: string | number) => value !== undefined && value !== "" ? `<mod:${name}>${esc(String(value))}</mod:${name}>` : ""
    return `<mod:CustomsData>
      ${optional("ComercialInvoice", data.commercialInvoice)}
      <mod:CustomsItemsData>${data.items.map((item, index) => `<mod:CustomsItemsData>
        <mod:Currency>EUR</mod:Currency><mod:Detail>${esc(item.description)}</mod:Detail>
        <mod:HarmonizedCode>${esc(item.harmonizedCode)}</mod:HarmonizedCode><mod:ItemNumber>${index + 1}</mod:ItemNumber>
        <mod:OriginCountry>${esc(item.originCountry)}</mod:OriginCountry><mod:Quantity>${item.quantity}</mod:Quantity>
        <mod:Value>${item.value.toFixed(2)}</mod:Value><mod:Weight>${Math.round(item.weightKg * 1000)}</mod:Weight>
      </mod:CustomsItemsData>`).join("")}</mod:CustomsItemsData>
      <mod:CustomsTotalItems>${data.items.reduce((sum, item) => sum + item.quantity, 0)}</mod:CustomsTotalItems>
      <mod:CustomsTotalValue>${data.items.reduce((sum, item) => sum + Math.round(item.value * 100), 0) / 100}</mod:CustomsTotalValue>
      <mod:CustomsTotalWeight>${data.items.reduce((sum, item) => sum + Math.round(item.weightKg * 1000), 0)}</mod:CustomsTotalWeight>
      ${optional("Height", data.dimensionsCm?.height)}
      <mod:InvoiceDate>${esc(data.invoiceDate)}T00:00:00</mod:InvoiceDate>
      ${optional("Length", data.dimensionsCm?.length)}
      <mod:NonDeliveryCase>${esc(data.nonDeliveryCase)}</mod:NonDeliveryCase>
      ${optional("ReceiverTIN", data.receiverTIN)}
      <mod:SachetDocumentation>${data.sachetDocumentation}</mod:SachetDocumentation>
      ${optional("SenderEmail", data.senderEmail)}
      <mod:VATExportDeclaration>${data.vatExportDeclaration}</mod:VATExportDeclaration><mod:VATRate>${data.vatRate}</mod:VATRate>
      ${optional("Width", data.dimensionsCm?.width)}
    </mod:CustomsData>`
  }

  private buildShipmentDataXml(shipment: CTTShipmentData): string {
    const esc = CTTSoapClient.escapeXml
    return `
      <mod:ShipmentData>
        ${shipment.ATCode ? `<mod:ATCode>${esc(shipment.ATCode)}</mod:ATCode>` : ""}
        <mod:ClientReference>${esc(shipment.ClientReference)}</mod:ClientReference>
        ${shipment.CustomsData ? this.buildCustomsXml(shipment.CustomsData) : ""}
        ${shipment.DeclaredValue !== undefined ? `<mod:DeclaredValue>${shipment.DeclaredValue}</mod:DeclaredValue>` : ""}
        ${shipment.ExportType ? `<mod:ExportType>${esc(shipment.ExportType)}</mod:ExportType>` : ""}
        <mod:IsDevolution>${shipment.IsDevolution ? "true" : "false"}</mod:IsDevolution>
        ${shipment.Observations ? `<mod:Observations>${esc(shipment.Observations)}</mod:Observations>` : ""}
        ${shipment.OriginalObject ? `<mod:OriginalObject>${esc(shipment.OriginalObject)}</mod:OriginalObject>` : ""}
        <mod:Quantity>${shipment.Quantity || 1}</mod:Quantity>
        ${shipment.UPUCode ? `<mod:UPUCode>${esc(shipment.UPUCode)}</mod:UPUCode>` : ""}
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
    const subProduct = input.subProduct || creds.default_subproduct || "EMSF056.01"
    const distChannel = creds.distribution_channel || 99
    const requestId = crypto.randomUUID()

    const isInternational = Boolean(input.receiver.Country && !["PT", "ES"].includes(input.receiver.Country.trim().toUpperCase()))

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
                ${this.buildAddressXml(input.sender, "SenderData", "Sender", isInternational)}
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
    const subProduct = input.subProduct || creds.default_subproduct || "EMSF056.01"
    const distChannel = creds.distribution_channel || 99
    const requestId = crypto.randomUUID()

    const isInternational = Boolean(input.receiver.Country && !["PT", "ES"].includes(input.receiver.Country.trim().toUpperCase()))

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
                ${this.buildAddressXml(input.sender, "SenderData", "Sender", isInternational)}
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
    input: { shipments: CTTShipment2Close[] }
  ): Promise<CTTCloseShipmentOutput> {
    const esc = CTTSoapClient.escapeXml
    const requestId = crypto.randomUUID()

    if (!input.shipments.length) throw new Error('Selecione os envios a fechar.')
    // Order and namespaces follow the published CloseShipmentInput XSD.
    const bodyXml = `
      <tem:CloseShipment>
        <tem:Input>
          <ws:AuthenticationID>${esc(creds.auth_id)}</ws:AuthenticationID>
          <ws:ClientId>${esc(creds.client_number)}</ws:ClientId>
          <ws:ContractId>${esc(creds.contract_number)}</ws:ContractId>
          <ws:DistributionChannel>${creds.distribution_channel ?? 99}</ws:DistributionChannel>
          <ws:ListOfShipmentToClose>
            ${input.shipments.map(shipment => `<ws:Shipment2Close>
              <ws:FirstObjectCode>${esc(shipment.FirstObjectCode)}</ws:FirstObjectCode>
              <ws:LastObjectCode>${esc(shipment.LastObjectCode)}</ws:LastObjectCode>
              <ws:SubProductCode>${esc(shipment.SubProductCode)}</ws:SubProductCode>
            </ws:Shipment2Close>`).join('')}
          </ws:ListOfShipmentToClose>
          <ws:RequestID>${requestId}</ws:RequestID>
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

  /**
   * Extrai o valor string de um nó XML que pode ser:
   * - string pura: "EW0052"
   * - número (quando parseTagValue estava activo): 52
   * - objecto fast-xml-parser com #text: { "#text": "EW0052", "@_..." }
   * - null / undefined
   */
  private getText(val: any): string {
    if (val === null || val === undefined) return ""
    if (typeof val === "string") return val
    if (typeof val === "number" || typeof val === "boolean") return String(val)
    if (typeof val === "object" && val["#text"] !== undefined) return String(val["#text"])
    return ""
  }

  private parseCloseShipmentResult(res: any): CTTCloseShipmentOutput {
    const status = this.getText(res?.Status) === "Success" || res?.Status === 1 || res?.Status === "1" ? 1 : 0
    const errorsList: any[] = []
    if (res?.ErrorsList?.ErrorData) {
      const errors = Array.isArray(res.ErrorsList.ErrorData) ? res.ErrorsList.ErrorData : [res.ErrorsList.ErrorData]
      for (const e of errors) {
        errorsList.push({ Code: e.Code || 0, Message: this.getText(e.Message) })
      }
    }

    return {
      Status: status,
      ErrorsList: errorsList,
      DocumentsList: this.extractDocuments(res?.DocumentsList),
    }
  }

  private parseCompleteShipmentResult(res: any): CTTCompleteShipmentOutput {
    const isSuccess = this.getText(res?.Status) === "Success" || res?.Status === 1 || res?.Status === "1"
    const status = isSuccess ? 1 : 0
    const deliveryNoteId = this.getText(res?.DeliveryNoteId)
    
    // Processar erros se houver
    const errorsList: any[] = []
    if (res?.ErrorsList?.ErrorData) {
      const errors = Array.isArray(res.ErrorsList.ErrorData) ? res.ErrorsList.ErrorData : [res.ErrorsList.ErrorData]
      for (const e of errors) {
        errorsList.push({ 
          Code: Number(this.getText(e.Code)) || 0, 
          ErrorCode: this.getText(e.ErrorCode), 
          Message: this.getText(e.Message) 
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
          ClientReference: this.getText(s.ClientReference),
          FirstObject: this.getText(s.FirstObject),
          LastObject: this.getText(s.LastObject) || this.getText(s.FirstObject),
          OriginalObjectID: this.getText(s.OriginalObjectID),
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
      FileName: this.getText(l.FileName),
      Label: this.getText(l.Label),
      BestEncoding: this.getText(l.BestEncoding),
    }))
  }

  private extractDocuments(docNode: any) {
    if (!docNode?.DocumentData) return []
    const list = Array.isArray(docNode.DocumentData) ? docNode.DocumentData : [docNode.DocumentData]
    return list.map((d: any) => ({
      FileName: this.getText(d.FileName),
      File: this.getText(d.File),
    }))
  }
}
