/**
 * CTT API Types (CTT Expresso & CTT Postal)
 * Baseado nas especificações oficiais:
 * - SGEE - CTTX - WS Aplicacoes Proprias V1.8
 * - RecolhasWS V1.4
 * - ReferenciasWS V1.0
 * - Track and Trace - Eventos, Razões e Situações
 */

export interface CTTConnectionCredentials {
  contract_number: string // ContractId
  client_number: string   // ClientId
  auth_id: string         // AuthenticationID (GUID)
  user_id?: string        // UserId (GUID)
  distribution_channel?: number // Default: 99 (EMS)
  environment?: "qa" | "production"
  default_subproduct?: string // Default: 'ERS 24' or 'D+1'
}

export type AddressType = 1 | 2 | 3 | 4
// 1 = Sender, 2 = Receiver, 3 = Return, 4 = SecondReceiver

export interface CTTAddressData {
  Type: AddressType
  Name: string
  ContactName?: string
  Address: string
  Floor?: string
  Door?: string
  PTZipCode4?: string | number
  PTZipCode3?: string | number
  NonPTZipCode?: string
  NonPTZipCodeLocation?: string
  City: string
  Country: string // 'PT', 'ES', etc.
  Email?: string
  Phone?: string
  MobilePhone?: string
}

export type SpecialServiceType =
  | 1  // PostalObject
  | 2  // AgainstReimbursement (Cobrança/COD)
  | 3  // NominativeCheck
  | 4  // Saturday
  | 5  // ReturnDocumentSigned (Guia assinada)
  | 6  // SpecialInsurance (Seguro Extra)
  | 7  // Fragil
  | 9  // Back
  | 12 // SecondScheduledDelivery
  | 14 // SMS
  | 18 // DeliveryPoint (Ponto de Entrega / Locker)
  | 20 // AuthorizeReturn
  | 21 // MultipleHomeDelivery
  | 22 // TimeWindow (Janela Horária)
  | 23 // CertainDay (Dia Certo)
  | 24 // PhoneContact
  | 37 // LiveTracking
  | 38 // ContactoAgendamento
  | 39 // DeliveryAggregation

export interface CTTSpecialService {
  SpecialServiceType: SpecialServiceType
  Value?: number
  DeliveryPoint?: {
    Name: string
    Code: string
    Type: number // 0=PostOffice, 1=Shop, 2=ParcelLocker, 3=PostalCollectionFacility
  }
  TimeWindow?: {
    TimeWindow: number // 2=08-10h, 3=10-13h, 4=13-16h, 5=16-19h, 6=19-22h, 7=Sab 10-14h
    DeliveryDate?: string
  }
  ReturnAuthorization?: {
    ProductCode: string
    ValidationDate: string
    AddressData?: CTTAddressData
  }
}

export interface CTTShipmentData {
  IsDevolution?: boolean
  OriginalObject?: string
  ValidationDate?: string
  ATCode?: string // Código AT da Autoridade Tributária
  Observations?: string
  Weight: number // Peso em gramas ou kg (conforme parametrização)
  Quantity: number // Nº de volumes
  ClientReference: string // Referência interna única (max 21 chars)
  DeclaredValue?: number
}

export interface CTTDeliveryNote {
  ClientId: string
  ContractId: string
  DistributionChannelId: number // 99
  SubProductId: string          // 'ERS 24', 'ERS 48', 'D+1', 'D+2', 'D+5'
  ShipmentCTT: Array<{
    HasSenderInformation: boolean
    SenderData: CTTAddressData
    ReceiverData: CTTAddressData
    ShipmentData: CTTShipmentData
    SpecialServices?: CTTSpecialService[]
  }>
}

export interface CTTCompleteShipmentInput {
  AuthenticationID: string
  RequestID?: string
  UserId?: string
  DeliveryNote: CTTDeliveryNote
}

export interface CTTErrorData {
  Code: number
  Message: string
}

export interface CTTLabelData {
  FileName: string
  Label: string // Base64 string of PDF or ZPL
  BestEncoding?: string
}

export interface CTTDocumentData {
  FileName: string
  File: string // Base64 string of document
}

export interface CTTShipmentDataOutput {
  ClientReference: string
  FirstObject: string // Barcode / Tracking code (e.g. EA123456789PT)
  LastObject: string
  OriginalObjectID?: string
  LabelList?: CTTLabelData[]
  DocumentsList?: CTTDocumentData[]
}

export interface CTTCompleteShipmentOutput {
  Status: 0 | 1 // 0 = Failure, 1 = Success
  DeliveryNoteId?: string
  ErrorsList?: CTTErrorData[]
  ShipmentData?: CTTShipmentDataOutput[]
}

export interface CTTCloseShipmentInput {
  AuthenticationID: string
  RequestID?: string
  UserId?: string
  DeliveryNoteId?: string
  ShipmentIdList?: string[]
}

export interface CTTCloseShipmentOutput {
  Status: 0 | 1
  ErrorsList?: CTTErrorData[]
  DocumentsList?: CTTDocumentData[] // Certificados de Aceitação
}

export interface CTTPickupRequestInput {
  AuthenticationID: string
  ClientId: string
  ContractId: string
  DataRecolha: string // YYYY-MM-DD
  HoraInicio: string  // HH:MM
  HoraFim: string     // HH:MM
  Expedidor: {
    Nome: string
    Contacto?: string
    Morada: string
    Piso?: string
    Porta?: string
    CP4: string
    CP3: string
    Localidade: string
    Telefone: string
    Email?: string
  }
  QuantidadeVolumes: number
  PesoKg: number
  Observacoes?: string
}

export interface CTTPickupRequestOutput {
  Success: boolean
  PickUpID?: string
  NewPickUpDate?: string // Se tiver ultrapassado cut-off, sugere nova data
  Errors?: string[]
}

// Track & Trace Event Matrix
export interface CTTTrackingEvent {
  code: string
  description: string
  tms_status: "pendente" | "em_transito" | "em_distribuicao" | "entregue" | "incidencia" | "devolvido"
  is_terminal: boolean
}

export const CTT_TRACKING_EVENTS: Record<string, CTTTrackingEvent> = {
  EMA: { code: "EMA", description: "Aceitação CTT", tms_status: "em_transito", is_terminal: false },
  EMB: { code: "EMB", description: "Recepção Nacional", tms_status: "em_transito", is_terminal: false },
  EMD: { code: "EMD", description: "Recepção Internacional", tms_status: "em_transito", is_terminal: false },
  EMC: { code: "EMC", description: "Expedição Internacional", tms_status: "em_transito", is_terminal: false },
  EMF: { code: "EMF", description: "Expedição Nacional", tms_status: "em_transito", is_terminal: false },
  EMG: { code: "EMG", description: "Recepção no Centro de Distribuição Destino", tms_status: "em_transito", is_terminal: false },
  EMJ: { code: "EMJ", description: "Chegada à Estação de Trânsito", tms_status: "em_transito", is_terminal: false },
  EMK: { code: "EMK", description: "Partida da Estação de Trânsito", tms_status: "em_transito", is_terminal: false },
  EMX: { code: "EMX", description: "Permuta", tms_status: "em_transito", is_terminal: false },
  EMY: { code: "EMY", description: "Expedição do Local Responsável pela Aceitação", tms_status: "em_transito", is_terminal: false },
  EMW: { code: "EMW", description: "Chegada à Estação de Depósito", tms_status: "em_transito", is_terminal: false },
  EMZ: { code: "EMZ", description: "Em Distribuição (Com estafeta)", tms_status: "em_distribuicao", is_terminal: false },
  EMT: { code: "EMT", description: "Envio", tms_status: "em_transito", is_terminal: false },
  EMP: { code: "EMP", description: "Recolha Efetuada", tms_status: "em_transito", is_terminal: false },
  EMI: { code: "EMI", description: "Entrega Conseguida", tms_status: "entregue", is_terminal: true },
  EMH: { code: "EMH", description: "Entrega Não Conseguida (Incidência)", tms_status: "incidencia", is_terminal: false },
  EMN: { code: "EMN", description: "Erro de Encaminhamento", tms_status: "incidencia", is_terminal: false },
  EDF: { code: "EDF", description: "Objeto Retido / Parado", tms_status: "incidencia", is_terminal: false },
  EME: { code: "EME", description: "Entrada em Alfândega", tms_status: "em_transito", is_terminal: false },
  EML: { code: "EML", description: "Saída de Alfândega", tms_status: "em_transito", is_terminal: false },
  EMV: { code: "EMV", description: "Devolução em Curso", tms_status: "incidencia", is_terminal: false },
  EMM: { code: "EMM", description: "Entregue ao Remetente (Devolvido)", tms_status: "devolvido", is_terminal: true },
  EMR: { code: "EMR", description: "Reimpressão de Rótulo", tms_status: "em_transito", is_terminal: false },
}

export const CTT_NON_DELIVERY_REASONS: Record<string, string> = {
  "10": "Endereço incorreto ou insuficiente",
  "11": "Destinatário ausente / empresa encerrada",
  "12": "Destinatário desconhecido na morada",
  "13": "Recusado pelo destinatário",
  "14": "Destinatário pediu segunda entrega",
  "15": "Destinatário em greve",
  "16": "Entrega não efetuada",
  "17": "Errado Encaminhamento",
  "18": "Objeto danificado",
  "19": "Artigos proibidos",
  "20": "Artigos restritos",
  "21": "Pendente pagamento de taxas / cobrança",
  "22": "Objeto não reclamado",
  "23": "Falecido",
  "24": "Domicílio / recetáculo inacessível",
  "25": "Destinatário solicitou recolha na estação",
  "26": "Feriado Local",
  "27": "Objeto extraviado",
  "28": "Destinatário mudou-se",
  "29": "Destinatário tem apartado",
  "45": "Objeto sem distribuição domiciliária",
  "50": "Pedido de reexpedição",
  "55": "Pedido de reencaminhamento / SIGA",
  "56": "Objeto sem distribuição domiciliária",
  "57": "Errado encaminhamento - Circuito",
  "58": "Errado encaminhamento - Rede",
  "59": "Errado encaminhamento - Código Postal",
  "60": "Remessa incompleta",
  "70": "Pedido efetuado pelo destinatário",
  "99": "Outros motivos operacionais",
}

export const CTT_SITUATIONS: Record<string, string> = {
  A: "Em distribuição",
  B: "Aguarda nova tentativa de entrega",
  C: "Aguarda notificação do destinatário",
  D: "Avisado na estação",
  E: "Devolvido",
  F: "Reexpedido",
  G: "Aguarda despacho",
  H: "Objeto destruído devido à sua natureza",
  I: "Envio para refugo",
  J: "Avisado no apartado",
  K: "Destruído de acordo com as instruções do remetente",
  L: "Aguarda informação do remetente",
  M: "Envio ao destinatário",
  N: "A aguardar envio para refugos",
  O: "Entrega ao domicílio",
  U: "A aguardar envio para refugos",
  "0": "Sem situação",
}
