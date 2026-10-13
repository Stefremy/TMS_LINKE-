export class ShipmentPricingError extends Error {}

export class ShipmentPricingUnavailableError extends Error {
  constructor() { super("Não foi possível validar a tarifa. Tente novamente ou contacte o suporte.") }
}
