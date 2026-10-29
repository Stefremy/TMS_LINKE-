import type { ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"

// These rates can be configured in the client modal, but the corresponding
// carrier request/automatic surcharge is not implemented yet. Do not sell them.
const CONFIGURATION_ONLY_CODES = new Set([
  "correos_delivery_window", "correos_signed_guide_return", "correos_spain_supplement",
])
export function isCorreosConfigurationOnly(code: string): boolean {
  return CONFIGURATION_ONLY_CODES.has(code)
}

export const CORREOS_INCLUDED_SERVICES = [
  "Recolha ao domicílio",
  "Gestão proativa de incidentes",
  "Segunda tentativa de entrega",
  "POD — prova de entrega",
  "Seguro base de transporte (distinto do seguro opcional por valor declarado)",
  "Localização do destinatário em caso de ausência, nos produtos indicados no contrato",
  "ePAQ24: previsão de franja horária gratuita; telemóvel do destinatário obrigatório",
]

export const DEFAULT_CORREOS_SPECIAL_SERVICES_FEES: ClientSpecialServiceFee[] = [
  { special_service_code: "correos_cod", special_service_name: "Cobrança / Reembolso (COD)", api_type_code: 2,
    fee_type: "percentage", percentage_value: 2, min_value: 1.8, is_enabled: true,
    description: "Cobrança ao destinatário. Valor padrão anterior mantido: confirmar comissão e limites na página do contrato, cujo texto está pouco legível." },
  { special_service_code: "correos_saturday", special_service_name: "Entrega ao sábado", api_type_code: 4,
    fee_type: "fixed", fixed_value: 10, is_enabled: true,
    description: "Suplemento contratual de 10 €. Produtos PAQ24 e ePAQ24; disponibilidade sujeita ao destino e à confirmação da Correos." },
  { special_service_code: "correos_insurance", special_service_name: "Seguro opcional por valor declarado", api_type_code: 6,
    fee_type: "percentage", percentage_value: 1.5, min_value: 10, is_enabled: false,
    description: "Referência do contrato: 1,5% do valor declarado, mínimo 10 €. Distinto do seguro base incluído. Confirmar a base de cálculo antes de ativar para novos clientes." },
  { special_service_code: "correos_fragil", special_service_name: "Frágil — aviso nas observações", api_type_code: 7,
    fee_type: "fixed", fixed_value: 1.5, is_enabled: false,
    description: "Opção anterior do TMS: apenas envia um aviso nas observações. Tratamento diferenciado e respetiva tarifa não estão confirmados nesta página do contrato." },
  { special_service_code: "correos_delivery_window", special_service_name: "Franja horária específica", api_type_code: 0,
    fee_type: "fixed", fixed_value: 0.4, is_enabled: false,
    description: "Referência do contrato: 0,40 €. Entrega numa janela horária específica, sujeita aos códigos postais de origem e destino. Diferente da previsão gratuita do ePAQ24." },
  { special_service_code: "correos_signed_guide_return", special_service_name: "Retorno da guia de remessa assinada", api_type_code: 0,
    fee_type: "fixed", fixed_value: 3, is_enabled: false,
    description: "Referência do contrato: 3 €. Devolução da guia de remessa original assinada; não corresponde à devolução da encomenda." },
  { special_service_code: "correos_spain_supplement", special_service_name: "Suplemento de origem ou destino Espanha", api_type_code: 0,
    fee_type: "fixed", fixed_value: 1, is_enabled: false,
    description: "Referência do contrato: 1 € por envio com origem ou destino Espanha. Configuração comercial; aplicação automática ainda não ligada." },
]

/** Merge by stable code: retain negotiated amounts, explicit disabled states and custom fees. */
export function mergeClientSpecialFees(configured: ClientSpecialServiceFee[] | undefined, cttDefaults: ClientSpecialServiceFee[]) {
  const result = (configured || cttDefaults).map(fee => ({
    ...fee, is_enabled: isCorreosConfigurationOnly(fee.special_service_code) ? false : fee.is_enabled,
  }))
  const known = new Set(result.map(fee => fee.special_service_code))
  for (const fee of [...cttDefaults, ...DEFAULT_CORREOS_SPECIAL_SERVICES_FEES]) {
    if (!known.has(fee.special_service_code)) {
      result.push({ ...fee })
      known.add(fee.special_service_code)
    }
  }
  return result
}
