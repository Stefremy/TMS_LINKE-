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

const CTT_QA_SHIPMENT_ENDPOINT = "http://logistica.cttexpresso.pt:8082/CTTExpressoWSQ/CTTShipmentProviderWS.svc"
const CTT_PROD_SHIPMENT_ENDPOINT = "https://logistica.cttexpresso.pt/CTTExpressoWS/CTTShipmentProviderWS.svc"

export class CTTShipmentService {
  private client: CTTSoapClient

  constructor() {
    this.client = new CTTSoapClient()
  }

  private getEndpoint(creds: CTTConnectionCredentials): string {
    return creds.environment === "production" ? CTT_PROD_SHIPMENT_ENDPOINT : CTT_QA_SHIPMENT_ENDPOINT
  }

  /**
   * Serializa morada para XML de acordo com schema AddressData CTT
   */
  private buildAddressXml(addr: CTTAddressData, tagName: string): string {
    const esc = CTTSoapClient.escapeXml
    return `
      <tem:${tagName}>
        <tem:Type>${addr.Type}</tem:Type>
        <tem:Name>${esc(addr.Name)}</tem:Name>
        ${addr.ContactName ? `<tem:ContactName>${esc(addr.ContactName)}</tem:ContactName>` : ""}
        <tem:Address>${esc(addr.Address)}</tem:Address>
        ${addr.Floor ? `<tem:Floor>${esc(addr.Floor)}</tem:Floor>` : ""}
        ${addr.Door ? `<tem:Door>${esc(addr.Door)}</tem:Door>` : ""}
        ${addr.PTZipCode4 ? `<tem:PTZipCode4>${esc(addr.PTZipCode4)}</tem:PTZipCode4>` : ""}
        ${addr.PTZipCode3 ? `<tem:PTZipCode3>${esc(addr.PTZipCode3)}</tem:PTZipCode3>` : ""}
        ${addr.NonPTZipCode ? `<tem:NonPTZipCode>${esc(addr.NonPTZipCode)}</tem:NonPTZipCode>` : ""}
        ${addr.NonPTZipCodeLocation ? `<tem:NonPTZipCodeLocation>${esc(addr.NonPTZipCodeLocation)}</tem:NonPTZipCodeLocation>` : ""}
        <tem:City>${esc(addr.City)}</tem:City>
        <tem:Country>${esc(addr.Country || "PT")}</tem:Country>
        ${addr.Email ? `<tem:Email>${esc(addr.Email)}</tem:Email>` : ""}
        ${addr.Phone ? `<tem:Phone>${esc(addr.Phone)}</tem:Phone>` : ""}
        ${addr.MobilePhone ? `<tem:MobilePhone>${esc(addr.MobilePhone)}</tem:MobilePhone>` : ""}
      </tem:${tagName}>
    `
  }

  /**
   * Serializa dados do envio para XML de acordo com schema ShipmentData CTT
   */
  private buildShipmentDataXml(shipment: CTTShipmentData): string {
    const esc = CTTSoapClient.escapeXml
    return `
      <tem:ShipmentData>
        <tem:IsDevolution>${shipment.IsDevolution ? "true" : "false"}</tem:IsDevolution>
        ${shipment.OriginalObject ? `<tem:OriginalObject>${esc(shipment.OriginalObject)}</tem:OriginalObject>` : ""}
        ${shipment.ValidationDate ? `<tem:ValidationDate>${esc(shipment.ValidationDate)}</tem:ValidationDate>` : ""}
        ${shipment.ATCode ? `<tem:ATCode>${esc(shipment.ATCode)}</tem:ATCode>` : ""}
        ${shipment.Observations ? `<tem:Observations>${esc(shipment.Observations)}</tem:Observations>` : ""}
        <tem:Weight>${Math.round(shipment.Weight || 1)}</tem:Weight>
        <tem:Quantity>${shipment.Quantity || 1}</tem:Quantity>
        <tem:ClientReference>${esc(shipment.ClientReference)}</tem:ClientReference>
        ${shipment.DeclaredValue ? `<tem:DeclaredValue>${shipment.DeclaredValue}</tem:DeclaredValue>` : ""}
      </tem:ShipmentData>
    `
  }

  /**
   * Serializa serviços especiais (Cobrança/COD, Janela Horária, Ponto de Entrega, etc.)
   */
  private buildSpecialServicesXml(services?: CTTSpecialService[]): string {
    if (!services || services.length === 0) return ""
    return `
      <tem:SpecialServices>
        ${services.map(s => `
          <tem:SpecialService>
            <tem:SpecialServiceType>${s.SpecialServiceType}</tem:SpecialServiceType>
            ${s.Value !== undefined ? `<tem:Value>${s.Value}</tem:Value>` : ""}
            ${s.DeliveryPoint ? `
              <tem:DeliveryPoint>
                <tem:Name>${CTTSoapClient.escapeXml(s.DeliveryPoint.Name)}</tem:Name>
                <tem:Code>${CTTSoapClient.escapeXml(s.DeliveryPoint.Code)}</tem:Code>
                <tem:Type>${s.DeliveryPoint.Type}</tem:Type>
              </tem:DeliveryPoint>
            ` : ""}
            ${s.TimeWindow ? `
              <tem:TimeWindow>
                <tem:TimeWindow>${s.TimeWindow.TimeWindow}</tem:TimeWindow>
                ${s.TimeWindow.DeliveryDate ? `<tem:DeliveryDate>${s.TimeWindow.DeliveryDate}</tem:DeliveryDate>` : ""}
              </tem:TimeWindow>
            ` : ""}
          </tem:SpecialService>
        `).join("")}
      </tem:SpecialServices>
    `
  }

  /**
   * Cria e fecha uma expedição completa via CompleteShipment
   * Devolve tracking number (FirstObject) e etiquetas (LabelList)
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
          <tem:AuthenticationID>${esc(creds.auth_id)}</tem:AuthenticationID>
          <tem:RequestID>${requestId}</tem:RequestID>
          ${creds.user_id ? `<tem:UserId>${esc(creds.user_id)}</tem:UserId>` : ""}
          <tem:DeliveryNote>
            <tem:ClientId>${esc(creds.client_number)}</tem:ClientId>
            <tem:ContractId>${esc(creds.contract_number)}</tem:ContractId>
            <tem:DistributionChannelId>${distChannel}</tem:DistributionChannelId>
            <tem:SubProductId>${esc(subProduct)}</tem:SubProductId>
            <tem:ShipmentCTT>
              <tem:ShipmentCTT>
                <tem:HasSenderInformation>true</tem:HasSenderInformation>
                ${this.buildAddressXml(input.sender, "SenderData")}
                ${this.buildAddressXml(input.receiver, "ReceiverData")}
                ${this.buildShipmentDataXml(input.shipment)}
                ${this.buildSpecialServicesXml(input.specialServices)}
              </tem:ShipmentCTT>
            </tem:ShipmentCTT>
          </tem:DeliveryNote>
        </tem:Input>
      </tem:CompleteShipment>
    `

    try {
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
    } catch (err: any) {
      console.warn("CTT CompleteShipment WS Error:", err.message)
      // Se estiver em modo de teste ou credenciais mock, devolver resposta de simulação estruturada
      if (!creds.auth_id || creds.auth_id === "test" || creds.auth_id.includes("00000000")) {
        return this.generateMockShipmentOutput(input.clientReference, subProduct)
      }
      throw err
    }
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
          <tem:AuthenticationID>${esc(creds.auth_id)}</tem:AuthenticationID>
          <tem:RequestID>${requestId}</tem:RequestID>
          ${creds.user_id ? `<tem:UserId>${esc(creds.user_id)}</tem:UserId>` : ""}
          ${input.deliveryNoteId ? `<tem:DeliveryNoteId>${esc(input.deliveryNoteId)}</tem:DeliveryNoteId>` : ""}
          ${input.shipmentIds && input.shipmentIds.length > 0 ? `
            <tem:ShipmentIdList>
              ${input.shipmentIds.map(id => `<tem:string>${esc(id)}</tem:string>`).join("")}
            </tem:ShipmentIdList>
          ` : ""}
        </tem:Input>
      </tem:CloseShipment>
    `

    try {
      const response = await this.client.callSoap({
        endpoint: this.getEndpoint(creds),
        action: "http://tempuri.org/ICTTShipmentProviderWS/CloseShipment",
        soapBodyXml: bodyXml,
      })

      const closeResult = response?.CloseShipmentResponse?.CloseShipmentResult || response
      return {
        Status: closeResult.Status === "Success" || closeResult.Status === 1 ? 1 : 0,
        DocumentsList: this.extractDocuments(closeResult.DocumentsList),
      }
    } catch (err: any) {
      console.warn("CTT CloseShipment WS Error:", err.message)
      if (!creds.auth_id || creds.auth_id === "test" || creds.auth_id.includes("00000000")) {
        return {
          Status: 1,
          DocumentsList: [
            {
              FileName: `Certificado_Aceitacao_${Date.now()}.pdf`,
              File: "JVBERi0xLjQKJcTl8uXr...SIMULATED_CERTIFICADO_PDF...",
            }
          ]
        }
      }
      throw err
    }
  }

  private parseCompleteShipmentResult(res: any): CTTCompleteShipmentOutput {
    const status = res.Status === "Success" || res.Status === 1 || res.Status === "1" ? 1 : 0
    const deliveryNoteId = res.DeliveryNoteId || ""
    
    // Processar erros se houver
    const errorsList: any[] = []
    if (res.ErrorsList?.ErrorData) {
      const errors = Array.isArray(res.ErrorsList.ErrorData) ? res.ErrorsList.ErrorData : [res.ErrorsList.ErrorData]
      for (const e of errors) {
        errorsList.push({ Code: e.Code || 0, Message: e.Message || "" })
      }
    }

    // Processar outputs de envios
    const shipmentData: any[] = []
    if (res.ShipmentData?.ShipmentDataOutput) {
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

  private generateMockShipmentOutput(ref: string, subProduct: string): CTTCompleteShipmentOutput {
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000)
    const barcode = `EA${randomDigits}PT`
    return {
      Status: 1,
      DeliveryNoteId: `GN-${Date.now().toString().slice(-6)}`,
      ShipmentData: [
        {
          ClientReference: ref,
          FirstObject: barcode,
          LastObject: barcode,
          LabelList: [
            {
              FileName: `${barcode}.pdf`,
              Label: "JVBERi0xLjQKJcTl8uXr...SIMULATED_LABEL_BASE64_PDF...",
              BestEncoding: "PDF",
            }
          ],
          DocumentsList: []
        }
      ]
    }
  }
}
