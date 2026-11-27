/** A client may print only until the shipment's first status update, so a used label cannot be reused. */
export function clientCanPrintLabel(status: string | null | undefined) {
  return ["pendente", "rascunho"].includes(status || "")
}

export const CLIENT_LABEL_LOCKED_MESSAGE = "Este envio já está em processamento pela transportadora. A etiqueta já não pode ser impressa."
