export const DEFAULT_FUEL_SURCHARGE_PCT = 12.5

export function validateFuelSurcharge(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0 || !Number.isSafeInteger(Math.round(input * 100))) {
    throw new Error("Indique uma percentagem de combustível válida, igual ou superior a zero.")
  }
  return Math.round(input * 100) / 100
}
