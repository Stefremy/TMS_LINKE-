import { CTTSoapClient } from "./ctt-soap-client"
import type { CTTConnectionCredentials } from "./ctt-types"
import { normalizePickupObjects, validatePickupSearch, type PickupSearch, type PickupSummary } from "@/lib/pickup-management"

type RecordData = Record<string, unknown>
const object = (value: unknown): RecordData => value && typeof value === "object" ? value as RecordData : {}
const list = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value]

function errors(result: RecordData): string[] {
  const strings = object(result._erros || result.Erros).string
  return list(strings).map(String).filter(Boolean)
}

function mapRemote(value: unknown): PickupSummary {
  const row = object(value)
  const s = (key: string) => {
    const value = row[`_${key}`] ?? row[key]
    // XML nil elements are parsed as attribute objects, not empty strings.
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
  }
  const n = (key: string) => row[`_${key}`] == null ? undefined : Number(row[`_${key}`])
  const id = s("IDRecolha")
  const start = s("HoraInicio"), end = s("HoraFim")
  return {
    id, source: "ctt", ctt_pickup_id: id, carrier_code: "ctt_expresso", carrier_name: "CTT Expresso",
    status: s("RecolhaEfectuada") || "Consultar no portal CTT", scheduled_date: s("DataInicioRecolha") || s("Data"),
    created_at: s("DataCriacao"), collected_at: s("DataRecolhaEfectuada"),
    sender_name: s("Expedidor"), sender_address: s("MoradaExp"), sender_city: s("LocalidadeExp"),
    sender_zip: [s("CP4Exp"), s("CP3Exp")].filter(Boolean).join("-"), sender_country: s("PaisExp"),
    sender_contact: s("ContactoExp"), sender_phone: s("TelefoneExp"), sender_email: s("Email"),
    period: start && end ? `${start}-${end}` : undefined, volumes: n("QuantObj"),
    weight_kg: n("Peso") === undefined ? undefined : Number(n("Peso")) / 1000,
    observations: s("ObsObj") || s("Observacao"), objects: normalizePickupObjects(object(row._Objectos).string),
    requester: s("Contacto") ? { name: s("Contacto"), phone: s("Telefone"), email: s("Email") } : undefined,
  }
}

/** Read-only operations published by RecolhasWS. No edit/cancel operation exists in this contract. */
export class CTTPickupReadService {
  private client = new CTTSoapClient()

  private async call(creds: CTTConnectionCredentials, operation: "PesquisaRecolhas" | "GetRecolha", fields: Record<string, string>) {
    const esc = CTTSoapClient.escapeXml
    const params = { NumCliente: creds.client_number, NumContrato: creds.contract_number, ID: creds.auth_id, ...fields }
    const response = await this.client.callSoap({
      endpoint: creds.environment === "qa" ? "http://cttexpressows.qa.ctt.pt/CTTEWSPool/RecolhasWS.svc" : "http://cttexpressows.ctt.pt/CTTEWSPool/RecolhasWS.svc",
      action: `http://tempuri.org/IRecolhasWS/${operation}`,
      soapBodyXml: `<tem:${operation}>${Object.entries(params).map(([key, value]) => `<tem:${key}>${esc(value)}</tem:${key}>`).join("")}</tem:${operation}>`,
    })
    const result = object(response?.[`${operation}Response`]?.[`${operation}Result`])
    if (!Object.keys(result).length) throw new Error("Os CTT devolveram uma resposta vazia.")
    const messages = errors(result)
    if (messages.length) throw new Error(`CTT: ${messages.join("; ")}`)
    return result
  }

  async search(creds: CTTConnectionCredentials, input: PickupSearch): Promise<PickupSummary[]> {
    const error = validatePickupSearch(input, true)
    if (error) throw new Error(error)
    const result = await this.call(creds, "PesquisaRecolhas", {
      dtInicio: input.reference?.trim() ? "" : input.dateFrom || "",
      dtFim: input.reference?.trim() ? "" : input.dateTo || "",
      Estado: input.status || "", NumRecolha: input.reference?.trim() || "",
    })
    return list(object(result._recolhas || result.Recolhas).RecolhasListBE).map(mapRemote)
  }

  async details(creds: CTTConnectionCredentials, reference: string): Promise<PickupSummary> {
    if (!reference || !/^[A-Za-z0-9/_-]{1,64}$/.test(reference)) throw new Error("Referência CTT inválida.")
    let result: RecordData
    try {
      result = await this.call(creds, "GetRecolha", { NumRecolha: reference })
    } catch (error) {
      if (!/permiss/i.test(error instanceof Error ? error.message : "")) throw error
      // GetRecolha (objects) denied: PesquisaRecolhas by number still reports the collected state.
      const found = (await this.search(creds, { reference })).find(item => item.ctt_pickup_id.toUpperCase() === reference.toUpperCase())
      if (!found) throw error
      found.objects_unavailable_reason = "Os CTT não permitem a este utilizador consultar os objetos desta recolha (GetRecolha). O estado foi lido da pesquisa de recolhas."
      return found
    }
    const pickup = mapRemote(result._recolhas || result.Recolha)
    if (!pickup.ctt_pickup_id) throw new Error("Os CTT não devolveram detalhes para esta referência.")
    if (pickup.ctt_pickup_id.toUpperCase() !== reference.toUpperCase()) throw new Error("A referência devolvida pelos CTT não corresponde à recolha consultada.")
    pickup.objects_checked_at = new Date().toISOString()
    return pickup
  }
}
